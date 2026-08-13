"use strict";

/* ---------- Airport database (extend as needed) ---------- */
const AIRPORTS = {
  OBBI: {
    name: "Bahrain International Airport",
    nameAr: "مطار البحرين الدولي",
    city: "Muharraq, Bahrain",
    cityAr: "المحرق، البحرين",
    lat: 26.2708, lon: 50.6336, tzOffset: 3,
    runways: [
      { id: "12L/30R", hdgs: [119, 299], lengthM: 3955, widthM: 60 },
      { id: "12R/30L", hdgs: [119, 299], lengthM: 2530, widthM: 45 },
    ],
    comms: [
      { role: "approach", freq: "127.85" },
      { role: "approach", freq: "234.95" },
      { role: "atis", freq: "127.20" },
      { role: "delivery", freq: "121.90" },
      { role: "ground", freq: "121.85" },
      { role: "tower", freq: "118.50" },
    ],
  },
  OTHH: { name: "Hamad International Airport", nameAr: "مطار حمد الدولي", city: "Doha, Qatar", cityAr: "الدوحة، قطر", lat: 25.2611, lon: 51.5651, tzOffset: 3,
    runways: [ { id: "16L/34R", hdgs: [160, 340], lengthM: 4570, widthM: 60 }, { id: "16R/34L", hdgs: [160, 340], lengthM: 4250, widthM: 60 } ] },
  OKBK: { name: "Kuwait International Airport", nameAr: "مطار الكويت الدولي", city: "Kuwait City, Kuwait", cityAr: "مدينة الكويت، الكويت", lat: 29.2267, lon: 47.9689, tzOffset: 3,
    runways: [ { id: "15L/33R", hdgs: [151, 331], lengthM: 4000, widthM: 60 }, { id: "15R/33L", hdgs: [151, 331], lengthM: 3400, widthM: 45 } ] },
  OERK: { name: "King Khalid International Airport", nameAr: "مطار الملك خالد الدولي", city: "Riyadh, Saudi Arabia", cityAr: "الرياض، السعودية", lat: 24.9576, lon: 46.6988, tzOffset: 3,
    runways: [ { id: "15L/33R", hdgs: [150, 330], lengthM: 4205, widthM: 60 }, { id: "15R/33L", hdgs: [150, 330], lengthM: 4205, widthM: 60 } ] },
  OEJN: { name: "King Abdulaziz International Airport", nameAr: "مطار الملك عبدالعزيز الدولي", city: "Jeddah, Saudi Arabia", cityAr: "جدة، السعودية", lat: 21.6796, lon: 39.1565, tzOffset: 3,
    runways: [ { id: "16L/34R", hdgs: [160, 340], lengthM: 4000, widthM: 60 }, { id: "16C/34C", hdgs: [160, 340], lengthM: 3800, widthM: 60 }, { id: "16R/34L", hdgs: [160, 340], lengthM: 3800, widthM: 60 } ] },
  OMDB: { name: "Dubai International Airport", nameAr: "مطار دبي الدولي", city: "Dubai, UAE", cityAr: "دبي، الإمارات", lat: 25.2528, lon: 55.3644, tzOffset: 4,
    runways: [ { id: "12L/30R", hdgs: [120, 300], lengthM: 4447, widthM: 60 }, { id: "12R/30L", hdgs: [120, 300], lengthM: 4000, widthM: 60 } ] },
  OMAA: { name: "Abu Dhabi International Airport", nameAr: "مطار أبوظبي الدولي", city: "Abu Dhabi, UAE", cityAr: "أبوظبي، الإمارات", lat: 24.4330, lon: 54.6511, tzOffset: 4,
    runways: [ { id: "13L/31R", hdgs: [130, 310], lengthM: 4100, widthM: 60 }, { id: "13R/31L", hdgs: [130, 310], lengthM: 4100, widthM: 60 } ] },
};

const DEFAULT_ICAO = "OBBI";
const REFRESH_MS = 5 * 60 * 1000;

