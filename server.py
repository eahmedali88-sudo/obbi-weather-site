"""
خادم بسيط لموقع طقس الطيارين: يخدم الملفات الثابتة (HTML/CSS/JS)
ويعمل كوسيط (proxy) لطلبات METAR/TAF من aviationweather.gov ونشرة
الأرصاد البحرينية (PDF) لتفادي قيود CORS في المتصفح. لا يحتاج مكتبات
خارجية (Python stdlib فقط) — استخراج نص PDF يتم في المتصفح عبر pdf.js
(انظر bulletin.js)، وليس هنا.

تشغيل:
    python server.py [PORT]
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

os.chdir(os.path.dirname(os.path.abspath(__file__)))

UPSTREAM = "https://aviationweather.gov/api/data"
ICAO_RE = re.compile(r"^[A-Za-z0-9,]{1,40}$")
BULLETIN_PDF_URL = "https://www.bahrainweather.gov.bh/files/forecasts/BMD_PublicWeatherForecast.pdf"
NOTAM_PDF_URL = "https://aim.mtt.gov.bh/sites/default/files/pdf_download/ePib%20scheduler.pdf"
# Hosting platforms (Render, Railway, Fly, etc.) assign the port via $PORT.
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8765))


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path in ("/proxy/metar", "/proxy/taf", "/proxy/isigmet"):
            self.handle_proxy(parsed)
            return

        if parsed.path == "/proxy/bulletin":
            self.handle_pdf_proxy(BULLETIN_PDF_URL)
            return

        if parsed.path == "/proxy/notam":
            self.handle_pdf_proxy(NOTAM_PDF_URL)
            return

        return super().do_GET()

    def end_headers(self):
        # Small personal site, dev server — always serve fresh content,
        # never let an intermediary cache a stale page after an edit.
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def handle_proxy(self, parsed):
        kind = parsed.path.rsplit("/", 1)[-1]  # metar | taf | isigmet
        qs = parse_qs(parsed.query)

        if kind == "isigmet":
            # Worldwide SIGMET feed, not scoped by ICAO — filtered client-side by FIR.
            url = f"{UPSTREAM}/isigmet?format=json"
        else:
            ids = (qs.get("ids") or [""])[0].strip().upper()
            if not ICAO_RE.match(ids):
                self.send_json_error(400, "invalid ids parameter")
                return

            url = f"{UPSTREAM}/{kind}?ids={ids}&format=json"

            if kind == "metar":
                hours_raw = (qs.get("hours") or [""])[0]
                if hours_raw:
                    try:
                        hours = max(1, min(72, int(hours_raw)))
                        url += f"&hours={hours}"
                    except ValueError:
                        pass
        last_error = None
        for attempt in range(2):  # one retry on transient empty/invalid upstream response
            try:
                req = urllib.request.Request(url, headers={"Accept": "application/json"})
                with urllib.request.urlopen(req, timeout=10) as resp:
                    body = resp.read()
                if not body or not body.strip():
                    last_error = "empty response from upstream"
                    continue
                try:
                    json.loads(body)
                except ValueError:
                    last_error = "invalid JSON from upstream"
                    continue
                self.send_response(200)
                self.send_header("Content-Type", "application/json; charset=utf-8")
                self.send_header("Access-Control-Allow-Origin", "*")
                self.send_header("Cache-Control", "no-store")
                self.end_headers()
                self.wfile.write(body)
                return
            except urllib.error.URLError as e:
                last_error = f"upstream error: {e}"
            except Exception as e:  # noqa: BLE001
                last_error = str(e)
        self.send_json_error(502, last_error or "unknown upstream failure")

    def handle_pdf_proxy(self, pdf_url):
        try:
            req = urllib.request.Request(pdf_url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                pdf_bytes = resp.read()
        except Exception as e:  # noqa: BLE001
            self.send_json_error(502, f"upstream error: {e}")
            return

        if not pdf_bytes:
            self.send_json_error(502, "empty response from upstream")
            return

        self.send_response(200)
        self.send_header("Content-Type", "application/pdf")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(pdf_bytes)

    def send_json_error(self, code, message):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"error": message}).encode("utf-8"))

    def log_message(self, format, *args):  # noqa: A002
        sys.stderr.write("%s - %s\n" % (self.address_string(), format % args))


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"OBBI weather site running on http://localhost:{PORT}")
    server.serve_forever()
