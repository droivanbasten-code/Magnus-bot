/**
 * Magnus Bot — /nick — تغيير كنية الأعضاء
 * Copyright © 2025 DJAMEL
 */
"use strict";
const fs   = require("fs-extra");
const path = require("path");
const DATA = path.join(process.cwd(), "database/data/nickData.json");

function load() { try { return fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA,"utf8")) : {}; } catch(_){return {};} }
function save(d) { fs.ensureDirSync(path.dirname(DATA)); fs.writeFileSync(DATA,JSON.stringify(d,null,2)); }
function isAdmin(id) { return (global.GoatBot?.config?.adminBot||[]).map(String).includes(String(id)); }

module.exports = {
  config: {
    name: "nick", aliases: ["nickname","كنية"], version: "2.0", author: "DJAMEL",
    countDown: 5, role: 2, category: "management",
    description: "تغيير كنية جميع الأعضاء باستمرار",
    guide: { en: "{pn} [اسم] — تفعيل\n{pn} off — إيقاف\n{pn} status — الحالة\n{pn} حدف — حذف الكنى" }
  },

  onStart: async function({ api, event, args, message }) {
    const tid = event.threadID;
    if (!isAdmin(event.senderID)) return message.reply("⛔ للأدمن فقط.");
    const data = load();
    const sub  = (args[0] || "").toLowerCase();

    if (sub === "off") {
      if (data[tid]) { data[tid].active = false; save(data); }
      return message.reply("✅ تم إيقاف Nick.");
    }

    if (sub === "status") {
      const td = data[tid];
      if (!td?.active) return message.reply("💤 Nick غير مفعل.");
      return message.reply(`✅ Nick نشط\n📝 الاسم: "${td.name}"`);
    }

    if (sub === "حدف" || sub === "حذف") {
      try {
        const info = await new Promise((res,rej) => api.getThreadInfo(tid, (e,d) => e?rej(e):res(d)));
        const members = info?.participantIDs || [];
        let done = 0;
        for (const uid of members) {
          try { await api.changeNickname("", tid, uid); done++; await new Promise(r=>setTimeout(r,500)); } catch(_) {}
        }
        return message.reply(`✅ تم حذف كنية ${done} عضو.`);
      } catch(e) { return message.reply("❌ " + e.message); }
    }

    const nickName = args.join(" ").trim();
    if (!nickName) return message.reply("❗ أدخل اسم الكنية.\nمثال: /nick أعضاء Magnus");

    try {
      const info = await new Promise((res,rej) => api.getThreadInfo(tid, (e,d) => e?rej(e):res(d)));
      const members = info?.participantIDs || [];
      let done = 0;
      for (const uid of members) {
        try { await api.changeNickname(nickName, tid, uid); done++; await new Promise(r=>setTimeout(r,600)); } catch(_) {}
      }
      data[tid] = { active: true, name: nickName };
      save(data);
      message.reply(`✅ تم تغيير كنية ${done} عضو إلى "${nickName}"`);
    } catch(e) { message.reply("❌ " + e.message); }
  }
};
