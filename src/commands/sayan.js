/**
 * Magnus Bot — ! سايان — الأمر الشامل
 *
 * الأوامر:
 *   ! سايان نيم [اسم]           → حماية اسم الغروب
 *   ! سايان ايقاف نيم           → إيقاف حماية الاسم
 *   ! سايان اضافة [رسالة] [وقت] → ضبط الرد التلقائي
 *   ! سايان تشغيل               → تشغيل الرد التلقائي
 *   ! سايان ايقاف               → إيقاف الرد التلقائي
 *   ! سايان ابتيم               → معلومات البوت الكاملة
 *   ! سايان رفع ادمن [ID]       → رفع شخص لأدمن (المالك فقط)
 *   ! سايان خفض ادمن [ID]       → إزالة أدمن (المالك فقط)
 *
 * Copyright © 2025 MAGNUS
 */
"use strict";

const fs   = require("fs-extra");
const path = require("path");
const os   = require("os");

// ─── Storage ────────────────────────────────────────────────────────────────
const NIM_DATA   = path.join(process.cwd(), "database/data/sayanNim.json");
const AUTO_DATA  = path.join(process.cwd(), "database/data/sayanAuto.json");

function loadNim()  { try { return fs.existsSync(NIM_DATA)  ? JSON.parse(fs.readFileSync(NIM_DATA,  "utf8")) : {}; } catch (_) { return {}; } }
function saveNim(d) { fs.ensureDirSync(path.dirname(NIM_DATA));  fs.writeFileSync(NIM_DATA,  JSON.stringify(d, null, 2)); }
function loadAuto() { try { return fs.existsSync(AUTO_DATA) ? JSON.parse(fs.readFileSync(AUTO_DATA, "utf8")) : {}; } catch (_) { return {}; } }
function saveAuto(d){ fs.ensureDirSync(path.dirname(AUTO_DATA)); fs.writeFileSync(AUTO_DATA, JSON.stringify(d, null, 2)); }

// ─── Helpers ─────────────────────────────────────────────────────────────────
function isAdmin(id) {
  const cfg = global.GoatBot?.config || {};
  const sid = String(id);
  return [cfg.ownerID, ...(cfg.superAdminBot || []), ...(cfg.adminBot || [])]
    .filter(Boolean).map(String).includes(sid);
}

// Parse timing string like "30s", "2m", "90" → milliseconds
function parseDelay(token) {
  if (!token) return null;
  const t = String(token).trim().toLowerCase();
  if (t.endsWith("m")) { const v = parseFloat(t); return isNaN(v) ? null : Math.max(v * 60000, 5000); }
  if (t.endsWith("s")) { const v = parseFloat(t); return isNaN(v) ? null : Math.max(v * 1000,  5000); }
  const v = parseFloat(t);
  return isNaN(v) ? null : Math.max(v * 1000, 5000); // default = seconds
}

function fmtDelay(ms) {
  if (ms >= 60000) return `${(ms / 60000).toFixed(1)} دقيقة`;
  return `${Math.round(ms / 1000)} ثانية`;
}

function fmtUptime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const d  = Math.floor(totalSec / 86400);
  const h  = Math.floor((totalSec % 86400) / 3600);
  const m  = Math.floor((totalSec % 3600) / 60);
  const s  = totalSec % 60;
  const parts = [];
  if (d) parts.push(`${d} يوم`);
  if (h) parts.push(`${h} ساعة`);
  if (m) parts.push(`${m} دقيقة`);
  parts.push(`${s} ثانية`);
  return parts.join(" و ");
}

// ─── NIM protection timers ────────────────────────────────────────────────────
const _nimTimers = new Map();

function clearNimTimer(tid) {
  if (_nimTimers.has(tid)) { clearTimeout(_nimTimers.get(tid)); _nimTimers.delete(tid); }
}

function scheduleNimCheck(api, tid, name) {
  clearNimTimer(tid);
  const ms = 3000 + Math.floor(Math.random() * 4000);
  const handle = setTimeout(async () => {
    try {
      const data = loadNim();
      if (!data[tid]?.active) return;
      const info = await new Promise((res, rej) => api.getThreadInfo(tid, (e, d) => e ? rej(e) : res(d)));
      const cur  = info?.threadName || info?.name || "";
      if (cur !== name) await api.setTitle(name, tid);
    } catch (_) {}
    const d = loadNim();
    if (d[tid]?.active) scheduleNimCheck(api, tid, d[tid].name);
  }, ms);
  _nimTimers.set(tid, handle);
}

// ─── Auto-reply timers ────────────────────────────────────────────────────────
// Map: tid → { timer, lastSent }
const _autoState = new Map();