/* ---------- i18n ---------- */
const STR = {
  brandTitle: { ar: "مساعد الطيارين للطقس الجوي", en: "Pilot Weather Briefing Assistant" },
  brandSub: { ar: "إحاطة طقس جوية للطيارين — منطقة معلومات طيران البحرين", en: "Aviation weather briefing for pilots — Bahrain FIR" },
  icaoLabel: { ar: "رمز المطار ICAO", en: "Airport ICAO code" },
  update: { ar: "تحديث", en: "Update" },
  localTime: { ar: "التوقيت المحلي", en: "Local time" },
  utcTime: { ar: "التوقيت العالمي UTC", en: "UTC time" },
  disclaimer: {
    ar: "هذه الأداة لأغراض معلوماتية ومساعدة عامة فقط، ولا تُغني إطلاقاً عن مصادر الطقس والنوتام الرسمية (NOTAM) المعتمدة عند تخطيط الرحلات الفعلي. تحقق دائماً من الجهات الرسمية قبل الطيران.",
    en: "This tool is for general information only and does not replace official weather and NOTAM sources for real flight planning. Always verify with official sources before flying.",
  },
  loading: { ar: "جاري جلب بيانات الطقس...", en: "Fetching weather data..." },
  windTitle: { ar: "اتجاه وسرعة الرياح", en: "Wind Direction & Speed" },
  windFrom: { ar: "الاتجاه (من)", en: "Direction (from)" },
  windSpeed: { ar: "السرعة", en: "Speed" },
  windGust: { ar: "الهبات (Gust)", en: "Gusts" },
  crosswindTitle: { ar: "الرياح الجانبية والأمامية للمدرج", en: "Runway Crosswind / Headwind" },
  crosswindHint: { ar: "القيم تقديرية لأغراض المعلومات فقط — لا تُستخدم للتخطيط الفعلي.", en: "Estimated values for information only — not for operational flight planning." },
  rawMetarTitle: { ar: "تقرير METAR الخام", en: "Raw METAR" },
  rawTafTitle: { ar: "تقرير TAF الخام", en: "Raw TAF" },
  metarHistoryTitle: { ar: "سجل METAR", en: "METAR History" },
  mhTime: { ar: "الوقت", en: "Time" },
  mhCode: { ar: "الحالة", en: "Code" },
  mhWeather: { ar: "الطقس", en: "Weather" },
  mhTemp: { ar: "الحرارة", en: "Temp." },
  mhVisibility: { ar: "الرؤية", en: "Visibility" },
  mhCeiling: { ar: "السقف", en: "Ceiling" },
  mhWind: { ar: "الرياح", en: "Wind" },
  mhRaw: { ar: "METAR", en: "METAR" },
  decodedTitle: { ar: "تفاصيل الأرصاد", en: "Decoded Details" },
  tafTimelineTitle: { ar: "توقعات TAF", en: "TAF Forecast Timeline" },
  thPeriod: { ar: "الفترة الزمنية", en: "Period" },
  thCategory: { ar: "الحالة", en: "Category" },
  thWind: { ar: "الرياح", en: "Wind" },
  thVisibility: { ar: "الرؤية", en: "Visibility" },
  thCeiling: { ar: "السقف", en: "Ceiling" },
  thWeather: { ar: "الطقس", en: "Weather" },
  daylightTitle: { ar: "فترة النهار", en: "Daylight Period" },
  sunrise: { ar: "الشروق", en: "Sunrise" },
  solarNoon: { ar: "الظهيرة", en: "Solar noon" },
  sunset: { ar: "الغروب", en: "Sunset" },
  dayLength: { ar: "طول النهار", en: "Day length" },
  footerSource: { ar: "مصدر البيانات:", en: "Data source:" },
  footerSource2: { ar: "(NOAA / FAA Aviation Weather Center) — يتم التحديث تلقائياً كل 5 دقائق.", en: "(NOAA / FAA Aviation Weather Center) — auto-refreshes every 5 minutes." },
  lastUpdatedNone: { ar: "آخر تحديث: --", en: "Last updated: --" },
  lastUpdated: { ar: "آخر تحديث:", en: "Last updated:" },

  statCategory: { ar: "حالة الطيران", en: "Flight Category" },
  statTemp: { ar: "درجة الحرارة", en: "Temperature" },
  statDew: { ar: "نقطة الندى", en: "Dew Point" },
  statHumidity: { ar: "الرطوبة النسبية", en: "Relative Humidity" },
  statWind: { ar: "الرياح", en: "Wind" },
  statVisibility: { ar: "الرؤية", en: "Visibility" },
  statRain: { ar: "فرصة هطول الأمطار", en: "Chance of Rain" },
  statQnh: { ar: "الضغط QNH", en: "QNH" },
  statAge: { ar: "عمر البيانات", en: "Data Age" },
  minutesAgo: { ar: "دقيقة", en: "min" },

  catVFR: { ar: "طيران بصري (VFR)", en: "Visual Flight Rules (VFR)" },
  catMVFR: { ar: "طيران بصري هامشي (MVFR)", en: "Marginal VFR (MVFR)" },
  catIFR: { ar: "طيران آلي (IFR)", en: "Instrument Flight Rules (IFR)" },
  catLIFR: { ar: "طيران آلي منخفض (LIFR)", en: "Low IFR (LIFR)" },

  dICAO: { ar: "رمز المطار (ICAO)", en: "Airport (ICAO)" },
  dName: { ar: "اسم المطار", en: "Airport Name" },
  dTime: { ar: "وقت التقرير (UTC)", en: "Report Time (UTC)" },
  dCategory: { ar: "حالة الطيران", en: "Flight Category" },
  dTemp: { ar: "درجة الحرارة", en: "Temperature" },
  dDew: { ar: "نقطة الندى", en: "Dew Point" },
  dWindDir: { ar: "اتجاه الرياح", en: "Wind Direction" },
  dWindSpeed: { ar: "سرعة الرياح", en: "Wind Speed" },
  dGust: { ar: "هبات الرياح", en: "Wind Gusts" },
  dVisibility: { ar: "مدى الرؤية", en: "Visibility" },
  dQnh: { ar: "الضغط الجوي (QNH)", en: "Altimeter (QNH)" },
  dWeather: { ar: "الطقس الحالي", en: "Current Weather" },
  dClouds: { ar: "الغيوم", en: "Clouds" },
  none: { ar: "لا يوجد", en: "None" },
  variable: { ar: "متغيرة (VRB)", en: "Variable (VRB)" },
  noWx: { ar: "لا توجد ظواهر جوية", en: "No significant weather" },
  clearSky: { ar: "صافي / CAVOK", en: "Clear / CAVOK" },
  dash: { ar: "--", en: "--" },

  colRunway: { ar: "المدرج", en: "Runway" },
  colHeadTail: { ar: "المكوّن الأمامي/الخلفي", en: "Head / Tailwind" },
  colCross: { ar: "المكوّن الجانبي", en: "Crosswind" },
  activeRunway: { ar: "مدرج بالخدمة", en: "Runway in use" },
  headwind: { ar: "رياح أمامية", en: "Headwind" },
  tailwind: { ar: "رياح خلفية", en: "Tailwind" },
  crosswind: { ar: "جانبية", en: "Crosswind" },
  fromRight: { ar: "من اليمين", en: "from right" },
  fromLeft: { ar: "من اليسار", en: "from left" },
  noRunwayData: { ar: "لا تتوفر بيانات مدرج مسجّلة لهذا المطار في قاعدة البيانات المحلية.", en: "No runway data registered for this airport in the local database." },
  noWindData: { ar: "بيانات الرياح غير متوفرة حالياً.", en: "Wind data currently unavailable." },

  periodFM: { ar: "من", en: "From" },
  periodBECMG: { ar: "تحوّل تدريجي", en: "Becoming" },
  periodTEMPO: { ar: "مؤقت", en: "Temporary" },
  periodPROB: { ar: "احتمالية", en: "Probability" },
  periodINITIAL: { ar: "أساسي", en: "Initial" },
  noTaf: { ar: "لا تتوفر بيانات TAF حالياً.", en: "No TAF data currently available." },

  fetching: { ar: "جاري جلب بيانات الطقس لمطار", en: "Fetching weather data for" },
  noMetar: { ar: "لا توجد بيانات METAR متاحة حالياً لمطار", en: "No METAR data currently available for" },
  checkIcao: { ar: "تحقق من صحة رمز ICAO.", en: "Please check the ICAO code." },
  fetchError: { ar: "تعذّر جلب بيانات الطقس", en: "Failed to fetch weather data" },
  checkConn: { ar: "تحقق من اتصال الإنترنت وحاول مرة أخرى.", en: "Check your internet connection and try again." },
  noSunData: { ar: "غير محدد", en: "Not applicable" },

  rwyInUse: { ar: "المدرج المستخدم", en: "Runway in Use" },
  rwyVariable: { ar: "رياح متغيرة", en: "Variable wind" },
  rwyNoData: { ar: "لا تتوفر بيانات", en: "No data" },

  navaidsTitle: { ar: "الوسائل الملاحية القريبة — مطار البحرين الدولي", en: "Nearby Navigation Aids — Bahrain International Airport" },
  navaidsHint: {
    ar: "مواقع وترددات حقيقية (بيانات مفتوحة من OurAirports)، مع المدى والاتجاه المحسوبين فلكياً من مركز مطار البحرين — لأغراض مرجعية فقط وليست مخططات ملاحة رسمية.",
    en: "Real positions and frequencies (open data via OurAirports), with range/bearing computed from Bahrain airport's reference point — for reference only, not an official navigation chart.",
  },
  navaidsVorGroup: { ar: "VOR / VORTAC / TACAN", en: "VOR / VORTAC / TACAN" },
  navaidsNdbGroup: { ar: "NDB", en: "NDB" },
  navaidColId: { ar: "المعرف", en: "ID" },
  navaidColName: { ar: "الاسم", en: "Name" },
  navaidColFreq: { ar: "التردد", en: "Freq" },
  navaidColRadial: { ar: "الراديال (°T)", en: "Radial (°T)" },
  navaidColBearing: { ar: "الاتجاه (°T)", en: "Bearing (°T)" },
  navaidColRange: { ar: "المدى (nm)", en: "Range (nm)" },

  notamTitle: { ar: "إشعارات الطيارين (NOTAM)", en: "Notices to Airmen (NOTAM)" },
  notamHint: {
    ar: "لا يمكن عرض النوتامات تلقائياً هنا لأنها بيانات رسمية مقيدة ولا تتوفر عبر واجهة برمجية مفتوحة وموثوقة. اضغط الزر أدناه للوصول مباشرة إلى مصدر الطيران الرسمي لمملكة البحرين (النشرة اليومية PIB والنوتامات).",
    en: "NOTAMs can't be shown automatically here — they're official restricted data with no reliable open API. Use the button below to go straight to Bahrain's official aeronautical information source (Daily PIB and NOTAMs).",
  },
  notamBtn: { ar: "افتح بوابة معلومات الطيران الرسمية للبحرين (AIS)", en: "Open Bahrain's Official AIS Portal" },

  commsTitle: { ar: "اتصالات مطار البحرين الدولي", en: "Bahrain International Airport Communications" },
  commsHint: {
    ar: "ترددات مرجعية — تحقق دائماً من آخر إصدار لمنشور معلومات الطيران (AIP) والنوتام قبل الاستخدام الفعلي.",
    en: "Reference frequencies only — always verify against the current AIP and NOTAMs before operational use.",
  },
  commsApproach: { ar: "الاقتراب (Approach)", en: "Approach" },
  commsAtis: { ar: "ATIS", en: "ATIS" },
  commsDelivery: { ar: "تصريح المغادرة (Delivery)", en: "Clearance Delivery" },
  commsGround: { ar: "التحكم الأرضي (Ground)", en: "Ground" },
  commsTower: { ar: "البرج (Tower)", en: "Tower" },
};

