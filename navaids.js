"use strict";

/* Nearby navigation aids reference — Bahrain International Airport (OBBI) only.
   Data: OurAirports open navaids dataset (public domain). Curated to the
   handful of stations actually relevant to Bahrain (matches published
   nearby-navaid references), with range/bearing computed here rather than
   trusted blindly from any single source. No airway/route geometry is shown —
   real ATS airway data is regulated AIP/chart data we don't have a reliable
   source for. */

const OBBI_LAT = 26.2708;
const OBBI_LON = 50.6336;

// Curated set matching Bahrain's published nearby navaids.
const NEARBY_IDENTS = ["BAH", "SIA", "DHA", "KFA", "SI", "RT", "PRG", "TJ"];

function navaidFreqText(navaid) {
  if (!navaid.freq) return null;
  const raw = parseFloat(navaid.freq);
  if (isNaN(raw)) return null;
  if ((navaid.type || "").toUpperCase() === "NDB") return `${raw} kHz`;
  return `${(raw / 1000).toFixed(2)} MHz`;
}

function toRad(d) { return (d * Math.PI) / 180; }
function toDeg(r) { return (r * 180) / Math.PI; }

function haversineNM(lat1, lon1, lat2, lon2) {
  const R = 3440.065; // Earth radius in nautical miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function initialBearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin(toRad(lon2 - lon1)) * Math.cos(toRad(lat2));
  const x =
    Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
    Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(toRad(lon2 - lon1));
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function renderNavaidTables(navaids) {
  const vorTypes = ["VOR", "VOR-DME", "VORTAC", "TACAN"];
  const vorRows = navaids.filter((n) => vorTypes.includes((n.type || "").toUpperCase()));
  const ndbRows = navaids.filter((n) => (n.type || "").toUpperCase() === "NDB");

  const vorBody = document.querySelector("#navaid-vor-table tbody");
  if (vorBody) {
    vorBody.innerHTML = vorRows
      .map(
        (n) =>
          `<tr><td>${n.ident}</td><td>${n.name}</td><td>${navaidFreqText(n) || "--"}</td><td>${n.radial.toFixed(0)}°</td><td>${n.rangeNm.toFixed(1)}</td></tr>`
      )
      .join("");
  }

  const ndbBody = document.querySelector("#navaid-ndb-table tbody");
  if (ndbBody) {
    ndbBody.innerHTML = ndbRows
      .map(
        (n) =>
          `<tr><td>${n.ident}</td><td>${n.name}</td><td>${navaidFreqText(n) || "--"}</td><td>${n.bearing.toFixed(0)}°</td><td>${n.rangeNm.toFixed(1)}</td></tr>`
      )
      .join("");
  }
}

async function loadNavaids() {
  try {
    const res = await fetch("data/navaids_bahrain_fir.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const all = await res.json();

    const nearby = all
      .filter((n) => NEARBY_IDENTS.includes(n.ident))
      .map((n) => ({
        ...n,
        rangeNm: haversineNM(OBBI_LAT, OBBI_LON, n.lat, n.lon),
        radial: initialBearing(n.lat, n.lon, OBBI_LAT, OBBI_LON), // bearing FROM the station (its "radial")
        bearing: initialBearing(OBBI_LAT, OBBI_LON, n.lat, n.lon), // bearing FROM the airport (ADF-style, for NDBs)
      }))
      .sort((a, b) => a.rangeNm - b.rangeNm);

    renderNavaidTables(nearby);
  } catch (err) {
    console.error("Failed to load navaids", err);
  }
}

loadNavaids();
