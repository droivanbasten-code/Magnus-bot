/**
 * Magnus Bot — /سايان — حماية اسم الغروب (Arabic command)
 * Usage:
 *   ! سايان نيم [اسم]   → تفعيل الحماية
 *   ! سايان ايقاف نيم   → إيقاف الحماية
 * Copyright © 2025 DJAMEL
 */
"use strict";

const fs   = require("fs-extra");
const path = require("path");

const DATA = path.join(process.cwd(), "database/data/sayanNim.json");

function load() {
  try { return fs.existsSync(DATA) ? JSON.parse(fs.readFileSync(DATA, "utf8")) : {}; }
  catch (_) { return {}; }
}
function save(d) {
  fs.ensureDirSync(path.dirname(DATA));
  fs.writeFileSync(DATA, JSON.stringify(d, null, 2));
}
function isAdmin(id) {
  const cfg = global.GoatBot?.config || {};
  const sid = String(id);
  const all = [
    cfg.ownerID,
    ...(cfg.superAdminBot || []),
    ...(cfg.adminBot || []),
  ].filter(Boolean).map(String);
  return all.includes(sid);
}

// Active timers: tid → timeout handle
const _timers = new Map();

function clearTimer(tid) {
  if (_timers.has(tid)) {
    clearTimeout(_timers.get(tid));
    _timers.delete(tid);
  }
}

function scheduleCheck(api, tid, name) {
  clearTimer(tid);
  // Check every 3–7 seconds (randomized to look human)
  const ms = 3000 + Math.floor(Math.random() * 4000);
  const handle = setTimeout(async () => {
    try {
      const data = load();
      if (!data[tid]?.active) return; // protection disabled

      // Get current thread name
      const info = await new Promise((res, rej) =>
        api.getThreadInfo(tid, (e, d) => (e ? rej(e) : res(d)))
      );
      const currentName = info?.threadName || info?.name || "";

      if (currentName !== name) {
        // Name was changed — restore it
        await api.setTitle(name, tid);
      }
    } catch (_) {}

    // Reschedule
    const d = load();
    if (d[tid]?.active) scheduleCheck(api, tid, d[tid].name);
  }, ms);

  _timers.set(tid, handle);
}

module.exports = {
  config: {
    name: "سايان",
    aliases: ["sayan"],
    version: "1.0",
    author: "DJAMEL",
    countDown: 3,
    role: 2,
    category: "management",
    description: "حماية اسم الغروب — يُعيد الاسم تلقائياً إذا غيّره أحد",
    guide: {
      en: "{pn} نيم [الاسم] — تفعيل الحماية\n{pn} ايقاف نيم — إيقاف الحماية",
    },
  },

  onStart: async function ({ api, event, args, message }) {
    if (!isAdmin(event.senderID)) {
      return message.reply("⛔ هذا الأمر للأدمن فقط.");
    }

    const tid  = String(event.threadID);
    const data = load();
    const sub1 = (args[0] || "").trim();
    const sub2 = (args[1] || "").trim();

    // ─── ! سايان ايقاف نيم ──────────────────────────────────────
    if (sub1 === "ايقاف" && sub2 === "نيم") {
      clearTimer(tid);
      if (data[tid]) { data[tid].active = false; save(data); }
      return message.reply(
        "✅ تم إيقاف حماية اسم الغروب.\n" +
        "يمكن لأي شخص تغيير الاسم الآن."
      );
    }

    // ─── ! سايان نيم [اسم] ──────────────────────────────────────
    if (sub1 === "نيم") {
      const name = args.slice(1).join(" ").trim();
      if (!name) {
        return message.reply(
          "❗ اكتب الاسم الذي تريد تثبيته.\n" +
          "مثال: ! سايان نيم Magnus Bot"
        );
      }

      // Set the name immediately
      try {
        await api.setTitle(name, tid);
      } catch (e) {
        return message.reply("❌ فشل تغيير الاسم: " + e.message);
      }

      data[tid] = { active: true, name };
      save(data);

      // Start the watcher
      scheduleCheck(api, tid, name);

      return message.reply(
        `🔒 تم تفعيل حماية اسم الغروب!\n` +
        `📝 الاسم المحمي: ${name}\n\n` +
        `إذا غيّر أي شخص الاسم، سيعود تلقائياً.\n` +
        `لإيقافه: ! سايان ايقاف نيم`
      );
    }

    // ─── مساعدة ──────────────────────────────────────────────────
    return message.reply(
      "📌 طريقة الاستخدام:\n" +
      "! سايان نيم [الاسم] — تفعيل الحماية\n" +
      "! سايان ايقاف نيم — إيقاف الحماية"
    );
  },

  // ─── مراقبة أحداث تغيير الاسم (استجابة فورية) ────────────────
  onEvent: async function ({ api, event }) {
    if (event.logMessageType !== "log:thread-name") return;

    const tid  = String(event.threadID);
    const data = load();
    if (!data[tid]?.active) return;

    const protectedName = data[tid].name;
    const newName       = event.logMessageData?.name || "";

    if (newName === protectedName) return; // no change needed

    // Restore immediately
    try {
      await new Promise(r => setTimeout(r, 1500)); // slight delay
      await api.setTitle(protectedName, tid);
    } catch (_) {}
  },
};
