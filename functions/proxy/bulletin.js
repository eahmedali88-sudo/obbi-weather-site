/*
 * Cloudflare Pages Function — fetches Bahrain Met Directorate's Public
 * Weather Forecast PDF, extracts its text (via unpdf, a serverless-friendly
 * PDF.js build), and returns the handful of fields pilots actually need as
 * JSON. The browser never touches the PDF directly, so nothing changes if
 * the source ever adds CORS restrictions or the bulletin layout is tweaked
 * slightly — only this parser needs updating.
 *
 * Route: /proxy/bulletin
 */

import { extractText, getDocumentProxy } from "unpdf";

const PDF_URL = "https://www.bahrainweather.gov.bh/files/forecasts/BMD_PublicWeatherForecast.pdf";
const BAHRAIN_OFFSET = "+03:00"; // Arabia Standard Time, no DST

export async function onRequestGet() {
  try {
    const res = await fetch(PDF_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) return jsonError(502, `upstream HTTP ${res.status}`);

    const buf = await res.arrayBuffer();
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });

    const data = parseBulletin(text);
    if (!data) return jsonError(502, "could not parse bulletin PDF (source format may have changed)");

    return new Response(JSON.stringify(data), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return jsonError(502, String(err));
  }
}

function field(label, text) {
  const re = new RegExp("\\n" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\n([^\\n]+)");
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

// "0600PM" -> {h:18, m:0}
function parseTimeCompact(s) {
  const m = s.match(/^(\d{1,2})(\d{2})(AM|PM)$/i);
  if (!m) return null;
  return to24h(parseInt(m[1], 10), parseInt(m[2], 10), m[3]);
}

// "05:06 PM" -> {h:17, m:6}
function parseTimeColon(s) {
  const m = s.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!m) return null;
  return to24h(parseInt(m[1], 10), parseInt(m[2], 10), m[3]);
}

function to24h(h, min, ampm) {
  const ap = ampm.toUpperCase();
  if (ap === "PM" && h !== 12) h += 12;
  if (ap === "AM" && h === 12) h = 0;
  return { h, m: min };
}

function isoBahrain(year, month, day, h, m) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(h)}:${pad(m)}:00${BAHRAIN_OFFSET}`;
}

function parseBulletin(text) {
  const weather = field("Weather", text);
  const wind = field("Wind", text);
  const warning = field("Warning", text);
  const seaState = field("Sea State", text);

  const validM = text.match(
    /valid from (\d{3,4}(?:AM|PM)) on (\d{1,2}) (\d{1,2}) (\d{4})\s*\n?\s*until (\d{3,4}(?:AM|PM)) tomorrow/i
  );
  const issuedM = text.match(/Issued:\s*(\d{2})\/(\d{2})\/(\d{4})\s+(\d{1,2}:\d{2}\s*(?:AM|PM))/i);

  if (!weather || !wind || !warning || !seaState || !validM) return null;

  const [, fromTimeRaw, dayStr, monthStr, yearStr, untilTimeRaw] = validM;
  const day = parseInt(dayStr, 10);
  const month = parseInt(monthStr, 10);
  const year = parseInt(yearStr, 10);
  const fromTime = parseTimeCompact(fromTimeRaw);
  const untilTime = parseTimeCompact(untilTimeRaw);
  if (!fromTime || !untilTime) return null;

  const validFrom = isoBahrain(year, month, day, fromTime.h, fromTime.m);
  // "until ... tomorrow" = next calendar day relative to the from-date; Date
  // normalizes any month/year rollover from day+1 for us.
  const tomorrow = new Date(Date.UTC(year, month - 1, day + 1));
  const validUntil = isoBahrain(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    untilTime.h,
    untilTime.m
  );

  let issued = null;
  if (issuedM) {
    const [, iDay, iMonth, iYear, iTimeRaw] = issuedM;
    const iTime = parseTimeColon(iTimeRaw.replace(/\s+/g, " "));
    if (iTime) issued = isoBahrain(parseInt(iYear, 10), parseInt(iMonth, 10), parseInt(iDay, 10), iTime.h, iTime.m);
  }

  return { weather, wind, warning, seaState, validFrom, validUntil, issued, sourceUrl: PDF_URL };
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
