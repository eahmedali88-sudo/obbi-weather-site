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

  if (kind !== "metar" && kind !== "taf") {
    return jsonError(404, "not found");
  }

  const url = new URL(request.url);
  const ids = (url.searchParams.get("ids") || "").trim().toUpperCase();
  if (!ICAO_RE.test(ids)) {
    return jsonError(400, "invalid ids parameter");
  }

  const upstreamUrl = `${UPSTREAM}/${kind}?ids=${ids}&format=json`;
  let lastError = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(upstreamUrl, { headers: { Accept: "application/json" } });
      if (!res.ok) {
        lastError = `upstream HTTP ${res.status}`;
        continue;
      }
      const text = await res.text();
      if (!text.trim()) {
        lastError = "empty response from upstream";
        continue;
      }
      try {
        JSON.parse(text);
      } catch {
        lastError = "invalid JSON from upstream";
        continue;
      }
      return new Response(text, {
        status: 200,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        },
      });
    } catch (err) {
      lastError = String(err);
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