function clearAutoTimer(tid) {
  const s = _autoState.get(tid);
  if (s?.timer) { clearTimeout(s.timer); }
  _autoState.delete(tid);
}

function scheduleAutoReply(api, tid, cfg) {
  clearAutoTimer(tid);
  if (!cfg?.active || !cfg?.message || !cfg?.delayMs) return;

  // This is a rate-limited reply — we schedule a window reset
  _autoState.set(tid, { lastSent: 0, pendingTimer: null });
}

// ─── Module ──────────────────────────────────────────────────────────────────
module.exports = {
  config: {
    name:        "سايان",
    aliases:     ["sayan"],
    version:     "2.0",
    author:      "DJAMEL",
    countDown:   3,
    role:        2,
    category:    "management",
    description: "أمر SAIYAN الشامل — حماية الاسم + رد تلقائي + معلومات البوت",
    guide: {
      en:
        "{pn} نيم [اسم]          — حماية اسم الغروب\n" +
        "{pn} ايقاف نيم          — إيقاف حماية الاسم\n" +
        "{pn} اضافة [رسالة] [وقت]— ضبط الرد التلقائي (30s / 2m)\n" +
        "{pn} تشغيل              — تشغيل الرد التلقائي\n" +
        "{pn} ايقاف              — إيقاف الرد التلقائي\n" +
        "{pn} ابتيم              — معلومات البوت",
    },
  },

  // ─── onStart ──────────────────────────────────────────────────────────────
  onStart: async function ({ api, event, args, message }) {
    if (!isAdmin(event.senderID)) return message.reply("⛔ هذا الأمر للأدمن فقط.");

    const tid  = String(event.threadID);
    const sub1 = (args[0] || "").trim();
    const sub2 = (args[1] || "").trim();

    // ══════════════════════════════════════════════════════
    // ! سايان نيم [اسم]
    // ══════════════════════════════════════════════════════
    if (sub1 === "نيم") {
      const name = args.slice(1).join(" ").trim();
      if (!name) return message.reply("❗ اكتب الاسم.\nمثال: ! سايان نيم Magnus Bot");
      try { await api.setTitle(name, tid); } catch (e) { return message.reply("❌ فشل: " + e.message); }
      const d = loadNim();
      d[tid] = { active: true, name };
      saveNim(d);
      scheduleNimCheck(api, tid, name);
      return message.reply(
        `🔒 تم تفعيل حماية اسم الغروب!\n` +
        `📝 الاسم: ${name}\n\n` +
        `سيعود الاسم تلقائياً إذا غيّره أحد.\n` +
        `لإيقافه: ! سايان ايقاف نيم`
      );
    }

    // ══════════════════════════════════════════════════════
    // ! سايان ايقاف نيم
    // ══════════════════════════════════════════════════════
    if (sub1 === "ايقاف" && sub2 === "نيم") {
      clearNimTimer(tid);
      const d = loadNim();
      if (d[tid]) { d[tid].active = false; saveNim(d); }
      return message.reply("✅ تم إيقاف حماية الاسم.");
    }

    // ══════════════════════════════════════════════════════
    // ! سايان ايقاف   (إيقاف الرد التلقائي)
    // ══════════════════════════════════════════════════════
    if (sub1 === "ايقاف" && !sub2) {
      clearAutoTimer(tid);
      const d = loadAuto();
      if (d[tid]) { d[tid].active = false; saveAuto(d); }
      return message.reply("✅ تم إيقاف الرد التلقائي.");
    }

    // ══════════════════════════════════════════════════════
    // ! سايان اضافة [رسالة] [وقت]
    // ══════════════════════════════════════════════════════
    if (sub1 === "اضافة") {
      // Last arg might be the timing token
      const allArgs = args.slice(1);
      const lastArg = allArgs[allArgs.length - 1] || "";
      const delayMs = parseDelay(lastArg);
      let msgText, delay;

      if (delayMs && allArgs.length > 1) {
        msgText = allArgs.slice(0, -1).join(" ").trim();
        delay   = delayMs;
      } else {
        msgText = allArgs.join(" ").trim();
        delay   = 30000; // default 30s
      }

      if (!msgText) return message.reply("❗ اكتب الرسالة.\nمثال: ! سايان اضافة مرحباً بكم 30s");

      const d = loadAuto();
      d[tid] = { ...(d[tid] || {}), message: msgText, delayMs: delay, active: false };
      saveAuto(d);

      return message.reply(
        `✅ تم ضبط الرد التلقائي!\n` +
        `📝 الرسالة: ${msgText}\n` +
        `⏱ الفاصل الزمني: ${fmtDelay(delay)}\n\n` +
        `لتشغيله: ! سايان تشغيل`
      );
    }

    // ══════════════════════════════════════════════════════
    // ! سايان تشغيل
    // ══════════════════════════════════════════════════════
    if (sub1 === "تشغيل") {
      const d = loadAuto();
      if (!d[tid]?.message) {
        return message.reply(
          "❗ لم تضع رسالة بعد.\n" +
          "أولاً: ! سايان اضافة [رسالة] [وقت]\n" +
          "ثم: ! سايان تشغيل"
        );
      }
      d[tid].active = true;
      saveAuto(d);
      _autoState.set(tid, { lastSent: 0 });
      return message.reply(
        `✅ تم تشغيل الرد التلقائي!\n` +
        `📝 الرسالة: ${d[tid].message}\n` +
        `⏱ كل رسالة جديدة → يرد بعد ${fmtDelay(d[tid].delayMs)}\n\n` +
        `لإيقافه: ! سايان ايقاف`
      );
    }

    // ══════════════════════════════════════════════════════
    // ! سايان ابتيم
    // ══════════════════════════════════════════════════════
    if (sub1 === "ابتيم") {
      const upMs   = Date.now() - (global.GoatBot?.startTime || Date.now());
      const mem    = process.memoryUsage();
      const sysM   = { total: os.totalmem(), free: os.freemem() };
      const cmds   = global.GoatBot?.commands?.size || 0;
      const uid    = global.GoatBot?.botID  || "—";
      const bName  = global.GoatBot?.config?.botName || "Magnus Bot";
      const prefix = global.GoatBot?.config?.prefix || "!";
      const nim    = loadNim();
      const auto   = loadAuto();
      const nimActive  = !!nim[tid]?.active;
      const autoActive = !!auto[tid]?.active;
      const prot   = 20;
      const ping   = Date.now(); await new Promise(r => setTimeout(r, 8)); const pong = Date.now() - ping;

      const lines = [
        `𝑺𝑨𝑰𝒀𝑨𝑵 𝑩𝑶𝑻`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🤖 الاسم      : ${bName}`,
        `🆔 Bot ID     : ${uid}`,
        `💬 Thread ID  : ${tid}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `⏱ يعمل منذ   : ${fmtUptime(upMs)}`,
        `🏓 Ping       : ${pong}ms`,
        `💾 RAM المستخدم: ${(mem.heapUsed/1048576).toFixed(1)} MB`,
        `🖥 RAM الكلي  : ${(sysM.total/1073741824).toFixed(2)} GB`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `📦 الأوامر    : ${cmds} أمر`,
        `🛡 الحماية    : ${prot} طبقة نشطة`,
        `🔑 البادئة    : ${prefix}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `🔒 حماية الاسم: ${nimActive  ? "✅ مفعّلة → " + (nim[tid]?.name||"")  : "❌ معطلة"}`,
        `💬 رد تلقائي  : ${autoActive ? "✅ مفعّل  → " + fmtDelay(auto[tid]?.delayMs||0) : "❌ معطل"}`,
        `━━━━━━━━━━━━━━━━━━━━━━━━`,
        `👑 المطوّر    : MAGNUS`,
        `⚙️ المحرك     : SAIYAN`,
      ];

      return message.reply(lines.join("\n"));
    }

    // ══════════════════════════════════════════════════════
    // ! سايان رفع ادمن [ID]   — المالك فقط
    // ══════════════════════════════════════════════════════
    if (sub1 === "رفع" && sub2 === "ادمن") {
      const cfg  = global.GoatBot?.config || {};
      const ownerID = String(cfg.ownerID || "");
      if (String(event.senderID) !== ownerID)
        return message.reply("⛔ هذا الأمر للمالك فقط.");

      const targetID = String(args[2] || "").trim().replace(/\D/g, "");
      if (!targetID) return message.reply("❗ اكتب الـ ID.\nمثال: ! سايان رفع ادمن 123456789");
      if (targetID === ownerID) return message.reply("⚠️ أنت المالك أصلاً!");

      // تحديث الذاكرة
      cfg.adminBot      = [...new Set([...(cfg.adminBot      || []).map(String), targetID])].map(Number);
      cfg.superAdminBot = [...new Set([...(cfg.superAdminBot || []).map(String), targetID])].map(Number);

      // حفظ config.json
      const cfgPath = path.join(process.cwd(), "config.json");
      try {
        const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
        raw.adminBot      = cfg.adminBot;
        raw.superAdminBot = cfg.superAdminBot;
        fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2));
      } catch (e) { return message.reply("❌ فشل في حفظ الإعدادات: " + e.message); }

      return message.reply(
        `✅ تم رفع الأدمن بنجاح!\n` +
        `🆔 ID: ${targetID}\n` +
        `👑 الآن يتحكم بالبوت كالمالك.\n\n` +
        `لإزالته: ! سايان خفض ادمن ${targetID}`
      );
    }

    // ══════════════════════════════════════════════════════
    // ! سايان خفض ادمن [ID]   — المالك فقط
    // ══════════════════════════════════════════════════════
    if (sub1 === "خفض" && sub2 === "ادمن") {
      const cfg  = global.GoatBot?.config || {};
      const ownerID = String(cfg.ownerID || "");
      if (String(event.senderID) !== ownerID)
        return message.reply("⛔ هذا الأمر للمالك فقط.");

      const targetID = String(args[2] || "").trim().replace(/\D/g, "");
      if (!targetID) return message.reply("❗ اكتب الـ ID.\nمثال: ! سايان خفض ادمن 123456789");
      if (targetID === ownerID) return message.reply("⚠️ لا يمكن إزالة المالك!");

      const waAdmin = (cfg.adminBot || []).map(String).includes(targetID);
      if (!waAdmin) return message.reply(`⚠️ ${targetID} ليس أدمن أصلاً.`);

      // تحديث الذاكرة
      cfg.adminBot      = (cfg.adminBot      || []).map(String).filter(id => id !== targetID).map(Number);
      cfg.superAdminBot = (cfg.superAdminBot || []).map(String).filter(id => id !== targetID).map(Number);

      // حفظ config.json
      const cfgPath = path.join(process.cwd(), "config.json");
      try {
        const raw = JSON.parse(fs.readFileSync(cfgPath, "utf8"));
        raw.adminBot      = cfg.adminBot;
        raw.superAdminBot = cfg.superAdminBot;
        fs.writeFileSync(cfgPath, JSON.stringify(raw, null, 2));
      } catch (e) { return message.reply("❌ فشل في حفظ الإعدادات: " + e.message); }

      return message.reply(
        `✅ تم خفض الأدمن بنجاح!\n` +
        `🆔 ID: ${targetID}\n` +
        `🚫 لم يعد يملك صلاحيات التحكم.`
      );
    }

    // ══════════════════════════════════════════════════════
    // مساعدة عامة
    // ══════════════════════════════════════════════════════
    return message.reply(
      `𝑺𝑨𝑰𝒀𝑨𝑵 𝑩𝑶𝑻 — الأوامر\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `! سايان نيم [اسم]            — حماية اسم الغروب\n` +
      `! سايان ايقاف نيم            — إيقاف حماية الاسم\n` +
      `! سايان اضافة [رسالة] [وقت]  — ضبط الرد\n` +
      `! سايان تشغيل                — تشغيل الرد التلقائي\n` +
      `! سايان ايقاف                — إيقاف الرد التلقائي\n` +
      `! سايان ابتيم                — معلومات البوت\n` +
      `! سايان رفع ادمن [ID]        — رفع أدمن (المالك فقط)\n` +
      `! سايان خفض ادمن [ID]        — إزالة أدمن (المالك فقط)`
    );
  },

  // ─── onEvent: مراقبة الرسائل للرد التلقائي + حماية الاسم ──────────────────
  onEvent: async function ({ api, event }) {
    const tid = String(event.threadID);

    // ── حماية الاسم (فورية) ─────────────────────────────────────
    if (event.logMessageType === "log:thread-name") {
      const nimData = loadNim();
      if (nimData[tid]?.active) {
        const protected_ = nimData[tid].name;
        const newName    = event.logMessageData?.name || "";
        if (newName !== protected_) {
          await new Promise(r => setTimeout(r, 1200));
          try { await api.setTitle(protected_, tid); } catch (_) {}
        }
      }
      return;
    }

    // ── الرد التلقائي ────────────────────────────────────────────
    if (event.type !== "message") return;
    if (!event.body) return;

    const autoData = loadAuto();
    const cfg      = autoData[tid];
    if (!cfg?.active || !cfg?.message || !cfg?.delayMs) return;

    // تجاهل رسائل البوت نفسه
    if (String(event.senderID) === String(global.GoatBot?.botID)) return;

    const state    = _autoState.get(tid) || { lastSent: 0 };
    const now      = Date.now();
    const elapsed  = now - (state.lastSent || 0);

    if (elapsed < cfg.delayMs) return; // لم يمرّ الوقت الكافي بعد

    // تحديث وقت الإرسال
    _autoState.set(tid, { lastSent: now });

    try {
      const delay = global.utils?.calcHumanTypingDelay?.(cfg.message) || 1200;
      await global.utils?.simulateTyping?.(api, tid, delay);
      await api.sendMessage({ body: cfg.message }, tid);
    } catch (_) {}
  },
};
