/*
 * Bahrain NOTAM bulletin (PIB) — fetches the raw PDF via /proxy/notam (same
 * byte-proxy pattern as bulletin.js) and parses it client-side with
 * pdf-lite.js (no Worker, no WASM — pdf.js's Worker hung silently on some
 * mobile browsers instead of failing cleanly). This source is Bahrain's
 * official "Daily PIB" — but it has been observed to sit unrefreshed for
 * weeks at a time despite the "Daily" label, so this module always
 * surfaces the bulletin's own generation timestamp prominently instead of
 * implying it's live.
 */

import { extractPdfText } from "./pdf-lite.js?v=2";
import { withTimeout, stalenessClass } from "./shared.js?v=3";

const PDF_PROXY_URL = "/proxy/notam";
const REFRESH_MS = 5 * 60 * 1000;
const LOAD_TIMEOUT_MS = 20000;
const RETRY_PAUSE_MS = 1500;
const INITIAL_LOAD_STAGGER_MS = 400; // staggered after bulletin.js so first-load fetches don't all fire at once
const STALE_AFTER_H = 24;
const VERY_STALE_AFTER_H = 72;

const SECTION_TITLES = new Set([
  "AERODROME INFORMATION",
  "SUPRA-REGIONAL EN-ROUTE INFORMATION",
  "REGIONAL EN-ROUTE INFORMATION",
  "SUPRA-REGIONAL NAV WARNINGS",
  "REGIONAL NAV WARNINGS",
]);
const CATEGORY_LABELS = new Set(["INFO", "WARN", "AGA", "ATM"]);
const CATEGORY_ORDER = { WARN: 0, INFO: 1, ATM: 2, AGA: 3 };
const NIL_PRODUCTS = /^(METAR|TAF|SNOWTAM|BIRDTAM|SIGMET|AIRMET|CYCLONE|VOLCANIC|ASHTAM)\s+NIL$/;
const AIRPORT_HDR = /^([A-Z]{4})\s*-\s*(.+?)\s*\(([A-Z]+)\)$/;
const FIR_HDR = /^([A-Z]{4})\s*-\s*([A-Z ]+)$/;
const NOTAM_ID_LINE = /^([A-Z]{4}\s+[A-Z]\d{4}\/\d{2})(?:\s+REPLACED BY\s+([A-Z]{4}\s+[A-Z]\d{4}\/\d{2}))?$/;
const FROM_TO = /^FROM:\s*(\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s+TO:\s*(\d{2}-\d{2}-\d{2})\s+(\d{2}:\d{2})\s*(EST)?$/;
const PAGE_FOOTER = /^\S+ \S+ \d+ \d{4}, .*Page \d+ of \d+$/;

let lastResult = null; // { systemTime: isoString|null, notams: [...] } | null

function bahrainIsoFromParts(yy, mm, dd, hh, min) {
  const year = 2000 + parseInt(yy, 10);
  return `${year}-${mm}-${dd}T${hh}:${min}:00+03:00`;
}

function parsePib(rawTextIn) {
  // pdf.js sometimes misses hasEOL right at a page break, gluing the next
  // page's "Special Area Briefing" header onto the previous line (e.g.
  // "...23:59 ESTSpecial Area Briefing"). Force a line break there so the
  // page-footer stripping below can isolate and remove it as intended.
  const rawText = rawTextIn.replace(/Special Area Briefing/g, "\nSpecial Area Briefing");
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && l !== "Special Area Briefing" && !PAGE_FOOTER.test(l));

  const sysM = rawText.match(/SYSTEM TIME:\s*(\d{2})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})/);
  const systemTime = sysM ? bahrainIsoFromParts(sysM[1], sysM[2], sysM[3], sysM[4], sysM[5]) : null;

  const notams = [];
  let currentSection = null;
  let currentScope = null;
  let currentCategory = null;
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (SECTION_TITLES.has(line)) {
      currentSection = line;
      currentCategory = null;
      i++;
      continue;
    }
    if (line === "NOTAM") {
      i++;
      continue;
    }
    if (CATEGORY_LABELS.has(line)) {
      currentCategory = line;
      i++;
      continue;
    }
    if (NIL_PRODUCTS.test(line)) {
      i++;
      continue;
    }
    const mAp = line.match(AIRPORT_HDR);
    if (mAp) {
      currentScope = { icao: mAp[1], name: mAp[2], role: mAp[3] };
      currentCategory = null;
      i++;
      continue;
    }
    const mFir = line.match(FIR_HDR);
    if (mFir && !SECTION_TITLES.has(mFir[2].trim())) {
      currentScope = { icao: mFir[1], name: mFir[2].trim(), role: "FIR" };
      currentCategory = null;
      i++;
      continue;
    }
    const mId = line.match(NOTAM_ID_LINE);
    if (mId && i + 1 < lines.length && FROM_TO.test(lines[i + 1])) {
      const id = mId[1];
      const replacedBy = mId[2] || null;
      const mFt = lines[i + 1].match(FROM_TO);
      const toMatch = mFt[3];
      const toTime = mFt[4];
      i += 2;
      const bodyLines = [];
      while (i < lines.length) {
        const nxt = lines[i];
        if (NOTAM_ID_LINE.test(nxt) && i + 1 < lines.length && FROM_TO.test(lines[i + 1])) break;
        if (SECTION_TITLES.has(nxt) || CATEGORY_LABELS.has(nxt) || nxt === "NOTAM" || AIRPORT_HDR.test(nxt) || NIL_PRODUCTS.test(nxt)) break;
        if (nxt === "---END OF DOCUMENT---") break;
        bodyLines.push(nxt);
        i++;
      }
      const body = bodyLines.join(" ");
      const eM = body.match(/E\)\s*(.*?)(?:\s*F\)|$)/);
      const dM = body.match(/D\)\s*(.*?)(?:\s*E\)|$)/);

      notams.push({
        id,
        replacedBy,
        section: currentSection,
        scope: currentScope,
        category: currentCategory,
        from: `${bahrainIsoFromParts(mFt[1].slice(0, 2), mFt[1].slice(3, 5), mFt[1].slice(6, 8), mFt[2].slice(0, 2), mFt[2].slice(3, 5))}`,
        to: `${bahrainIsoFromParts(toMatch.slice(0, 2), toMatch.slice(3, 5), toMatch.slice(6, 8), toTime.slice(0, 2), toTime.slice(3, 5))}`,
        schedule: dM ? dM[1].trim() : null,
        text: eM ? eM[1].trim() : body,
      });
      continue;
    }
    i++;
  }

  const seen = new Set();
  const deduped = [];
  for (const n of notams) {
    if (seen.has(n.id)) continue;
    seen.add(n.id);
    deduped.push(n);
  }

  return { systemTime, notams: deduped };
}

