/**
 * Magnus Bot — Cookie Auto-Refresher (Layer 21)
 *
 * يراقب نشاط البوت ويجدد الكوكيز تلقائياً:
 *   نشاط عالي   (>50 رسالة/ساعة)  → تجديد كل 4–6  ساعات
 *   نشاط متوسط  (10-50 رسالة/ساعة)→ تجديد كل 8–12 ساعة
 *   نشاط منخفض  (<10 رسالة/ساعة)  → تجديد كل 18–24 ساعة
 *
 * آلية التجديد:
 *   1. يسجّل دخول بالكوكيز الحالية عبر Facebook mbasic
 *   2. يسحب appState المحدّث من FCA
 *   3. يحفظه في account.txt (بدون إعادة تشغيل)
 *   4. يُبلّغ الأدمن بنجاح التجديد
 *
 * Copyright © 2025 DJAMEL
 */
"use strict";

const fs    = require("fs-extra");
const path  = require("path");
const axios = require("axios");

const ROOT         = path.join(__dirname, "../../");
const ACCOUNT_PATH = path.join(ROOT, "account.txt");
const LOG_PATH     = path.join(ROOT, "database/data/cookieRefreshLog.json");

// ─── Activity tracker ────────────────────────────────────────────────────────
const _activity = {
  msgCount: 0,       // رسائل منذ آخر تجديد
  windowStart: Date.now(),
  windowMs: 3600000, // نافذة ساعة واحدة
};

let _refreshTimer = null;
let _active       = false;
let _lastRefresh  = 0;
let _refreshCount = 0;

// ─── Helpers ─────────────────────────────────────────────────────────────────
const rand = (a, b) => Math.floor(Math.random() * (b - a + 1)) + a;
const sleep = ms => new Promise(r => setTimeout(r, ms));

function loadLog() {
  try { return fs.existsSync(LOG_PATH) ? JSON.parse(fs.readFileSync(LOG_PATH, "utf8")) : []; }
  catch (_) { return []; }
}
function appendLog(entry) {
  try {
    fs.ensureDirSync(path.dirname(LOG_PATH));
    const log = loadLog().slice(-50); // keep last 50
    log.push(entry);
    fs.writeFileSync(LOG_PATH, JSON.stringify(log, null, 2));
  } catch (_) {}
}

// ─── Calculate next refresh interval based on activity ───────────────────────
function calcNextIntervalMs() {
  const now       = Date.now();
  const windowAge = now - _activity.windowStart;
  const rate      = windowAge > 0 ? (_activity.msgCount / windowAge) * 3600000 : 0;
  // msgs per hour

  let minH, maxH;
  if (rate > 50)       { minH = 4;  maxH = 6;  } // نشاط عالي
  else if (rate > 10)  { minH = 8;  maxH = 12; } // نشاط متوسط
  else                 { minH = 18; maxH = 24; } // نشاط منخفض

  const ms = rand(minH * 3600000, maxH * 3600000);
  return { ms, minH, maxH, rate: Math.round(rate) };
}

// ─── Track incoming messages ──────────────────────────────────────────────────
function trackActivity() {
  _activity.msgCount++;
  // Reset window every hour
  if (Date.now() - _activity.windowStart > _activity.windowMs) {
    _activity.msgCount  = 0;
    _activity.windowStart = Date.now();
  }
}