let lang = localStorage.getItem("obbi_lang") || "ar";
function t(key) {
  return (STR[key] && STR[key][lang]) || key;
}

let refreshTimer = null;
let sunTimesCache = null;
let state = null; // { icao, airport, metar, taf, activeRunway }

/* ---------- Helpers ---------- */
function getAirport(icao) {
  return AIRPORTS[icao] || { name: icao, nameAr: icao, city: "", cityAr: "", lat: null, lon: null, tzOffset: null, runways: [] };
}

function airportDisplayName(airport) {
  if (lang === "ar" && airport.nameAr) return airport.nameAr;
  return airport.name;
}
function airportDisplayCity(airport) {
  if (lang === "ar" && airport.cityAr) return airport.cityAr;
  return airport.city;
}

function pad2(n) { return String(n).padStart(2, "0"); }

function parseVisib(v) {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v === "number") return v;
  v = String(v).trim();
  if (v.endsWith("+")) { const f = parseFloat(v); return isNaN(f) ? 10 : f; }
  if (v.includes(" ")) {
    const parts = v.split(" ");
    let whole = parseFloat(parts[0]) || 0;
    if (parts[1] && parts[1].includes("/")) {
      const [n, d] = parts[1].split("/").map(Number);
      if (d) whole += n / d;
    }
    return whole;
  }
  if (v.includes("/")) {
    const [n, d] = v.split("/").map(Number);
    return d ? n / d : null;
  }
  const f = parseFloat(v);
  return isNaN(f) ? null : f;
}

function parseCeilingFt(clouds) {
  if (!Array.isArray(clouds) || clouds.length === 0) return null;
  let min = null;
  for (const layer of clouds) {
    const cover = (layer.cover || "").toUpperCase();
    if (["BKN", "OVC", "OVX", "VV"].includes(cover)) {
      const base = layer.base ?? layer.bas ?? null;
      if (base != null) {
        if (min === null || base < min) min = base;
      }
    }
  }
  return min;
}