function fmtDate(iso) {
  if (!iso) return "--";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)} ${iso.slice(11, 16)}`;
}

function renderFreshness() {
  const el = document.getElementById("notam-freshness");
  if (!el) return;
  const t = window.t;

  if (!lastResult || !lastResult.systemTime) {
    el.className = "notam-freshness very-stale";
    el.textContent = t("notamFetchFailed");
    return;
  }

  const ageMs = Date.now() - new Date(lastResult.systemTime).getTime();
  const ageHours = ageMs / 3600000;
  const cls = "notam-freshness" + stalenessClass(ageHours, STALE_AFTER_H, VERY_STALE_AFTER_H);

  const days = Math.floor(ageHours / 24);
  const hours = Math.floor(ageHours % 24);
  const ageStr = days > 0 ? `${days}d ${hours}h` : `${hours}h`;

  el.className = cls;
  el.textContent = `${t("notamFresh")}: ${fmtDate(lastResult.systemTime)} (${ageStr})`;
}

function renderList() {
  const listEl = document.getElementById("notam-list");
  if (!listEl) return;
  const t = window.t;

  if (!lastResult) {
    listEl.innerHTML = "";
    return;
  }

  const now = Date.now();
  const active = lastResult.notams
    .filter((n) => new Date(n.to).getTime() >= now)
    .sort((a, b) => {
      const pa = CATEGORY_ORDER[a.category] ?? 9;
      const pb = CATEGORY_ORDER[b.category] ?? 9;
      if (pa !== pb) return pa - pb;
      return new Date(a.to) - new Date(b.to);
    });

  if (active.length === 0) {
    listEl.innerHTML = `<p class="hint" style="margin:0">${t("notamNone")}</p>`;
    return;
  }

  listEl.innerHTML = active
    .map((n) => {
      const catCls = n.category === "WARN" ? " cat-warn" : "";
      const scopeLabel = n.scope ? (n.scope.role === "FIR" ? t("notamScopeFIR") : `${n.scope.icao} · ${t("notamScope" + n.scope.role) || n.scope.role}`) : "--";
      const catLabel = n.category ? t("notamCat" + n.category) || n.category : "--";
      return `<div class="notam-item${catCls}">
        <div class="notam-item-head">
          <span class="notam-scope">${scopeLabel} — ${catLabel}</span>
          <span class="notam-time">${fmtDate(n.from)} → ${fmtDate(n.to)}</span>
        </div>
        <div class="notam-id">${n.id}${n.replacedBy ? " → " + n.replacedBy : ""}</div>
        <div class="notam-text">${n.text}</div>
      </div>`;
    })
    .join("");
}

function render() {
  renderFreshness();
  renderList();
}

async function loadOnce() {
  const res = await withTimeout(fetch(PDF_PROXY_URL), LOAD_TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = await withTimeout(extractPdfText(buf), LOAD_TIMEOUT_MS);
  const parsed = parsePib(text);
  if (!parsed.systemTime) throw new Error("could not parse NOTAM PDF");
  lastResult = parsed;
}

async function load() {
  try {
    await loadOnce();
  } catch (err) {
    // This card's fetch runs alongside bulletin.js/heli.js on first page
    // load, so a slow/weak connection can time one of them out. One retry
    // after a short pause covers that case without masking a genuinely
    // broken source.
    try {
      await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
      await loadOnce();
    } catch (err2) {
      console.error("Failed to load NOTAM bulletin", err2);
    }
  }
  render();
}

document.addEventListener("langchange", render);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") load();
});
window.addEventListener("pageshow", load);

setTimeout(load, INITIAL_LOAD_STAGGER_MS);
setInterval(load, REFRESH_MS);
