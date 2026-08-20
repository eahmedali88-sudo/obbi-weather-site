/*
 * Bahrain Helicopter Ops / Local Area Forecast — fetches the raw PDF via
 * /proxy/heli (same byte-proxy pattern as bulletin.js/notam.js) and parses
 * it client-side with pdf-lite.js (no Worker, no WASM — pdf.js's Worker
 * hung silently on some mobile browsers instead of failing cleanly).
 */

import { extractPdfText } from "./pdf-lite.js?v=2";
import { withTimeout, stalenessClass } from "./shared.js?v=4";

const PDF_PROXY_URL = "/proxy/heli";
const REFRESH_MS = 5 * 60 * 1000;
const LOAD_TIMEOUT_MS = 20000;
const RETRY_PAUSE_MS = 1500;
const INITIAL_LOAD_STAGGER_MS = 800; // staggered after bulletin.js/notam.js so first-load fetches don't all fire at once
const STALE_AFTER_H = 6;
const VERY_STALE_AFTER_H = 12;

let lastForecast = null;

function isoUtc(year, month, day, hh, mm) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hh)}:${pad(mm)}:00Z`;
}

function decodeWind(w) {
  if (/^VRB/i.test(w)) return { dir: "VRB", speed: w.slice(3) };
  const m = w.match(/^(\d{3})(\d{2,3})$/);
  if (!m) return { dir: w, speed: "" };
  return { dir: `${m[1]}°`, speed: m[2] };
}

function decodeTemp(sign, val) {
  const n = parseInt(val, 10);
  return sign === "MS" ? `-${n}` : `+${n}`;
}

function parseForecast(text) {
  const validM = text.match(
    /Valid from (\d{2}:\d{2}) UTC on (\d{2})\/(\d{2})\/(\d{4}) to (\d{2}:\d{2}) UTC on (\d{2})\/(\d{2})\/(\d{4})/
  );
  const synopsisM = text.match(/Synopsis:\s*(.+)/);
  const warningsM = text.match(/Warnings:\s*(.+)/);
  const surfM = text.match(/SURFACE:\s*(.*?\.)\s*(.*)/);
  const visM = text.match(/Visibility\s+(.+)/);
  const wxM = text.match(/Weather\s+(.+)/);
  const isoM = text.match(/0 Deg\.\s*C Isotherm\s+(.+)/);
  const contrailsM = text.match(/Contrails\s+(.+)/);
  const tropoM = text.match(/Tropopause\s+(.+)/);
  const icingM = text.match(/Airframe Icing\s+(.+)/);
  const sunM = text.match(/Sun Rise (\d{2}:\d{2}) UTC Sun Set (\d{2}:\d{2}) UTC/);
  const outlookM = text.match(/Outlook for the following 12 hours\s*\n(.+)/);
  const remarksM = text.match(/Remarks\s*\n(.+)/);
  const issuedM = text.match(/Date (\d{2})\/(\d{2})\/(\d{4}) Time (\d{2}:\d{2}) UTC Sr\. Meteorologist (\S+)/);

  if (!validM || !issuedM) return null;

  const levels = [];
  const levelRe = /^(\d+FT|FL\d{3})\s+(\S+)\s+(PS|MS)(\d+)$/gm;
  let lm;
  while ((lm = levelRe.exec(text)) !== null) {
    const wind = decodeWind(lm[2]);
    levels.push({ level: lm[1], wind: `${wind.dir}${wind.speed ? "/" + wind.speed + "kt" : ""}`, temp: decodeTemp(lm[3], lm[4]) });
  }

  const [, fh, fmin, fdd, fmm, fyy, th, tmin, tdd, tmm, tyy] = [
    null,
    validM[1].slice(0, 2),
    validM[1].slice(3, 5),
    validM[2],
    validM[3],
    validM[4],
    validM[5].slice(0, 2),
    validM[5].slice(3, 5),
    validM[6],
    validM[7],
    validM[8],
  ];

  const [, iDD, iMM, iYY, iHH, iMin] = issuedM;

  return {
    validFrom: isoUtc(fyy, fmm, fdd, fh, fmin),
    validUntil: isoUtc(tyy, tmm, tdd, th, tmin),
    issued: isoUtc(iYY, iMM, iDD, iHH, iMin),
    meteorologist: issuedM[5],
    synopsis: synopsisM ? synopsisM[1].trim() : "--",
    warnings: warningsM ? warningsM[1].trim() : "--",
    surfaceWind: surfM ? surfM[1].trim() : "--",
    surfaceCloud: surfM ? surfM[2].trim() : "--",
    levels,
    visibility: visM ? visM[1].trim() : "--",
    weather: wxM ? wxM[1].trim() : "--",
    isotherm: isoM ? isoM[1].trim() : "--",
    contrails: contrailsM ? contrailsM[1].trim() : "--",
    tropopause: tropoM ? tropoM[1].trim() : "--",
    icing: icingM ? icingM[1].trim() : "--",
    sunrise: sunM ? sunM[1] : null,
    sunset: sunM ? sunM[2] : null,
    outlook: outlookM ? outlookM[1].trim() : "--",
    remarks: remarksM ? remarksM[1].trim() : "--",
  };
}

function fmtDateTime(iso) {
  if (!iso) return "--";
  return `${iso.slice(8, 10)}/${iso.slice(5, 7)} ${iso.slice(11, 16)} UTC`;
}

function renderFreshness() {
  const el = document.getElementById("heli-freshness");
  if (!el) return;
  const t = window.t;

  if (!lastForecast) {
    el.className = "notam-freshness very-stale";
    el.textContent = t("heliFetchFailed");
    return;
  }

  const ageHours = (Date.now() - new Date(lastForecast.issued).getTime()) / 3600000;
  const cls = "notam-freshness" + stalenessClass(ageHours, STALE_AFTER_H, VERY_STALE_AFTER_H);

  el.className = cls;
  el.textContent = `${t("heliIssued")}: ${fmtDateTime(lastForecast.issued)} — ${lastForecast.meteorologist}`;
}

function renderContent() {
  const el = document.getElementById("heli-content");
  if (!el) return;
  const t = window.t;

  if (!lastForecast) {
    el.innerHTML = "";
    return;
  }

  const f = lastForecast;
  const warnCls = /nil/i.test(f.warnings) ? "" : " cat-warn";

  const rows = [
    [t("heliVisibility"), f.visibility],
    [t("heliWeather"), f.weather],
    [t("heliIsotherm"), f.isotherm],
    [t("heliContrails"), f.contrails],
    [t("heliTropopause"), f.tropopause],
    [t("heliIcing"), f.icing],
    [t("heliSunTimes"), `${f.sunrise || "--"} / ${f.sunset || "--"}`],
  ];

  const levelRows = f.levels
    .map((l) => `<tr><td>${l.level}</td><td>${l.wind}</td><td>${l.temp}°C</td></tr>`)
    .join("");

  el.innerHTML = `
    <p class="hint" style="margin:0 0 10px">
      ${t("heliValidFrom")} ${fmtDateTime(f.validFrom)} ${t("heliValidUntil")} ${fmtDateTime(f.validUntil)}
    </p>
    <div class="notam-item${warnCls}" style="margin-bottom:12px">
      <div class="notam-text"><strong>${t("heliSynopsis")}:</strong> ${f.synopsis}</div>
      <div class="notam-text"><strong>${t("heliWarnings")}:</strong> ${f.warnings}</div>
    </div>
    <table class="decoded-table" style="margin-bottom:12px">
      <tbody>
        <tr><td>${t("heliSurface")}</td><td>${f.surfaceWind}</td></tr>
        <tr><td>${t("heliSurfaceCloud")}</td><td>${f.surfaceCloud}</td></tr>
      </tbody>
    </table>
    <h2 class="mt" style="margin-bottom:8px">${t("heliLevelsTitle")}</h2>
    <div class="taf-scroll" style="margin-bottom:12px">
      <table class="navaid-data-table">
        <thead><tr><th>${t("heliColLevel")}</th><th>${t("heliColWind")}</th><th>${t("heliColTemp")}</th></tr></thead>
        <tbody>${levelRows}</tbody>
      </table>
    </div>
    <table class="decoded-table" style="margin-bottom:12px">
      <tbody>${rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("")}</tbody>
    </table>
    <p class="hint" style="margin:0 0 4px"><strong>${t("heliOutlook")}:</strong> ${f.outlook}</p>
    <p class="hint" style="margin:0"><strong>${t("heliRemarks")}:</strong> ${f.remarks}</p>
  `;
}

function render() {
  renderFreshness();
  renderContent();
}

async function loadOnce() {
  const res = await withTimeout(fetch(PDF_PROXY_URL), LOAD_TIMEOUT_MS);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const text = await withTimeout(extractPdfText(buf), LOAD_TIMEOUT_MS);
  const parsed = parseForecast(text);
  if (!parsed) throw new Error("could not parse forecast PDF");
  lastForecast = parsed;
}

async function load() {
  try {
    await loadOnce();
  } catch (err) {
    // This card's fetch runs alongside bulletin.js/notam.js on first page
    // load, so a slow/weak connection can time one of them out. One retry
    // after a short pause covers that case without masking a genuinely
    // broken source.
    try {
      await new Promise((r) => setTimeout(r, RETRY_PAUSE_MS));
      await loadOnce();
    } catch (err2) {
      console.error("Failed to load helicopter ops forecast", err2);
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
