/**
 * Magnus Bot — Dashboard Server (Express + Socket.io)
 * Copyright © 2025 DJAMEL
 */
"use strict";

const express    = require("express");
const http       = require("http");
const socketio   = require("socket.io");
const path       = require("path");
const fs         = require("fs-extra");
const bodyParser = require("body-parser");
const chalk      = require("chalk");
const crypto     = require("crypto");

const ROOT         = path.join(__dirname, "../../");
const ACCOUNT_PATH = path.join(ROOT, "account.txt");
const CONFIG_PATH  = path.join(ROOT, "config.json");
const CMDS_DIR     = path.join(ROOT, "src/commands");

let _io      = null;
let _server  = null;
let _logBuf  = [];
const MAX_LOG_BUF = 500;

const stats = {
  totalMessages: 0,
  totalCommands: 0,
  activeThreads: new Set(),
  activeUsers:   new Set(),
  msgLog:        [],
};

const _tokens = new Map();
function genToken() {
  const tok = crypto.randomBytes(24).toString("hex");
  _tokens.set(tok, Date.now() + 8 * 3600 * 1000);
  return tok;
}
function validToken(tok) {
  const exp = _tokens.get(tok);
  if (!exp) return false;
  if (Date.now() > exp) { _tokens.delete(tok); return false; }
  return true;
}
function getDashPwd() {
  try {
    const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    return cfg.dashboard?.password || "magnus2025";
  } catch (_) { return "magnus2025"; }
}

function interceptLogs() {
  const origWrite = process.stdout.write.bind(process.stdout);
  const errWrite  = process.stderr.write.bind(process.stderr);
  const push = (data) => {
    const line = String(data).replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
    if (!line) return;
    if (_logBuf.length >= MAX_LOG_BUF) _logBuf.shift();
    _logBuf.push({ ts: Date.now(), line });
    if (_io) _io.emit("log-line", { ts: Date.now(), line });
  };
  process.stdout.write = function(chunk, ...args) { push(chunk); return origWrite(chunk, ...args); };
  process.stderr.write = function(chunk, ...args) { push(chunk); return errWrite(chunk, ...args); };
}

function getIO()  { return _io; }

function _bufferMsg(event) {
  stats.totalMessages++;
  if (event.threadID) stats.activeThreads.add(String(event.threadID));
  if (event.senderID) stats.activeUsers.add(String(event.senderID));
  if (stats.msgLog.length >= 60) stats.msgLog.shift();
  stats.msgLog.push({ body: (event.body || "").slice(0, 100), ts: Date.now(), tid: event.threadID, sid: event.senderID });
  if (_io) _io.emit("stats-update", getStats());
}
function _trackMsg(tid, uid, body) {
  const px = global.GoatBot?.config?.prefix || "/";
  if (body?.trimStart().startsWith(px)) stats.totalCommands++;
}
global._bufferMsg = _bufferMsg;
global._trackMsg  = _trackMsg;

function getStats() {
  const upMs = Date.now() - (global.GoatBot?.startTime || Date.now());
  const mem  = process.memoryUsage();
  return {
    uptime:        upMs,
    totalMessages: stats.totalMessages,
    totalCommands: stats.totalCommands,
    activeThreads: stats.activeThreads.size,
    activeUsers:   stats.activeUsers.size,
    commands:      global.GoatBot?.commands?.size || 0,
    botID:         global.GoatBot?.botID  || null,
    botName:       global.GoatBot?.config?.botName || "Magnus Bot",
    memMB:         +(mem.heapUsed / 1048576).toFixed(1),
    prefix:        global.GoatBot?.config?.prefix || "/",
    protection:    20,
    online:        !!global.GoatBot?.fcaApi && !!global.GoatBot?.botID,
  };
}

function readConfig() {
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
}

