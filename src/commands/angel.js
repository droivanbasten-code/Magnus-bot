/**
 * Magnus Bot — /angel — رسائل تلقائية دورية
 * Copyright © 2025 DJAMEL
 */
"use strict";
const fs   = require("fs-extra");
const path = require("path");
const DATA = path.join(process.cwd(), "database/data/angelData.json");

function load() { try { if(fs.existsSync(DATA)) return JSON.parse(fs.readFileSync(DATA,"utf8")); } catch(_){} return {}; }
function save(d) { fs.ensureDirSync(path.dirname(DATA)); fs.writeFileSync(DATA,JSON.stringify(d,null,2)); }
function isAdmin(id) { return (global.GoatBot?.config?.adminBot||[]).map(String).includes(String(id)); }

if (!global.GoatBot) global.GoatBot = {};
if (!global.GoatBot.angelIntervals) global.GoatBot.angelIntervals = {};

async function humanSend(api, tid, msg) {
  const delay = global.utils?.calcHumanTypingDelay?.(msg) || 1500;
  await global.utils?.simulateTyping?.(api, tid, delay);
  await api.sendMessage({ body: msg }, tid);
}

function scheduleNext(api, tid, td) {
  clearTimeout(global.GoatBot.angelIntervals[tid]);
  if (!td?.active || !td?.message) return;
  const minS = td.minSeconds ?? 60;
  const maxS = td.maxSeconds ?? minS;
  const ms   = Math.round((minS + Math.random()*(maxS-minS)) * 1000);
  global.GoatBot.angelIntervals[tid] = setTimeout(async () => {
    try { await humanSend(api, tid, td.message); } catch(_) {}
    const d = load(); if (d[tid]?.active) scheduleNext(api, tid, d[tid]);
  }, ms);
}

module.exports = {
  config: {
    name: "angel", aliases: ["أنجل"], version: "2.0", author: "DJAMEL",
    countDown: 3, role: 2, category: "management",
    description: "رسائل تلقائية دورية للغروبات",
    guide: { en: "{pn} [رسالة] [min] [max]\n{pn} off\n{pn} status" }
  },

  onStart: async function({ api, event, args, message }) {
    const tid = event.threadID;
    if (!isAdmin(event.senderID)) return message.reply("⛔ للأدمن فقط.");
    const data = load();
    const sub  = args[0]?.toLowerCase();

    if (!sub || sub === "status") {
      const td = data[tid];
      if (!td?.active) return message.reply("💤 Angel غير مفعل.");
      return message.reply(`✅ Angel نشط\n📝 "${td.message}"\n⏱ ${td.minSeconds}–${td.maxSeconds}s`);
    }

    if (sub === "off") {
      clearTimeout(global.GoatBot.angelIntervals[tid]);
      delete global.GoatBot.angelIntervals[tid];
      if (data[tid]) { data[tid].active = false; save(data); }
      return message.reply("✅ تم إيقاف Angel.");
    }

    const nums    = args.filter(a => /^\d+$/.test(a));
    const textParts = args.filter(a => !/^\d+$/.test(a) && a.toLowerCase() !== "on");
    const msg     = textParts.join(" ").trim() || data[tid]?.message || "🌸 مرحباً!";
    const minS    = parseInt(nums[0]) || 60;
    const maxS    = parseInt(nums[1]) || minS;

    data[tid] = { active: true, message: msg, minSeconds: minS, maxSeconds: Math.max(minS, maxS) };
    save(data);
    scheduleNext(api, tid, data[tid]);
    message.reply(`✅ تم تفعيل Angel\n📝 "${msg}"\n⏱ كل ${minS}–${Math.max(minS,maxS)} ثانية`);
  }
};
