/*
 * Bahrain public weather bulletin — fetches the raw PDF via /proxy/bulletin
 * (same-origin byte proxy, no parsing there) and extracts text client-side
 * with pdf-lite.js (no Worker, no WASM — pdf.js's Worker hung silently on
 * some mobile browsers instead of failing cleanly). Runs independently of
 * the main METAR/TAF flow in script.js (this bulletin isn't tied to
 * whichever ICAO is searched), mirroring how the Comms card is handled.
 */

import { extractPdfText } from "./pdf-lite.js?v=2";

const PDF_PROXY_URL = "/proxy/bulletin";
const REFRESH_MS = 5 * 60 * 1000;
const LOAD_TIMEOUT_MS = 20000;

let lastBulletin = null;

// Some mobile browsers silently fail to spin up pdf.js's Worker (module
// worker support gaps, CSP quirks, etc.), and getDocument() can then hang
// forever instead of rejecting — leaving the card blank with no error and
// no retry ever firing. Bound every attempt so a hang always turns into a
// visible failure instead of infinite silence.
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

function field(label, text) {
  const re = new RegExp("\\n" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\n([^\\n]+)");
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

function toCompactTime(s) {
  const m = s.match(/^(\d{1,2})(\d{2})(AM|PM)$/i);
  if (!m) return null;
  return to24h(parseInt(m[1], 10), parseInt(m[2], 10), m[3]);
}

function toColonTime(s) {
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  return to24h(parseInt(m[1], 10), parseInt(m[2], 10), m[3]);
}

function to24h(h, m, ampm) {
  const ap = ampm.toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return { h, m };
}

function isoBahrain(year, month, day, h, m) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(m)}:00+03:00`;
}

function parseBulletin(text) {
  const weather = field("Weather", text);
  const wind = field("Wind", text);
  const warning = field("Warning", text);
  const seaState = field("Sea State", text);

  const validM = text.match(
    /valid from (\d{3,4}(?:AM|PM)) on (\d{1,2}) (\d{1,2}) (\d{4})\s*\n?\s*until (\d{3,4}(?:AM|PM)) tomorrow/i
  );
  if (!weather || !wind || !warning || !seaState || !validM) return null;

  const [, fromTimeRaw, dayStr, monthStr, yearStr, untilTimeRaw] = validM;
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  const fromTime = toCompactTime(fromTimeRaw);
  const untilTime = toCompactTime(untilTimeRaw);
  if (!fromTime || !untilTime) return null;

  const validFrom = isoBahrain(year, month, day, fromTime.h, fromTime.m);
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const validUntil = isoBahrain(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    untilTime.h,
    untilTime.m
  );

  return { weather, wind, warning, seaState, validFrom, validUntil };
}

function fmtBulletinTime(iso) {
  if (!iso) return "--";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)}`;
}

function render() {
  const card = document.getElementById("bulletin-card");
  const tbody = document.querySelector("#bulletin-table tbody");
  const validityEl = document.getElementById("bulletin-validity");
  if (!card) return;

  const t = window.t;

  if (!lastBulletin) {
    card.className = "card notam-card";
    tbody.innerHTML = "";
    validityEl.textContent = t("bulletinFetchFailed");
    return;
  }

  const rows = [
    [t("bWeather"), lastBulletin.weather],
    [t("bWind"), lastBulletin.wind],
    [t("bWarning"), lastBulletin.warning],
    [t("bSeaState"), lastBulletin.seaState],
  ];
  tbody.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");

  const expired = Date.now() > new Date(lastBulletin.validUntil).getTime();
  card.className = "card notam-card" + (expired ? " sigmet-active" : "");

  validityEl.innerHTML =
    `${t("bulletinValidFrom")} ${fmtBulletinTime(lastBulletin.validFrom)} ${t("bulletinValidUntil")} ${fmtBulletinTime(lastBulletin.validUntil)} (${t("bulletinLocal")})` +
    (expired ? `<br>${t("bulletinExpired")}` : "");
}

async function loadOnce() {
  const res = await withTimeout(fetch(PDF_PROXY_URL), LOAD_TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = await withTimeout(extractPdfText(buf), LOAD_TIMEOUT_MS);
  const parsed = parseBulletin(text);
  if (!parsed) throw new Error("could not parse bulletin PDF");
  lastBulletin = parsed;
}

async function load() {
  try {
    await loadOnce();
  } catch (err) {
    // The first attempt on page load competes with the other PDF cards for
    // the same large pdf.js worker file, so a slow/weak connection can time
    // one of them out. One retry after a short pause covers that case
    // without masking a genuinely broken source; if both fail we keep
    // showing the last good bulletin (if any) rather than blanking it.
    try {
      await new Promise((r) => setTimeout(r, 1500));
      await loadOnce();
    } catch (err2) {
      console.error("Failed to load public weather bulletin", err2);
    }
  }
  render();
}

document.addEventListener("langchange", render);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") load();
});
window.addEventListener("pageshow", load);

load();
setInterval(load, REFRESH_MS);
