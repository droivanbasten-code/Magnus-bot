/**
 * Magnus Bot — /song — البحث وتنزيل الأغاني من YouTube
 * Copyright © 2025 DJAMEL
 */
"use strict";
const fs   = require("fs-extra");
const path = require("path");
const os   = require("os");
const TMP  = path.join(os.tmpdir(), "magnus_song");
fs.ensureDirSync(TMP);

function isAdmin(id) { return (global.GoatBot?.config?.adminBot||[]).map(String).includes(String(id)); }

module.exports = {
  config: {
    name: "song", aliases: ["music","أغنية","موسيقى"], version: "2.0", author: "DJAMEL",
    countDown: 15, role: 2, category: "media",
    description: "البحث وتنزيل الأغاني من YouTube",
    guide: { en: "{pn} [اسم الأغنية أو رابط YouTube]" }
  },

  onStart: async function({ api, event, args, message }) {
    if (!isAdmin(event.senderID)) return message.reply("⛔ للأدمن فقط.");
    const query = args.join(" ").trim();
    if (!query) return message.reply("❗ اكتب اسم الأغنية.\nمثال: /song Maher Zain");

    message.react("🔍", event.messageID);
    const wait = await message.reply(`🔍 جاري البحث عن "${query}"…`);

    try {
      const ytSearch = require("yt-search");
      const results  = await ytSearch(query);
      const videos   = (results.videos || []).filter(v => v.duration?.seconds < 600).slice(0, 5);

      if (!videos.length) {
        api.unsendMessage(wait.messageID).catch(()=>{});
        message.react("❌", event.messageID);
        return message.reply(`❌ لم أجد نتائج لـ "${query}"`);
      }

      let body = `🎵 نتائج YouTube: "${query}"\n━━━━━━━━━━━━━━━━\n`;
      videos.forEach((v,i) => {
        body += `${i+1}. ${(v.title||"").slice(0,60)}\n`;
        body += `   ⏱ ${v.duration?.timestamp||"?"} | 👁 ${v.views?.toLocaleString()||"?"}\n\n`;
      });
      body += `اكتب رقم الأغنية (1-${videos.length})`;

      api.unsendMessage(wait.messageID).catch(()=>{});
      const listMsg = await message.reply(body);

      global.GoatBot.onReply.set(`song_${listMsg.messageID}`, {
        messageID: listMsg.messageID,
        author:    event.senderID,
        callback: async ({ api, event: replyEvent, message: replyMsg }) => {
          global.GoatBot.onReply.delete(`song_${listMsg.messageID}`);
          const choice = parseInt(replyEvent.body?.trim()) - 1;
          if (isNaN(choice) || choice < 0 || choice >= videos.length)
            return replyMsg.reply("❌ رقم غير صالح.");

          const video  = videos[choice];
          const dlWait = await replyMsg.reply(`⬇️ جاري تنزيل "${video.title?.slice(0,40)}"…`);
          const outPath = path.join(TMP, `song_${Date.now()}.mp3`);

          try {
            const ytdl = require("ytdl-core");
            const stream = ytdl(video.url, { quality: "lowestaudio", filter: "audioonly" });
            const writeStream = fs.createWriteStream(outPath);
            await new Promise((res, rej) => {
              stream.pipe(writeStream);
              stream.on("error", rej);
              writeStream.on("finish", res);
              writeStream.on("error", rej);
            });
            api.unsendMessage(dlWait.messageID).catch(()=>{});
            await api.sendMessage({
              body: `🎵 ${video.title?.slice(0,100)}\n⏱ ${video.duration?.timestamp} | 👤 ${video.author?.name||""}\n👑 Magnus Bot`,
              attachment: fs.createReadStream(outPath)
            }, replyEvent.threadID);
            fs.removeSync(outPath);
          } catch(e) {
            api.unsendMessage(dlWait.messageID).catch(()=>{});
            replyMsg.reply("❌ فشل التنزيل: " + e.message);
            if (fs.existsSync(outPath)) fs.removeSync(outPath);
          }
        }
      });
    } catch(e) {
      try { api.unsendMessage(wait.messageID); } catch(_) {}
      message.react("❌", event.messageID);
      message.reply("❌ خطأ في البحث: " + e.message);
    }
  }
};
