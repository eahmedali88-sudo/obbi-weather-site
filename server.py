"""
خادم بسيط لموقع طقس الطيارين: يخدم الملفات الثابتة (HTML/CSS/JS)
ويعمل كوسيط (proxy) لطلبات METAR/TAF من aviationweather.gov لتفادي
قيود CORS في المتصفح. يعتمد على Python stdlib فقط، باستثناء مسار
/proxy/bulletin الذي يحتاج pypdf (pip install pypdf) لاستخراج نص
نشرة الأرصاد البحرينية من ملف PDF — يقابله في الإنتاج functions/proxy/bulletin.js.

تشغيل:
    python server.py [PORT]
"""

import json
import os
import re
import sys
import urllib.error
import urllib.request
from datetime import date, timedelta
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

os.chdir(os.path.dirname(os.path.abspath(__file__)))

UPSTREAM = "https://aviationweather.gov/api/data"
ICAO_RE = re.compile(r"^[A-Za-z0-9,]{1,40}$")
BULLETIN_PDF_URL = "https://www.bahrainweather.gov.bh/files/forecasts/BMD_PublicWeatherForecast.pdf"
# Hosting platforms (Render, Railway, Fly, etc.) assign the port via $PORT.
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else int(os.environ.get("PORT", 8765))


def _field(label, text):
    m = re.search(r"\n" + re.escape(label) + r"\n([^\n]+)", text)
    return m.group(1).strip() if m else None


def _to_24h(h, m, ampm):
    h = int(h)
    if ampm.upper() == "PM" and h != 12:
        h += 12
    if ampm.upper() == "AM" and h == 12:
        h = 0
    return h, int(m)


def _iso_bahrain(year, month, day, h, m):
    return f"{year:04d}-{month:02d}-{day:02d}T{h:02d}:{m:02d}:00+03:00"


def parse_bulletin(text):
    """Mirrors functions/proxy/bulletin.js — keep both in sync."""
    weather = _field("Weather", text)
    wind = _field("Wind", text)
    warning = _field("Warning", text)
    sea_state = _field("Sea State", text)

    valid_m = re.search(
        r"valid from (\d{3,4})(AM|PM) on (\d{1,2}) (\d{1,2}) (\d{4})\s*\n?\s*until (\d{3,4})(AM|PM) tomorrow",
        text,
        re.IGNORECASE,
    )
    issued_m = re.search(r"Issued:\s*(\d{2})/(\d{2})/(\d{4})\s+(\d{1,2}):(\d{2})\s*(AM|PM)", text, re.IGNORECASE)

    if not (weather and wind and warning and sea_state and valid_m):
        return None

    from_hhmm, from_ap, day_s, month_s, year_s, until_hhmm, until_ap = valid_m.groups()
    day, month, year = int(day_s), int(month_s), int(year_s)
    fh, fm = _to_24h(from_hhmm[:-2], from_hhmm[-2:], from_ap)
    uh, um = _to_24h(until_hhmm[:-2], until_hhmm[-2:], until_ap)

    valid_from = _iso_bahrain(year, month, day, fh, fm)
    tomorrow = date(year, month, day) + timedelta(days=1)
    valid_until = _iso_bahrain(tomorrow.year, tomorrow.month, tomorrow.day, uh, um)

    issued = None
    if issued_m:
        i_day, i_month, i_year, i_h, i_m, i_ap = issued_m.groups()
        ih, im = _to_24h(i_h, i_m, i_ap)
        issued = _iso_bahrain(int(i_year), int(i_month), int(i_day), ih, im)

    return {
        "weather": weather,
        "wind": wind,
        "warning": warning,
        "seaState": sea_state,
        "validFrom": valid_from,
        "validUntil": valid_until,
        "issued": issued,
        "sourceUrl": BULLETIN_PDF_URL,
    }


class Handler(SimpleHTTPRequestHandler):
    def do_GET(self):
        parsed = urlparse(self.path)

        if parsed.path in ("/proxy/metar", "/proxy/taf", "/proxy/isigmet"):
            self.handle_proxy(parsed)
            return

        if parsed.path == "/proxy/bulletin":
            self.handle_bulletin()
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

    def handle_bulletin(self):
        try:
            from pypdf import PdfReader
        except ImportError:
            self.send_json_error(500, "pypdf not installed (pip install pypdf)")
            return

        try:
            req = urllib.request.Request(BULLETIN_PDF_URL, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                pdf_bytes = resp.read()
        except Exception as e:  # noqa: BLE001
            self.send_json_error(502, f"upstream error: {e}")
            return

        try:
            import io

            reader = PdfReader(io.BytesIO(pdf_bytes))
            text = reader.pages[0].extract_text()
            data = parse_bulletin(text)
        except Exception as e:  # noqa: BLE001
            data = None
            sys.stderr.write(f"bulletin parse error: {e}\n")

        if not data:
            self.send_json_error(502, "could not parse bulletin PDF (source format may have changed)")
            return

        body = json.dumps(data).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

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
