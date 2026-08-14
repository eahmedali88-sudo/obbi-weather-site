/*
 * Cloudflare Pages Function — same-origin byte proxy for Bahrain's official
 * Daily PIB (Pre-flight Information Bulletin) PDF. Plain fetch-and-forward,
 * no dependencies — mirrors functions/proxy/bulletin.js. Text extraction
 * and NOTAM parsing happen client-side (see notam.js) with the same
 * self-hosted pdf.js build already vendored for the weather bulletin.
 *
 * Route: /proxy/notam
 */

const PDF_URL = "https://aim.mtt.gov.bh/sites/default/files/pdf_download/ePib%20scheduler.pdf";

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