function computeFlightCategory(visibSM, ceilingFt) {
  const vis = visibSM === null || visibSM === undefined ? 99 : visibSM;
  const ceil = ceilingFt === null || ceilingFt === undefined ? 99999 : ceilingFt;
  if (vis < 1 || ceil < 500) return "LIFR";
  if (vis < 3 || ceil < 1000) return "IFR";
  if (vis <= 5 || ceil <= 3000) return "MVFR";
  return "VFR";
}

function catLabel(cat) {
  return t("cat" + cat) || cat;
}

function relativeHumidity(tempC, dewC) {
  if (tempC === undefined || tempC === null || dewC === undefined || dewC === null) return null;
  const es = (x) => 6.112 * Math.exp((17.625 * x) / (243.04 + x));
  return Math.round(100 * (es(dewC) / es(tempC)));
}

function windComponents(windDir, windSpd, runwayHdg) {
  const diff = (((windDir - runwayHdg + 540) % 360) - 180) * (Math.PI / 180);
  const headwind = windSpd * Math.cos(diff);
  const crosswind = windSpd * Math.sin(diff);
  return { headwind, crosswind };
}

function fmtNum(n, digits = 0) {
  if (n === null || n === undefined || isNaN(n)) return "--";
  return n.toFixed(digits);
}

function padDir(d) {
  if (d === null || d === undefined) return "VRB";
  if (typeof d === "number") return String(Math.round(d)).padStart(3, "0");
  return d;
}

function fmtWind(wdir, wspd, wgst) {
  if (wspd === undefined || wspd === null) return t("variable");
  const dirTxt = typeof wdir === "number" ? `${padDir(wdir)}°` : "VRB";
  let s = `${dirTxt} / ${wspd} kt`;
  if (wgst) s += ` G${wgst}`;
  return s;
}

/* ---------- Clock ---------- */
function tickClocks() {
  const now = new Date();
  document.getElementById("clock-utc").textContent =
    pad2(now.getUTCHours()) + ":" + pad2(now.getUTCMinutes()) + ":" + pad2(now.getUTCSeconds());

  const airport = state ? state.airport : getAirport(DEFAULT_ICAO);
  const tz = airport.tzOffset ?? 3;
  const local = new Date(now.getTime() + tz * 3600000);
  document.getElementById("clock-local").textContent =
    pad2(local.getUTCHours()) + ":" + pad2(local.getUTCMinutes()) + ":" + pad2(local.getUTCSeconds());
}
setInterval(tickClocks, 1000);
tickClocks();

/* ---------- Sun times (NOAA simplified algorithm) ---------- */
function sunTimesUT(date, lat, lon) {
  const rad = Math.PI / 180;
  const start = Date.UTC(date.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((date.getTime() - start) / 86400000);
  const lngHour = lon / 15;

  function calc(isRising) {
    const tt = dayOfYear + ((isRising ? 6 : 18) - lngHour) / 24;
    const M = 0.9856 * tt - 3.289;
    let L = M + 1.916 * Math.sin(rad * M) + 0.02 * Math.sin(2 * rad * M) + 282.634;
    L = ((L % 360) + 360) % 360;
    let RA = (1 / rad) * Math.atan(0.91764 * Math.tan(rad * L));
    RA = ((RA % 360) + 360) % 360;
    const Lq = Math.floor(L / 90) * 90;
    const RAq = Math.floor(RA / 90) * 90;
    RA = (RA + (Lq - RAq)) / 15;
    const sinDec = 0.39782 * Math.sin(rad * L);
    const cosDec = Math.cos(Math.asin(sinDec));
    const cosH = (Math.cos(rad * 90.833) - sinDec * Math.sin(rad * lat)) / (cosDec * Math.cos(rad * lat));
    if (cosH > 1 || cosH < -1) return null;
    let H = isRising ? 360 - (1 / rad) * Math.acos(cosH) : (1 / rad) * Math.acos(cosH);
    H = H / 15;
    const T = H + RA - 0.06571 * tt - 6.622;
    return ((T - lngHour) % 24 + 24) % 24;
  }
  return { riseUT: calc(true), setUT: calc(false) };
}

function utHoursToLocal(utHours, baseDate, tzOffset) {
  const utcMidnight = Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate());
  const dt = new Date(utcMidnight + Math.round(utHours * 3600000) + tzOffset * 3600000);
  return { h: dt.getUTCHours(), m: dt.getUTCMinutes() };
}

function renderDaylight(airport) {
  const card = document.getElementById("daylight-card");
  if (airport.lat === null) {
    card.style.display = "none";
    return;
  }
  card.style.display = "";
  const now = new Date();
  const { riseUT, setUT } = sunTimesUT(now, airport.lat, airport.lon);
  sunTimesCache = { riseUT, setUT, baseDate: now, tz: airport.tzOffset };

  if (riseUT === null || setUT === null) {
    document.getElementById("sunrise").textContent = "--:--";
    document.getElementById("sunset").textContent = "--:--";
    document.getElementById("noon").textContent = "--:--";
    document.getElementById("daylen").textContent = t("noSunData");
    return;
  }

  const rise = utHoursToLocal(riseUT, now, airport.tzOffset);
  const set = utHoursToLocal(setUT, now, airport.tzOffset);
  const noonUT = (riseUT + setUT) / 2;
  const noon = utHoursToLocal(noonUT, now, airport.tzOffset);

  document.getElementById("sunrise").textContent = `${pad2(rise.h)}:${pad2(rise.m)}`;
  document.getElementById("sunset").textContent = `${pad2(set.h)}:${pad2(set.m)}`;
  document.getElementById("noon").textContent = `${pad2(noon.h)}:${pad2(noon.m)}`;

  let dayLenH = setUT - riseUT;
  if (dayLenH < 0) dayLenH += 24;
  const hh = Math.floor(dayLenH);
  const mm = Math.round((dayLenH - hh) * 60);
  document.getElementById("daylen").textContent = lang === "ar" ? `${hh}س ${mm}د` : `${hh}h ${mm}m`;

  updateSunDot();
}