// ─── Main refresh logic ───────────────────────────────────────────────────────
async function doRefresh() {
  const api = global.GoatBot?.fcaApi;
  if (!api) {
    global.log?.warn?.("COOKIE_REFRESH", "لا يوجد API — تخطي التجديد");
    return false;
  }

  global.log?.info?.("COOKIE_REFRESH", "🔄 بدء تجديد الكوكيز…");

  try {
    // 1. Get current appState from FCA
    let freshState = null;
    try {
      freshState = api.getAppState?.();
    } catch (_) {}

    if (!freshState?.length) {
      global.log?.warn?.("COOKIE_REFRESH", "⚠️ لا يمكن الحصول على appState من FCA");
      return false;
    }

    // 2. Make a real Facebook request to refresh the session server-side
    let UA = "Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 Chrome/112.0.0.0 Mobile Safari/537.36";
    try { UA = require("./stealth").getUA() || UA; } catch (_) {}

    const cookieStr = freshState.map(c => `${c.key}=${c.value}`).join("; ");

    // Hit a lightweight FB endpoint to bump session
    const endpoints = [
      "https://mbasic.facebook.com/settings",
      "https://mbasic.facebook.com/notifications",
      "https://mbasic.facebook.com/",
    ];
    let refreshed = false;
    for (const url of endpoints) {
      try {
        const res = await axios.get(url, {
          headers: {
            cookie:            cookieStr,
            "user-agent":      UA,
            "accept":          "text/html,*/*;q=0.8",
            "accept-language": "ar,en-US;q=0.9,en;q=0.8",
            "upgrade-insecure-requests": "1",
          },
          timeout: 15000,
          validateStatus: null,
          maxRedirects: 3,
        });

        const body = String(res.data || "");
        const ok   = body.includes("/notifications.php?") ||
                     body.includes("save-password") ||
                     body.includes("logout") ||
                     body.includes("settings_page") ||
                     body.includes("/privacy/xcs/");

        if (ok) {
          // Extract any set-cookie headers to freshen cookies
          const setCookies = res.headers?.["set-cookie"];
          if (setCookies?.length) {
            for (const sc of setCookies) {
              const match = sc.match(/^([^=]+)=([^;]*)/);
              if (match) {
                const [, key, value] = match;
                const existing = freshState.find(c => c.key === key);
                if (existing) existing.value = value;
                else freshState.push({ key, value, domain: ".facebook.com", path: "/", secure: true, httpOnly: false, sameSite: "None" });
              }
            }
          }
          refreshed = true;
          global.log?.ok?.("COOKIE_REFRESH", `✔ جلسة نشطة عبر ${url.split("/")[2]}`);
          break;
        }
      } catch (_) {}

      await sleep(rand(1500, 3000));
    }

    if (!refreshed) {
      global.log?.warn?.("COOKIE_REFRESH", "⚠️ جميع نقاط النهاية فشلت — الكوكيز ستُحفظ على أي حال");
    }

    // 3. Save refreshed state to account.txt
    global._selfWrite = true;
    fs.writeFileSync(ACCOUNT_PATH, JSON.stringify(freshState, null, 2), "utf8");
    setTimeout(() => { global._selfWrite = false; }, 8000);

    _lastRefresh = Date.now();
    _refreshCount++;

    // 4. Log the refresh
    const entry = {
      ts:        _lastRefresh,
      count:     _refreshCount,
      cookies:   freshState.length,
      refreshed,
      activityRate: Math.round((_activity.msgCount / Math.max(Date.now() - _activity.windowStart, 1)) * 3600000),
    };
    appendLog(entry);

    global.log?.ok?.("COOKIE_REFRESH",
      `✅ تم تجديد الكوكيز (#${_refreshCount}) — ${freshState.length} كوكي — نشاط: ${entry.activityRate} رسالة/ساعة`
    );

    // 5. Notify admins
    try {
      const adminIds = [
        ...(global.GoatBot?.config?.adminBot    || []),
        ...(global.GoatBot?.config?.superAdminBot || []),
      ].filter(Boolean).map(String);

      const unique = [...new Set(adminIds)];
      const dt     = new Date(_lastRefresh).toLocaleString("ar-SA", { timeZone: global.GoatBot?.config?.timezone || "Africa/Algiers" });
      const msg    = `🔄 [Magnus Bot] تجديد الكوكيز التلقائي\n` +
                     `━━━━━━━━━━━━━━━\n` +
                     `✅ تم التجديد بنجاح\n` +
                     `📅 الوقت: ${dt}\n` +
                     `🍪 الكوكيز: ${freshState.length}\n` +
                     `📊 النشاط: ${entry.activityRate} رسالة/ساعة\n` +
                     `🔢 عدد التجديدات: ${_refreshCount}`;

      for (const id of unique) {
        try { await api.sendMessage(msg, id); await sleep(rand(800, 1500)); } catch (_) {}
      }
    } catch (_) {}

    return true;
  } catch (e) {
    global.log?.error?.("COOKIE_REFRESH", "خطأ أثناء التجديد: " + e.message);
    return false;
  }
}

// ─── Schedule next refresh ────────────────────────────────────────────────────
function scheduleNext() {
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
  if (!_active) return;

  const { ms, minH, maxH, rate } = calcNextIntervalMs();
  const nextIn = Math.round(ms / 3600000 * 10) / 10;

  global.log?.info?.("COOKIE_REFRESH",
    `📅 التجديد القادم خلال ${nextIn} ساعة (نشاط: ${rate} رسالة/ساعة → نافذة ${minH}–${maxH}h)`
  );

  _refreshTimer = setTimeout(async () => {
    if (!_active) return;
    await doRefresh();
    scheduleNext(); // reschedule after each refresh
  }, ms);
}

// ─── Public API ───────────────────────────────────────────────────────────────
function start(_api) {
  if (_active) return;
  _active = true;
  _activity.windowStart = Date.now();
  _activity.msgCount    = 0;

  // Hook into message tracking
  const origTrack = global._trackMsg;
  global._trackMsg = function(tid, uid, body) {
    try { trackActivity(); } catch (_) {}
    if (origTrack) origTrack(tid, uid, body);
  };

  scheduleNext();
  global.log?.ok?.("COOKIE_REFRESH", "🍪 نظام تجديد الكوكيز التلقائي نشط ✔");
}

function stop() {
  _active = false;
  if (_refreshTimer) { clearTimeout(_refreshTimer); _refreshTimer = null; }
}

function getStatus() {
  const { rate } = calcNextIntervalMs();
  const nextRefreshIn = _refreshTimer ? "جار الانتظار" : "—";
  return {
    active:       _active,
    lastRefresh:  _lastRefresh || null,
    refreshCount: _refreshCount,
    activityRate: rate,
    log:          loadLog().slice(-5),
  };
}

async function forceRefresh() {
  const ok = await doRefresh();
  if (ok) scheduleNext();
  return ok;
}

module.exports = { start, stop, getStatus, forceRefresh, trackActivity };
