/**
 * Magnus Bot — /nm — قفل اسم الغروب
 * Copyright © 2025 DJAMEL
 */
"use strict";
const fs   = require("fs-extra");
const path = require("path");
const DATA = path.join(process.cwd(), "database/data/nmData.json");

function load() { try { return fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA,"utf8")) : {}; } catch(_){return {};} }
function save(d) { fs.ensureDirSync(path.dirname(DATA)); fs.writeFileSync(DATA,JSON.stringify(d,null,2)); }
function isAdmin(id) { return (global.GoatBot?.config?.adminBot||[]).map(String).includes(String(id)); }

if (!global.GoatBot) global.GoatBot = {};
if (!global.GoatBot.nmLocks) global.GoatBot.nmLocks = new Map();

function scheduleNameChange(api, tid, name, minMs, maxMs) {
  const existing = global.GoatBot.nmLocks.get(tid);
  if (existing) clearTimeout(existing);
  const ms = minMs + Math.random() * (maxMs - minMs);
  const timer = setTimeout(async () => {
    try {
      const data = load();
      if (!data[tid]?.active) return;
      await api.setTitle(data[tid].name, tid);
    } catch(_) {}
    const d = load();
    if (d[tid]?.active) scheduleNameChange(api, tid, d[tid].name, d[tid].minMs||60000, d[tid].maxMs||120000);
  }, ms);
  global.GoatBot.nmLocks.set(tid, timer);
}

module.exports = {
  config: {
    name: "nm", aliases: ["اسم","name-lock"], version: "2.0", author: "DJAMEL",
    countDown: 3, role: 2, category: "management",
    description: "قفل اسم الغروب تلقائياً",
    guide: { en: "{pn} [اسم] — قفل\n{pn} off — فك القفل\n{pn} time [min] [max] — ضبط الوقت (ثواني)\n{pn} status" }
  },

  onStart: async function({ api, event, args, message }) {
    const tid = event.threadID;
    if (!isAdmin(event.senderID)) return message.reply("⛔ للأدمن فقط.");
    const data = load();
    const sub  = (args[0] || "").toLowerCase();

    if (sub === "off") {
      const t = global.GoatBot.nmLocks.get(tid);
      if (t) { clearTimeout(t); global.GoatBot.nmLocks.delete(tid); }
      if (data[tid]) { data[tid].active = false; save(data); }
      return message.reply("✅ تم فك قفل اسم الغروب.");
    }

    if (sub === "status") {
      const td = data[tid];
      if (!td?.active) return message.reply("💤 Name Lock غير مفعل.");
      return message.reply(`✅ مفعل\n📝 الاسم: "${td.name}"\n⏱ ${td.minMs/1000}–${td.maxMs/1000}s`);
    }

    if (sub === "time") {
      const minS = parseInt(args[1]) || 60;
      const maxS = Math.max(parseInt(args[2]) || minS, minS);
      if (data[tid]) {
        data[tid].minMs = minS * 1000;
        data[tid].maxMs = maxS * 1000;
        save(data);
        if (data[tid].active) scheduleNameChange(api, tid, data[tid].name, data[tid].minMs, data[tid].maxMs);
      }
      return message.reply(`✅ تم ضبط الوقت: ${minS}–${maxS} ثانية`);
    }

    const name = args.join(" ").trim();
    if (!name) return message.reply("❗ أدخل اسم الغروب.\nمثال: /nm Magnus Bot");

    data[tid] = { active: true, name, minMs: 60000, maxMs: 120000 };
    save(data);
    try { await api.setTitle(name, tid); } catch(_) {}
    scheduleNameChange(api, tid, name, 60000, 120000);
    message.reply(`✅ تم قفل اسم الغروب: "${name}"\n🔒 سيعاد التعيين تلقائياً كل دقيقة تقريباً`);
  },

  onEvent: async function({ api, event }) {
    if (event.logMessageType !== "log:thread-name") return;
    const tid  = String(event.threadID);
    const data = load();
    if (!data[tid]?.active) return;
    const currentName = event.logMessageData?.name || "";
    if (currentName === data[tid].name) return;
    try { await api.setTitle(data[tid].name, tid); } catch(_) {}
  }
};