function updateSunDot() {
  if (!sunTimesCache) return;
  const { riseUT, setUT } = sunTimesCache;
  const path = document.querySelector("#sun-arc .arc-path");
  const dot = document.getElementById("sun-pos");
  if (!path || !dot) return;

  const now = new Date();
  const nowUT = now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600;
  let frac = (nowUT - riseUT) / (setUT - riseUT);
  frac = Math.max(0, Math.min(1, frac));

  const len = path.getTotalLength();
  const pt = path.getPointAtLength(frac * len);
  dot.setAttribute("cx", pt.x);
  dot.setAttribute("cy", pt.y);
}
setInterval(updateSunDot, 30000);

/* ---------- Compass ticks ---------- */
function buildCompassTicks() {
  const g = document.getElementById("compass-ticks");
  g.innerHTML = "";
  for (let deg = 0; deg < 360; deg += 10) {
    const isMajor = deg % 30 === 0;
    const len = isMajor ? 16 : 8;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", 150);
    line.setAttribute("y1", 14);
    line.setAttribute("x2", 150);
    line.setAttribute("y2", 14 + len);
    line.setAttribute("class", "compass-tick");
    line.setAttribute("transform", `rotate(${deg} 150 150)`);
    g.appendChild(line);
  }
}
buildCompassTicks();

/* ---------- Runway strip rendering ---------- */
function bearingPoint(cx, cy, r, bearingDeg) {
  const rad = (bearingDeg * Math.PI) / 180;
  return { x: cx + r * Math.sin(rad), y: cy - r * Math.cos(rad) };
}

