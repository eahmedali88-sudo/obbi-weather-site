/*
 * Cloudflare Pages Function — same-origin byte proxy for Bahrain Met
 * Directorate's Public Weather Forecast PDF. Plain fetch-and-forward, no
 * npm dependencies (mirrors functions/proxy/[kind].js's proven pattern) —
 * PDF text extraction happens client-side (see bulletin.js) using a
 * self-hosted pdf.js build, so nothing here needs a build step.
 *
 * Route: /proxy/bulletin
 */

const PDF_URL = "https://www.bahrainweather.gov.bh/files/forecasts/BMD_PublicWeatherForecast.pdf";

export async function onRequestGet() {
  let lastError = null;
  const MAX_ATTEMPTS = 3;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(PDF_URL, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        },
      });
      if (!res.ok) {
        lastError = `upstream HTTP ${res.status}`;
      } else {
        const buf = await res.arrayBuffer();
        if (!buf.byteLength) {
          lastError = "empty response from upstream";
        } else {
          return new Response(buf, {
            status: 200,
            headers: {
              "Content-Type": "application/pdf",
              "Access-Control-Allow-Origin": "*",
              "Cache-Control": "no-store",
            },
          });
        }
      }
    } catch (err) {
      lastError = String(err);
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, 200 + attempt * 150));
    }
  }

  return new Response(JSON.stringify({ error: lastError || "unknown upstream failure" }), {
    status: 502,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
