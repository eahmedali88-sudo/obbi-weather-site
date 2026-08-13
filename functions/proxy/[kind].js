/*
 * Cloudflare Pages Function — same-origin proxy for METAR/TAF requests.
 * aviationweather.gov does not send CORS headers, so the browser can't call
 * it directly; this edge function fetches it server-side and forwards the
 * result with CORS enabled. Mirrors server.py's logic (used for local dev).
 *
 * Route: /proxy/metar or /proxy/taf  ->  this file, via the [kind] segment.
 */

const UPSTREAM = "https://aviationweather.gov/api/data";
const ICAO_RE = /^[A-Za-z0-9,]{1,40}$/;

export async function onRequestGet(context) {
  const { params, request } = context;
  const kind = params.kind;

  if (kind !== "metar" && kind !== "taf" && kind !== "isigmet") {
    return jsonError(404, "not found");
  }

  const url = new URL(request.url);
  let upstreamUrl;

  if (kind === "isigmet") {
    // Worldwide SIGMET feed, not scoped by ICAO — filtered client-side by FIR.
    upstreamUrl = `${UPSTREAM}/isigmet?format=json`;
  } else {
    const ids = (url.searchParams.get("ids") || "").trim().toUpperCase();
    if (!ICAO_RE.test(ids)) {
      return jsonError(400, "invalid ids parameter");
    }
    upstreamUrl = `${UPSTREAM}/${kind}?ids=${ids}&format=json`;
    if (kind === "metar") {
      const hoursRaw = url.searchParams.get("hours");
      if (hoursRaw) {
        const hours = Math.max(1, Math.min(72, parseInt(hoursRaw, 10) || 0));
        if (hours) upstreamUrl += `&hours=${hours}`;
      }
    }
  }
  let lastError = null;
  const MAX_ATTEMPTS = 5; // aviationweather.gov is intermittently unreachable from Cloudflare's network (~30% observed failure rate) — retry harder than a normal proxy would need to.

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(upstreamUrl, {
        headers: {
          Accept: "application/json",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      if (!res.ok) {
        lastError = `upstream HTTP ${res.status}`;
      } else {
        const text = await res.text();
        if (!text.trim()) {
          lastError = "empty response from upstream";
        } else {
          try {
            JSON.parse(text);
            return new Response(text, {
              status: 200,
              headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "no-store",
              },
            });
          } catch {
            lastError = "invalid JSON from upstream";
          }
        }
      }
    } catch (err) {
      lastError = String(err);
    }
    if (attempt < MAX_ATTEMPTS - 1) {
      await new Promise((r) => setTimeout(r, 200 + attempt * 150));
    }
  }

  return jsonError(502, lastError || "unknown upstream failure");
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