function svgEl(tag, attrs) {
  const el = document.createElementNS("http://www.w3.org/2000/svg", tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  return el;
}

function renderRunwayMark(airport, activeRunwayIdx, wdir) {
  const g = document.getElementById("runway-mark");
  g.innerHTML = "";
  if (!airport.runways || airport.runways.length === 0) return;
  const rw = airport.runways[activeRunwayIdx] || airport.runways[0];
  const hdg = rw.hdgs[0];
  const cx = 150, cy = 150;
  const halfLen = 92;
  const width = 24;

  // Determine which end is "into wind" (favorable) for highlighting.
  let activeEndIdx = 0;
  if (typeof wdir === "number") {
    const c0 = windComponents(wdir, 1, rw.hdgs[0]).headwind;
    const c1 = windComponents(wdir, 1, rw.hdgs[1]).headwind;
    activeEndIdx = c1 > c0 ? 1 : 0;
  }

  // Runway strip (rotated rectangle through center)
  const strip = svgEl("rect", {
    x: cx - width / 2, y: cy - halfLen, width, height: halfLen * 2, rx: 4,
    class: "runway-strip", transform: `rotate(${hdg} ${cx} ${cy})`,
  });
  g.appendChild(strip);

  const edgeL = svgEl("line", { x1: cx - width / 2 + 1.5, y1: cy - halfLen + 4, x2: cx - width / 2 + 1.5, y2: cy + halfLen - 4, class: "runway-edge", transform: `rotate(${hdg} ${cx} ${cy})` });
  const edgeR = svgEl("line", { x1: cx + width / 2 - 1.5, y1: cy - halfLen + 4, x2: cx + width / 2 - 1.5, y2: cy + halfLen - 4, class: "runway-edge", transform: `rotate(${hdg} ${cx} ${cy})` });
  g.appendChild(edgeL);
  g.appendChild(edgeR);

  const dash = svgEl("line", { x1: cx, y1: cy - halfLen + 10, x2: cx, y2: cy + halfLen - 10, class: "runway-dash", transform: `rotate(${hdg} ${cx} ${cy})` });
  g.appendChild(dash);

  // Threshold marks near both ends
  for (const sign of [-1, 1]) {
    const yBase = cy + sign * (halfLen - 10);
    for (let i = -1; i <= 1; i += 2) {
      const thr = svgEl("rect", {
        x: cx + i * 6 - 1.6, y: yBase - 5, width: 3.2, height: 10,
        class: "runway-threshold", transform: `rotate(${hdg} ${cx} ${cy})`,
      });
      g.appendChild(thr);
    }
  }

  // End labels, positioned via true bearing so they stay upright (not rotated)
  const parts = rw.id.split("/");
  const labelRadius = 122;
  [0, 1].forEach((i) => {
    const bearing = rw.hdgs[i];
    const pt = bearingPoint(cx, cy, labelRadius, bearing);
    const label = svgEl("text", {
      x: pt.x, y: pt.y,
      class: "runway-label" + (i === activeEndIdx ? " active" : ""),
    });
    label.textContent = parts[i];
    g.appendChild(label);
  });
}

function renderCompass(wdir, wspd, wgst) {
  const needle = document.getElementById("wind-needle");
  if (wdir !== null && wdir !== undefined && typeof wdir === "number") {
    needle.setAttribute("transform", `rotate(${wdir} 150 150)`);
    needle.style.display = "";
  } else {
    needle.style.display = "none";
  }
  document.getElementById("wind-dir").textContent = typeof wdir === "number" ? `${padDir(wdir)}°` : "VRB";
  document.getElementById("wind-spd").textContent = wspd !== null && wspd !== undefined ? `${wspd} kt` : "--";
  document.getElementById("wind-gust").textContent = wgst ? `${wgst} kt` : t("none");
}

/* ---------- Runway selector ---------- */
function renderRunwaySelector(airport) {
  const wrap = document.getElementById("runway-selector");
  wrap.innerHTML = "";
  if (!airport.runways || airport.runways.length < 2) return;
  airport.runways.forEach((rw, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "runway-btn" + (idx === state.activeRunway ? " active" : "");
    btn.textContent = rw.id;
    btn.addEventListener("click", () => {
      state.activeRunway = idx;
      renderAll();
    });
    wrap.appendChild(btn);
  });
}

/* ---------- Runway crosswind table ---------- */
function renderRunwayTable(airport, wdir, wspd) {
  const wrap = document.getElementById("runway-table-wrap");
  if (!airport.runways || airport.runways.length === 0) {
    wrap.innerHTML = `<p class="hint">${t("noRunwayData")}</p>`;
    return;
  }
  if (typeof wdir !== "number" || wspd === null || wspd === undefined) {
    wrap.innerHTML = `<p class="hint">${t("noWindData")}</p>`;
    return;
  }

  let rows = "";
  for (const rw of airport.runways) {
    const options = rw.hdgs.map((h) => ({ h, ...windComponents(wdir, wspd, h) }));
    options.sort((a, b) => b.headwind - a.headwind);
    const best = options[0];
    const runwayLabel = rw.id.split("/")[best.h === rw.hdgs[0] ? 0 : 1];

    const windFlag =
      best.headwind >= 0
        ? `<span class="wind-flag flag-head">${t("headwind")} ${fmtNum(best.headwind, 1)} kt</span>`
        : `<span class="wind-flag flag-tail">${t("tailwind")} ${fmtNum(Math.abs(best.headwind), 1)} kt</span>`;

    const crossAbs = Math.abs(best.crosswind);
    const crossSide = best.crosswind >= 0 ? t("fromRight") : t("fromLeft");
    const crossFlag = `<span class="wind-flag flag-cross">${t("crosswind")} ${fmtNum(crossAbs, 1)} kt ${crossSide}</span>`;

    rows += `<tr>
      <td><strong>${rw.id}</strong><br><span class="hint" style="margin:0">${t("activeRunway")}: ${runwayLabel} (${best.h}°)</span></td>
      <td class="val">${windFlag}</td>
      <td class="val">${crossFlag}</td>
    </tr>`;
  }

  wrap.innerHTML = `<table>
    <thead><tr><th>${t("colRunway")}</th><th>${t("colHeadTail")}</th><th>${t("colCross")}</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/* ---------- Hero category banner ---------- */
function renderHero(metar, airport) {
  const cat = metar.fltCat || computeFlightCategory(parseVisib(metar.visib), parseCeilingFt(metar.clouds));
  document.getElementById("hero-airport-name").textContent = airportDisplayName(airport) || metar.name || metar.icaoId;
  document.getElementById("hero-airport-code").textContent = `${metar.icaoId || ""}${airport.city ? " · " + airportDisplayCity(airport) : metar.name ? " · " + metar.name : ""}`;
  const badge = document.getElementById("hero-cat-badge");
  badge.className = "hero-cat-badge " + cat;
  document.getElementById("hero-cat-value").textContent = cat;
}

/* ---------- Active runway (calculated from wind favorability) ---------- */
function computeActiveRunwayLabel(airport, rwIdx, wdir) {
  if (!airport.runways || airport.runways.length === 0 || typeof wdir !== "number") return null;
  const rw = airport.runways[rwIdx] || airport.runways[0];
  const c0 = windComponents(wdir, 1, rw.hdgs[0]).headwind;
  const c1 = windComponents(wdir, 1, rw.hdgs[1]).headwind;
  const idx = c1 > c0 ? 1 : 0;
  return rw.id.split("/")[idx];
}

function renderHeroRunway(metar, airport) {
  const wrap = document.getElementById("hero-rwy");
  if (!airport.runways || airport.runways.length === 0) {
    wrap.style.display = "none";
    return;
  }
  wrap.style.display = "";

  const wdir = metar.wdir;
  const valueEl = document.getElementById("hero-rwy-value");
  if (typeof wdir === "number") {
    const label = computeActiveRunwayLabel(airport, state.activeRunway, wdir);
    valueEl.textContent = "RWY " + label;
  } else if (wdir === "VRB") {
    valueEl.textContent = t("rwyVariable");
  } else {
    valueEl.textContent = t("rwyNoData");
  }
}

/* ---------- Quick stats ---------- */
function renderQuickStats(metar) {
  const cat = metar.fltCat || computeFlightCategory(parseVisib(metar.visib), parseCeilingFt(metar.clouds));
  const rh = relativeHumidity(metar.temp, metar.dewp);
  const ageMin = metar.obsTime ? Math.round((Date.now() / 1000 - metar.obsTime) / 60) : null;

  const stats = [
    { icon: "🚦", label: t("statCategory"), value: cat, cls: `cat-${cat}`, badge: true },
    { icon: "🌡️", label: t("statTemp"), value: metar.temp !== undefined && metar.temp !== null ? `${fmtNum(metar.temp)}°C` : "--" },
    { icon: "💧", label: t("statDew"), value: metar.dewp !== undefined && metar.dewp !== null ? `${fmtNum(metar.dewp)}°C` : "--" },
    { icon: "💦", label: t("statHumidity"), value: rh !== null ? `${rh}%` : "--" },
    { icon: "🧭", label: t("statWind"), value: fmtWind(metar.wdir, metar.wspd, metar.wgst) },
    { icon: "👁️", label: t("statVisibility"), value: metar.visib !== undefined ? `${metar.visib} SM` : "--" },
    { icon: "🌧️", label: t("statRain"), value: state && state.rainProb !== null && state.rainProb !== undefined ? `${state.rainProb}%` : "--" },
    { icon: "📊", label: t("statQnh"), value: metar.altim !== undefined && metar.altim !== null ? `${fmtNum(metar.altim, 1)} hPa` : "--" },
    { icon: "🕐", label: t("statAge"), value: ageMin !== null ? `${ageMin} ${t("minutesAgo")}` : "--" },
  ];

  const wrap = document.getElementById("quickstats");
  wrap.innerHTML = stats
    .map(
      (s) => `<div class="stat fade-in ${s.badge ? "badge " + s.cls : ""}">
        <span class="stat-icon">${s.icon}</span>
        <span class="stat-value">${s.value}</span>
        <span class="stat-label">${s.label}</span>
      </div>`
    )
    .join("");
}

/* ---------- Decoded details table ---------- */
function renderDecodedTable(metar) {
  const rows = [
    [t("dICAO"), metar.icaoId || "--"],
    [t("dName"), metar.name || "--"],
    [t("dTime"), metar.reportTime || "--"],
    [t("dCategory"), catLabel(metar.fltCat || computeFlightCategory(parseVisib(metar.visib), parseCeilingFt(metar.clouds)))],
    [t("dTemp"), metar.temp !== undefined && metar.temp !== null ? `${fmtNum(metar.temp)} °C` : "--"],
    [t("dDew"), metar.dewp !== undefined && metar.dewp !== null ? `${fmtNum(metar.dewp)} °C` : "--"],
    [t("dWindDir"), metar.wdir !== undefined && metar.wdir !== null ? `${padDir(metar.wdir)}°` : t("variable")],
    [t("dWindSpeed"), metar.wspd !== undefined ? `${metar.wspd} kt` : "--"],
    [t("dGust"), metar.wgst ? `${metar.wgst} kt` : t("none")],
    [t("dVisibility"), metar.visib !== undefined ? `${metar.visib} SM` : "--"],
    [t("dQnh"), metar.altim !== undefined && metar.altim !== null ? `${fmtNum(metar.altim, 1)} hPa` : "--"],
    [t("dWeather"), metar.wxString || t("noWx")],
    [t("dClouds"), (metar.clouds || []).map((c) => `${c.cover}${c.base ? " " + c.base + "ft" : ""}`).join(" / ") || t("clearSky")],
  ];

  const tbody = document.querySelector("#decoded-table tbody");
  tbody.innerHTML = rows.map(([k, v]) => `<tr><td>${k}</td><td>${v}</td></tr>`).join("");
}

/* ---------- TAF timeline ---------- */
function renderTaf(taf, tzOffset) {
  const tbody = document.querySelector("#taf-table tbody");
  if (!taf || !Array.isArray(taf.fcsts) || taf.fcsts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">${t("noTaf")}</td></tr>`;
    return;
  }

  const typeLabel = { FM: t("periodFM"), BECMG: t("periodBECMG"), TEMPO: t("periodTEMPO"), PROB: t("periodPROB"), INITIAL: t("periodINITIAL") };

  const rows = taf.fcsts.map((f) => {
    const visib = parseVisib(f.visib);
    const ceil = parseCeilingFt(f.clouds);
    const cat = computeFlightCategory(visib, ceil);

    const from = f.timeFrom ? new Date(f.timeFrom * 1000) : null;
    const to = f.timeTo ? new Date(f.timeTo * 1000) : null;
    const fmtT = (d) => {
      if (!d || tzOffset === null) return "--";
      const l = new Date(d.getTime() + tzOffset * 3600000);
      return `${pad2(l.getUTCDate())}/${pad2(l.getUTCMonth() + 1)} ${pad2(l.getUTCHours())}:${pad2(l.getUTCMinutes())}`;
    };

    const kind = typeLabel[f.fcstType] || f.fcstType || t("periodINITIAL");
    const period = `${kind}<br><span class="hint" style="margin:0">${fmtT(from)} → ${fmtT(to)}</span>`;
    const wind = fmtWind(f.wdir, f.wspd, f.wgst);
    const visTxt = f.visib !== undefined && f.visib !== null && f.visib !== "" ? `${f.visib} SM` : "--";
    const ceilTxt = ceil !== null ? `${ceil} ft` : t("none");
    const wx = f.wxString || "--";

    return `<tr>
      <td>${period}</td>
      <td><span class="cat-pill ${cat}">${cat}</span></td>
      <td>${wind}</td>
      <td>${visTxt}</td>
      <td>${ceilTxt}</td>
      <td>${wx}</td>
    </tr>`;
  });

  tbody.innerHTML = rows.join("");
}