function writeConfig(cfg) {
  global._selfWriteConfig = true;
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2));
  setTimeout(() => { global._selfWriteConfig = false; }, 3000);
  if (global.GoatBot) global.GoatBot.config = cfg;
  global.config = cfg;
  global.commandPrefix = cfg.prefix || "/";
}

function getAdmins() {
  const cfg = global.GoatBot?.config || readConfig();
  return {
    ownerID:      String(cfg.ownerID || ""),
    adminBot:     (cfg.adminBot     || []).map(String),
    superAdminBot:(cfg.superAdminBot|| []).map(String),
  };
}

function auth(req, res, next) {
  const tok = req.headers["x-david-token"] || req.query.token;
  if (tok && validToken(tok)) return next();
  res.status(401).json({ ok: false, error: "Unauthorized" });
}

function startDashboard(port = 5000) {
  const app   = express();
  _server     = http.createServer(app);
  _io         = socketio(_server, { cors: { origin: "*" } });

  app.use(bodyParser.json({ limit: "5mb" }));
  app.use(bodyParser.urlencoded({ extended: true, limit: "5mb" }));
  app.use(express.static(path.join(__dirname, "public")));

  app.post("/api/login", (req, res) => {
    const { password } = req.body;
    if (password === getDashPwd()) {
      const tok = genToken();
      res.json({ ok: true, token: tok });
    } else {
      res.json({ ok: false, error: "كلمة السر خاطئة" });
    }
  });
  app.post("/api/logout", auth, (req, res) => {
    const tok = req.headers["x-david-token"] || req.query.token;
    _tokens.delete(tok);
    res.json({ ok: true });
  });
  app.get("/api/auth-check", auth, (_, res) => res.json({ ok: true }));
  app.get("/api/stats",  auth, (_, res) => res.json(getStats()));
  app.get("/api/status", auth, (_, res) => {
    const online = !!global.GoatBot?.fcaApi && !!global.GoatBot?.botID;
    res.json({ ok: true, online, botID: global.GoatBot?.botID || null, botName: global.GoatBot?.config?.botName || "Magnus Bot" });
  });

  app.get("/api/config", auth, (_, res) => {
    try {
      const cfg = readConfig();
      if (cfg.facebookAccount) cfg.facebookAccount.password = "";
      res.json({ ok: true, config: cfg });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.post("/api/config", auth, (req, res) => {
    try {
      const old = readConfig();
      const updated = Object.assign({}, old, req.body);
      writeConfig(updated);
      if (_io) _io.emit("config-reloaded", { ts: Date.now(), config: updated });
      if (_io) _io.emit("admin-updated", getAdmins());
      res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.get("/api/admins", auth, (_, res) => {
    try { res.json({ ok: true, ...getAdmins() }); }
    catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.post("/api/admins/add", auth, (req, res) => {
    try {
      const { id, type } = req.body;
      if (!id) return res.json({ ok: false, error: "id مطلوب" });
      const sid = String(id).trim();
      const cfg = readConfig();
      const field = type === "super" ? "superAdminBot" : "adminBot";
      if (!Array.isArray(cfg[field])) cfg[field] = [];
      const list = cfg[field].map(String);
      if (!list.includes(sid)) {
        cfg[field].push(Number(sid) || sid);
      }
      writeConfig(cfg);
      const admins = getAdmins();
      if (_io) _io.emit("admin-updated", admins);
      if (_io) _io.emit("config-reloaded", { ts: Date.now(), config: cfg });
      res.json({ ok: true, ...admins });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.post("/api/admins/remove", auth, (req, res) => {
    try {
      const { id, type } = req.body;
      if (!id) return res.json({ ok: false, error: "id مطلوب" });
      const sid = String(id).trim();
      const cfg = readConfig();
      const ownerID = String(cfg.ownerID || "");
      if (sid === ownerID) return res.json({ ok: false, error: "لا يمكن إزالة مالك البوت" });
      const field = type === "super" ? "superAdminBot" : "adminBot";
      if (Array.isArray(cfg[field])) {
        cfg[field] = cfg[field].filter(x => String(x) !== sid);
      }
      writeConfig(cfg);
      const admins = getAdmins();
      if (_io) _io.emit("admin-updated", admins);
      if (_io) _io.emit("config-reloaded", { ts: Date.now(), config: cfg });
      res.json({ ok: true, ...admins });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.post("/api/admins/set-owner", auth, (req, res) => {
    try {
      const { id } = req.body;
      if (!id) return res.json({ ok: false, error: "id مطلوب" });
      const sid = String(id).trim();
      const cfg = readConfig();
      cfg.ownerID = sid;
      if (!Array.isArray(cfg.superAdminBot)) cfg.superAdminBot = [];
      if (!cfg.superAdminBot.map(String).includes(sid)) cfg.superAdminBot.push(Number(sid) || sid);
      if (!Array.isArray(cfg.adminBot)) cfg.adminBot = [];
      if (!cfg.adminBot.map(String).includes(sid)) cfg.adminBot.push(Number(sid) || sid);
      writeConfig(cfg);
      const admins = getAdmins();
      if (_io) _io.emit("admin-updated", admins);
      if (_io) _io.emit("config-reloaded", { ts: Date.now(), config: cfg });
      res.json({ ok: true, ...admins });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.post("/api/cookies", auth, (req, res) => {
    const raw = req.body?.cookies;
    if (!raw) return res.json({ ok: false, error: "لا توجد بيانات" });
    try {
      const DjamelFCA = require("../../Djamel-fca");
      const parsed    = DjamelFCA.parseCookieInput(raw);
      const cookies   = parsed.cookies;
      if (!cookies.length) return res.json({ ok: false, error: "صيغة الكوكيز غير معروفة" });
      if (!DjamelFCA.hasMandatory(cookies)) return res.json({ ok: false, error: "كوكيز ناقصة (c_user أو xs مفقود)" });
      global._selfWrite = true;
      fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(cookies, null, 2));
      setTimeout(() => { global._selfWrite = false; }, 6000);
      res.json({ ok: true, count: cookies.length });
      setTimeout(() => { try { global.startBot?.(); } catch (_) {} }, 1500);
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.post("/api/control", auth, (req, res) => {
    const { action } = req.body;
    if (action === "restart") {
      res.json({ ok: true });
      setTimeout(() => { try { global.startBot?.(); } catch (_) {} }, 400);
    } else if (action === "stop") {
      res.json({ ok: true });
      setTimeout(() => process.exit(0), 400);
    } else {
      res.json({ ok: false, error: "action غير معروف" });
    }
  });

  app.get("/api/commands", auth, (_, res) => {
    const list = [];
    for (const [name, cmd] of (global.GoatBot?.commands || new Map())) {
      if (cmd?.config?.name?.toLowerCase() === name) {
        list.push({
          name: cmd.config.name, aliases: cmd.config.aliases || [],
          category: cmd.config.category || "other", role: cmd.config.role ?? 2,
          description: cmd.config.description || "", version: cmd.config.version || "1.0",
        });
      }
    }
    res.json({ ok: true, commands: list });
  });

  app.get("/api/commands/:name/source", auth, (req, res) => {
    const name = req.params.name.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const file = path.join(CMDS_DIR, `${name}.js`);
    if (!fs.existsSync(file)) return res.json({ ok: false, error: "الأمر غير موجود" });
    try { res.json({ ok: true, name, code: fs.readFileSync(file, "utf8") }); }
    catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.post("/api/commands/:name/source", auth, (req, res) => {
    const name = req.params.name.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const { code } = req.body;
    if (!code) return res.json({ ok: false, error: "الكود فارغ" });
    const file = path.join(CMDS_DIR, `${name}.js`);
    try { new Function(code); } catch (syntaxErr) { return res.json({ ok: false, error: "خطأ في الكود: " + syntaxErr.message }); }
    try {
      fs.writeFileSync(file, code, "utf8");
      const absPath = require.resolve(file);
      delete require.cache[absPath];
      const cmd = require(file);
      if (cmd?.config?.name) {
        const n = cmd.config.name.toLowerCase();
        global.GoatBot.commands.set(n, cmd);
        if (cmd.config.aliases) for (const a of cmd.config.aliases) if (a) global.GoatBot.commands.set(String(a).toLowerCase(), cmd);
        if (_io) _io.emit("command-updated", { name: n });
        res.json({ ok: true, message: `✅ تم تحديث /${n}` });
      } else { res.json({ ok: false, error: "config.name مفقود" }); }
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.get("/api/thread-commands", auth, (_, res) => {
    try { const ctrl = require("../utils/cmdControl"); ctrl.reload(); res.json({ ok: true, data: ctrl.getAll() }); }
    catch (e) { res.json({ ok: false, error: e.message }); }
  });
  app.get("/api/thread-commands/:tid", auth, (req, res) => {
    try { const ctrl = require("../utils/cmdControl"); res.json({ ok: true, config: ctrl.getThreadConfig(req.params.tid) }); }
    catch (e) { res.json({ ok: false, error: e.message }); }
  });
  app.post("/api/thread-commands/:tid", auth, (req, res) => {
    try {
      const ctrl = require("../utils/cmdControl");
      const { mode, commands: cmds } = req.body;
      if (!["blacklist","whitelist"].includes(mode)) return res.json({ ok: false, error: "mode يجب أن يكون blacklist أو whitelist" });
      ctrl.setThreadConfig(req.params.tid, { mode, commands: Array.isArray(cmds) ? cmds : [] });
      res.json({ ok: true });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });
  app.delete("/api/thread-commands/:tid", auth, (req, res) => {
    try { const ctrl = require("../utils/cmdControl"); ctrl.resetThread(req.params.tid); res.json({ ok: true }); }
    catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.get("/api/threads", auth, (_, res) => {
    try {
      const threads = [];
      const allData = global.GoatBot?.allThreadData || {};
      for (const [tid, data] of Object.entries(allData)) {
        threads.push({ tid, name: data?.threadName || data?.name || `Thread ${tid}`, type: data?.isGroup ? "group" : "dm" });
      }
      res.json({ ok: true, threads });
    } catch (e) { res.json({ ok: false, error: e.message }); }
  });

  app.get("/api/messages", auth, (_, res) => {
    res.json({ ok: true, messages: [...stats.msgLog].reverse().slice(0, 30) });
  });

  app.get("/api/logs", auth, (_, res) => {
    res.json({ ok: true, logs: _logBuf.slice(-200) });
  });

  _io.on("connection", socket => {
    const tok = socket.handshake.query?.token;
    if (!validToken(tok)) { socket.disconnect(); return; }
    socket.emit("stats-update", getStats());
    socket.emit("bot-status", {
      status:  global.GoatBot?.fcaApi ? "online" : "offline",
      uid:     global.GoatBot?.botID  || null,
      botName: global.GoatBot?.config?.botName || "Magnus Bot",
    });
    socket.emit("log-history", _logBuf.slice(-100));
    socket.emit("admin-updated", getAdmins());
    socket.on("ping-bot", () => socket.emit("pong-bot", { ts: Date.now() }));
  });

  app.get("*", (_, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

  _server.listen(port, "0.0.0.0", () => {
    console.log();
    console.log(chalk.cyan("  ╔══════════════════════════════════════════╗"));
    console.log(chalk.cyan(`  ║  🌐 Magnus Dashboard: http://0.0.0.0:${port}  ║`));
    console.log(chalk.cyan("  ╚══════════════════════════════════════════╝"));
    console.log();
  });

  setInterval(() => { if (_io) _io.emit("stats-update", getStats()); }, 5000);
  return { app, server: _server, io: _io };
}

module.exports = { startDashboard, getIO, interceptLogs };
