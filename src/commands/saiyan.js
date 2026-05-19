"use strict";

const schedulers = new Map();
const lockedNames = new Map();

function parseTime(str) {
  if (!str) return null;
  const s = String(str).trim();
  const numMatch = s.match(/^(\d+)(د|دقيقة|دقائق|m|min)?$/i);
  if (!numMatch) return null;
  const val = parseInt(numMatch[1]);
  const unit = numMatch[2];
  if (unit) return val * 60 * 1000;
  return val * 1000;
}

module.exports = {
  config: {
    name: "سايان",
    version: "1.0",
    author: "DJAMEL",
    role: 2,
    description: "نظام Magnus X Saiyan الكامل",
    category: "system",
    countDown: 0,
  },

  onEvent: async ({ api, event }) => {
    if (event.type !== "event") return;
    const threadID = String(event.threadID);
    if (!lockedNames.has(threadID)) return;

    const newName =
      event.logMessageData?.name ||
      event.snippet ||
      null;

    const isNameChange =
      event.logMessageType === "log:thread-name" ||
      event.eventType    === "change_thread_name";

    if (!isNameChange || !newName) return;

    const locked = lockedNames.get(threadID);
    if (newName === locked) return;

    try {
      await new Promise(r => setTimeout(r, 1000));
      await api.setTitle(locked, threadID);
    } catch (_) {}
  },

  onStart: async ({ api, event, args, message }) => {
    const threadID = String(event.threadID);
    const sub = (args[0] || "").trim();

    if (!sub) {
      return message.reply(
        "╔══ Magnus X Saiyan ══╗\n" +
        "║ الأوامر المتاحة:\n" +
        "║\n" +
        "║ ! سايان اضافة [رسالة] [وقت]\n" +
        "║   مثال: ! سايان اضافة مرحبا 30\n" +
        "║   (الوقت بالثواني، أو أضف «د» للدقائق)\n" +
        "║\n" +
        "║ ! سايان تشغيل\n" +
        "║   يبدأ إرسال الرسالة تلقائياً\n" +
        "║\n" +
        "║ ! سايان ايقاف\n" +
        "║   يوقف الإرسال التلقائي\n" +
        "║\n" +
        "║ ! سايان ابتيم\n" +
        "║   حالة البوت كاملة\n" +
        "║\n" +
        "║ ! سايان nm [اسم الغروب]\n" +
        "║   يغير الاسم ويحميه تلقائياً\n" +
        "║\n" +
        "║ ! سايان unm\n" +
        "║   يوقف حماية اسم الغروب\n" +
        "╚═══════════════════════╝"
      );
    }

    // ─── اضافة ───
    if (sub === "اضافة") {
      if (args.length < 3) {
        return message.reply(
          "❌ الاستخدام الصحيح:\n" +
          "! سايان اضافة [الرسالة] [الوقت]\n\n" +
          "أمثلة:\n" +
          "! سايان اضافة مرحبا 30\n" +
          "! سايان اضافة صباح الخير 5د\n\n" +
          "الوقت بالثواني، أو أضف «د» للدقائق"
        );
      }
      const lastArg = args[args.length - 1];
      const ms = parseTime(lastArg);
      if (!ms || ms < 1000) {
        return message.reply("❌ الوقت غير صحيح.\nأدخل رقم ثوانٍ مثل: 30\nأو دقائق مثل: 5د");
      }
      const msg = args.slice(1, -1).join(" ").trim();
      if (!msg) {
        return message.reply("❌ أدخل الرسالة.\nمثال: ! سايان اضافة مرحبا 30");
      }

      global._saiyanPending = global._saiyanPending || new Map();
      global._saiyanPending.set(threadID, { message: msg, ms });

      const sec = Math.round(ms / 1000);
      const display = sec >= 60 ? `${Math.round(sec/60)} دقيقة` : `${sec} ثانية`;
      return message.reply(
        "✅ تم ضبط الرسالة بنجاح!\n\n" +
        `📝 الرسالة: "${msg}"\n` +
        `⏱ الوقت: كل ${display}\n\n` +
        "اكتب: ! سايان تشغيل للبدء"
      );
    }

    // ─── تشغيل ───
    if (sub === "تشغيل") {
      const pending = global._saiyanPending?.get(threadID);
      if (!pending) {
        return message.reply(
          "❌ لم تحدد رسالة بعد.\n" +
          "استخدم أولاً: ! سايان اضافة [رسالة] [وقت]"
        );
      }
      if (schedulers.has(threadID)) {
        clearInterval(schedulers.get(threadID).timer);
      }
      const timer = setInterval(() => {
        api.sendMessage(pending.message, threadID).catch(() => {});
      }, pending.ms);

      schedulers.set(threadID, { timer, message: pending.message, ms: pending.ms });

      const sec = Math.round(pending.ms / 1000);
      const display = sec >= 60 ? `${Math.round(sec/60)} دقيقة` : `${sec} ثانية`;
      return message.reply(
        "▶️ بدأ الإرسال التلقائي!\n\n" +
        `📝 الرسالة: "${pending.message}"\n` +
        `⏱ كل ${display}\n\n` +
        "لإيقافه: ! سايان ايقاف"
      );
    }

    // ─── ايقاف / حددته ───
    if (sub === "ايقاف" || sub === "حددته" || sub === "وقف" || sub === "stop") {
      if (!schedulers.has(threadID)) {
        return message.reply("⚠️ لا يوجد إرسال تلقائي نشط الآن");
      }
      clearInterval(schedulers.get(threadID).timer);
      schedulers.delete(threadID);
      return message.reply("⏹ تم إيقاف الإرسال التلقائي بنجاح");
    }

    // ─── ابتيم ───
    if (sub === "ابتيم" || sub === "uptime") {
      const startTime = global.GoatBot?.startTime || Date.now();
      const upMs = Date.now() - startTime;
      const totalSec = Math.floor(upMs / 1000);
      const days  = Math.floor(totalSec / 86400);
      const hours = Math.floor((totalSec % 86400) / 3600);
      const mins  = Math.floor((totalSec % 3600) / 60);
      const secs  = totalSec % 60;

      let uptimeStr = "";
      if (days)  uptimeStr += `${days}ي `;
      if (hours) uptimeStr += `${hours}س `;
      uptimeStr += `${mins}د ${secs}ث`;

      const online  = !!global.GoatBot?.fcaApi && !!global.GoatBot?.botID;
      const mem     = process.memoryUsage();
      const memMB   = (mem.heapUsed / 1048576).toFixed(1);
      const cmdCount = global.GoatBot?.commands?.size || 0;
      const uid     = global.GoatBot?.botID || "—";
      const prefix  = global.GoatBot?.config?.prefix || "! ";
      const botName = global.GoatBot?.config?.botName || "Magnus X Saiyan";

      const pingStart = Date.now();
      try {
        await new Promise((res, rej) =>
          api.getUserInfo(uid, (e, d) => e ? rej(e) : res(d))
        );
      } catch (_) {}
      const ping = Date.now() - pingStart;

      const statusIcon = online ? "🟢" : "🔴";
      const statusText = online ? "متصل" : "غير متصل";

      const schedulerCount = schedulers.size;
      const nameProtCount  = lockedNames.size;

      return message.reply(
        `╔══ ${botName} ══╗\n` +
        `║ ${statusIcon} الحالة: ${statusText}\n` +
        `║ ⏱ وقت التشغيل: ${uptimeStr}\n` +
        `║ 🏓 البينغ: ${ping}ms\n` +
        `║ 💾 RAM: ${memMB} MB\n` +
        `║ 📦 الأوامر: ${cmdCount}\n` +
        `║ 🔑 UID: ${uid}\n` +
        `║ 🔤 البادئة: ${prefix}سايان\n` +
        `║ ▶️ مجدولات نشطة: ${schedulerCount}\n` +
        `║ 🔒 غروبات محمية: ${nameProtCount}\n` +
        `╚═══════════════════════╝`
      );
    }

    // ─── nm [اسم] ───
    if (sub === "nm") {
      const name = args.slice(1).join(" ").trim();
      if (!name) {
        return message.reply(
          "❌ أدخل اسم الغروب.\n" +
          "مثال: ! سايان nm اسم الغروب الجديد"
        );
      }
      try {
        await api.setTitle(name, threadID);
        lockedNames.set(threadID, name);
        return message.reply(
          `✅ تم تغيير اسم الغروب إلى:\n"${name}"\n\n` +
          "🔒 الحماية مفعّلة — أي عضو يغير الاسم سيتم إعادته تلقائياً\n\n" +
          "لإيقاف الحماية: ! سايان unm"
        );
      } catch (e) {
        return message.reply(`❌ فشل تغيير الاسم:\n${e.message}\n\nتأكد أن البوت أدمن في الغروب`);
      }
    }

    // ─── unm ───
    if (sub === "unm") {
      if (!lockedNames.has(threadID)) {
        return message.reply("⚠️ حماية الاسم غير مفعّلة في هذا الغروب");
      }
      const old = lockedNames.get(threadID);
      lockedNames.delete(threadID);
      return message.reply(
        `🔓 تم إيقاف حماية اسم الغروب\n` +
        `الاسم المحمي كان: "${old}"`
      );
    }

    return message.reply(
      `❓ أمر غير معروف: "${sub}"\n\n` +
      "اكتب: ! سايان\nلعرض قائمة الأوامر"
    );
  },
};