/* ---------- METAR history ---------- */
function weatherIcon(m) {
  const wx = (m.wxString || "").toUpperCase();
  if (wx.includes("TS")) return "⛈️";
  if (wx.includes("RA") || wx.includes("DZ") || wx.includes("SH")) return "🌧️";
  if (wx.includes("SN")) return "❄️";
  if (wx.includes("FG") || wx.includes("BR") || wx.includes("HZ") || wx.includes("DU") || wx.includes("SA")) return "🌫️";
  const covers = (m.clouds || []).map((c) => (c.cover || "").toUpperCase());
  if (covers.includes("OVC") || covers.includes("VV")) return "☁️";
  if (covers.includes("BKN")) return "🌥️";
  if (covers.includes("SCT") || covers.includes("FEW")) return "🌤️";
  return "☀️";
}

function renderMetarHistory(history, tzOffset) {
  const tbody = document.querySelector("#metar-history-table tbody");
  if (!history || history.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">${t("none")}</td></tr>`;
    return;
  }

  const rows = history.map((m) => {
    const cat = m.fltCat || computeFlightCategory(parseVisib(m.visib), parseCeilingFt(m.clouds));
    const ceil = parseCeilingFt(m.clouds);
    let timeTxt = "--";
    if (m.obsTime) {
      const l = new Date(m.obsTime * 1000 + (tzOffset ?? 0) * 3600000);
      timeTxt = `${pad2(l.getUTCDate())}/${pad2(l.getUTCMonth() + 1)} ${pad2(l.getUTCHours())}:${pad2(l.getUTCMinutes())}`;
    }
    return `<tr>
      <td>${timeTxt}</td>
      <td><span class="cat-pill ${cat}">${cat}</span></td>
      <td>${weatherIcon(m)}</td>
      <td>${m.temp !== undefined && m.temp !== null ? fmtNum(m.temp) + "°C" : "--"}</td>
      <td>${m.visib !== undefined && m.visib !== null ? m.visib + " SM" : "--"}</td>
      <td>${ceil !== null ? ceil + " ft" : t("none")}</td>
      <td>${fmtWind(m.wdir, m.wspd, m.wgst)}</td>
      <td class="metar-raw-cell">${m.rawOb || "--"}</td>
    </tr>`;
  });

  tbody.innerHTML = rows.join("");
}

/* ---------- Central render pipeline (no refetch) ---------- */
function renderAll() {
  if (!state) return;
  const { airport, metar, taf } = state;

  renderHero(metar, airport);
  renderHeroRunway(metar, airport);
  renderQuickStats(metar);
  renderCompass(metar.wdir ?? null, metar.wspd ?? null, metar.wgst ?? null);
  renderRunwaySelector(airport);
  renderRunwayMark(airport, state.activeRunway, metar.wdir ?? null);
  renderRunwayTable(airport, metar.wdir ?? null, metar.wspd ?? null);
  renderDecodedTable(metar);
  renderDaylight(airport);

  document.getElementById("raw-metar").textContent = metar.rawOb || "N/A";
  document.getElementById("raw-taf").textContent = (taf && taf.rawTAF) || "N/A";
  renderTaf(taf, airport.tzOffset ?? 3);
  renderMetarHistory(state.metarHistory, airport.tzOffset ?? 3);
}

/* ---------- Fetch & orchestrate ---------- */
async function fetchJsonOnce(url) {
  const res = await fetch(url, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.trim()) throw new Error("empty response");
  return JSON.parse(text);
}

async function fetchJson(url) {
  try {
    return await fetchJsonOnce(url);
  } catch (err) {
    await new Promise((r) => setTimeout(r, 700));
    return fetchJsonOnce(url);
  }
}

/* Real hourly precipitation-probability forecast (Open-Meteo, free, CORS-enabled — no proxy needed). */
async function fetchRainProbability(lat, lon) {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=precipitation_probability&timezone=UTC&forecast_days=2`;
    const data = await fetchJsonOnce(url);
    const times = data.hourly && data.hourly.time;
    const probs = data.hourly && data.hourly.precipitation_probability;
    if (!times || !probs) return null;
    const now = new Date();
    const nowHourStr = `${now.getUTCFullYear()}-${pad2(now.getUTCMonth() + 1)}-${pad2(now.getUTCDate())}T${pad2(now.getUTCHours())}:00`;
    const idx = times.indexOf(nowHourStr);
    return idx === -1 ? null : probs[idx];
  } catch (err) {
    console.error("Failed to fetch rain probability", err);
    return null;
  }
}

async function loadWeather(icaoRaw) {
  const icao = (icaoRaw || DEFAULT_ICAO).trim().toUpperCase();
  const airport = getAirport(icao);
  const banner = document.getElementById("status-banner");
  banner.className = "status-banner";
  banner.removeAttribute("data-i18n");
  banner.textContent = `${t("fetching")} ${icao}...`;

  try {
    const [metarArr, tafArr, rainProb, metarHistory] = await Promise.all([
      fetchJson(`/proxy/metar?ids=${icao}`),
      fetchJson(`/proxy/taf?ids=${icao}`),
      airport.lat !== null ? fetchRainProbability(airport.lat, airport.lon) : Promise.resolve(null),
      fetchJson(`/proxy/metar?ids=${icao}&hours=24`).catch(() => null),
    ]);

    if (!metarArr || metarArr.length === 0) {
      banner.className = "status-banner error";
      banner.textContent = `⚠️ ${t("noMetar")} ${icao}. ${t("checkIcao")}`;
      return;
    }

    const metar = metarArr[0];
    const taf = tafArr && tafArr.length ? tafArr[0] : null;

    state = { icao, airport, metar, taf, rainProb, metarHistory: metarHistory || [metar], activeRunway: 0 };
    renderAll();

    banner.className = "status-banner ok";
    const now = new Date();
    document.getElementById("last-updated").textContent =
      `${t("lastUpdated")} ` + pad2(now.getUTCHours()) + ":" + pad2(now.getUTCMinutes()) + " UTC";
  } catch (err) {
    banner.className = "status-banner error";
    banner.textContent = `❌ ${t("fetchError")} (${err.message}). ${t("checkConn")}`;
    console.error(err);
  }
}

function scheduleRefresh(icao) {
  if (refreshTimer) clearInterval(refreshTimer);
  refreshTimer = setInterval(() => loadWeather(icao), REFRESH_MS);
}

document.getElementById("icao-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const icao = document.getElementById("icao-input").value.trim().toUpperCase() || DEFAULT_ICAO;
  document.getElementById("icao-input").value = icao;
  loadWeather(icao);
  scheduleRefresh(icao);
});

/* ---------- Fixed Bahrain communications reference (independent of ICAO search) ---------- */
function renderComms() {
  const tbody = document.querySelector("#comms-table tbody");
  const comms = AIRPORTS.OBBI.comms || [];
  tbody.innerHTML = comms.map((c) => `<tr><td>${t("comms" + c.role.charAt(0).toUpperCase() + c.role.slice(1))}</td><td>${c.freq} MHz</td></tr>`).join("");
}
document.addEventListener("langchange", renderComms);

/* ---------- Language toggle ---------- */
function applyStaticTranslations() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    if (STR[key]) el.textContent = STR[key][lang];
  });
  document.getElementById("lang-toggle").textContent = lang === "ar" ? "EN" : "عربي";
  document.title = lang === "ar" ? "طقس الطيران | مطار البحرين الدولي OBBI" : "Pilot Weather | Bahrain International Airport OBBI";
}

function setLang(l) {
  lang = l;
  localStorage.setItem("obbi_lang", l);
  applyStaticTranslations();
  if (state) renderAll();
  document.dispatchEvent(new CustomEvent("langchange"));
}

document.getElementById("lang-toggle").addEventListener("click", () => {
  setLang(lang === "ar" ? "en" : "ar");
});

/* ---------- Init ---------- */
applyStaticTranslations();
renderComms();
loadWeather(DEFAULT_ICAO);
scheduleRefresh(DEFAULT_ICAO);
