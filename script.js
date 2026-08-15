"use strict";

/* ---------- Airport database (extend as needed) ---------- */
const AIRPORTS = {
  OBBI: {
    name: "Bahrain International Airport",
    nameAr: "مطار البحرين الدولي",
    city: "Muharraq, Bahrain",
    cityAr: "المحرق، البحرين",
    lat: 26.2708, lon: 50.6336, tzOffset: 3,
    fir: "OBBB",
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

// Temporary manual backup, used ONLY when the live fetch fails on first load
// (aviationweather.gov has been intermittently unreachable from Cloudflare's
// network). Never overwrites already-loaded live data. Remove once resolved.
const MANUAL_FALLBACK = {
  OBBI: {
    icaoId: "OBBI",
    name: "Bahrain Intl, MU, BH",
    rawOb: "METAR OBBI 131800Z 10007KT 9000 NSC 35/30 Q1000 NOSIG",
    temp: 35,
    dewp: 30,
    wdir: 100,
    wspd: 7,
    visib: 5.59,
    altim: 1000,
    clouds: [],
    wxString: null,
    elev: 6,
    fltCat: "VFR",
    obsTime: null,
    reportTime: null,
  },
};

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
  metarSpeakTitle: { ar: "استمع للتقرير مقروءاً بالإنجليزية", en: "Listen to the report read aloud (English)" },
  metarSpeakStop: { ar: "إيقاف القراءة", en: "Stop reading" },
  metarSpeakUnsupported: { ar: "المتصفح لا يدعم القراءة الصوتية", en: "Your browser doesn't support text-to-speech" },
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
  statAqi: { ar: "جودة الهواء", en: "Air Quality" },
  aqiGood: { ar: "جيدة", en: "Good" },
  aqiModerate: { ar: "متوسطة", en: "Moderate" },
  aqiSensitive: { ar: "غير صحية للفئات الحساسة", en: "Unhealthy for Sensitive Groups" },
  aqiUnhealthy: { ar: "غير صحية", en: "Unhealthy" },
  aqiVeryUnhealthy: { ar: "غير صحية جداً", en: "Very Unhealthy" },
  aqiHazardous: { ar: "خطرة", en: "Hazardous" },
  switchUnit: { ar: "اضغط لتغيير الوحدة", en: "Tap to switch unit" },
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

  rsTitle: { ar: "المدرجات", en: "Runways" },
  rsHint: {
    ar: "البيانات الفيزيائية مرجعية — الاتجاه المغناطيسي والطول والعرض من مصادرنا المتحقق منها؛ الاتجاه الحقيقي وإحداثيات العتبة تقديرية محسوبة، وليست من منشور AIP رسمي.",
    en: "Physical data for reference — magnetic heading, length, and width are from our verified sources; true heading and threshold coordinates are computed estimates, not from an official AIP.",
  },
  rsId: { ar: "المعرف", en: "ID" },
  rsTrueHdg: { ar: "الاتجاه الحقيقي", en: "True Heading" },
  rsMagHdg: { ar: "الاتجاه المغناطيسي", en: "Magnetic Heading" },
  rsLength: { ar: "الطول", en: "Length" },
  rsWidth: { ar: "العرض", en: "Width" },
  rsSurface: { ar: "السطح", en: "Surface" },
  rsLat: { ar: "خط العرض", en: "Latitude" },
  rsLon: { ar: "خط الطول", en: "Longitude" },
  surfaceAsphalt: { ar: "إسفلت", en: "Asphalt" },
  activeRunway: { ar: "مدرج بالخدمة", en: "Runway in use" },
  headwind: { ar: "رياح أمامية", en: "Headwind" },
  tailwind: { ar: "رياح خلفية", en: "Tailwind" },
  crosswind: { ar: "جانبية", en: "Crosswind" },
  fromRight: { ar: "من اليمين", en: "from right" },
  fromLeft: { ar: "من اليسار", en: "from left" },
  noRunwayData: { ar: "لا تتوفر بيانات مدرج مسجّلة لهذا المطار في قاعدة البيانات المحلية.", en: "No runway data registered for this airport in the local database." },
  noWindData: { ar: "بيانات الرياح غير متوفرة حالياً.", en: "Wind data currently unavailable." },
  xwindLimitLabel: { ar: "الحد الأقصى للرياح الجانبية لطائرتك (kt)", en: "Your aircraft's max demonstrated crosswind (kt)" },
  xwindExceeded: { ar: "⚠️ يتجاوز حدك الشخصي", en: "⚠️ Exceeds your limit" },

  daTitle: { ar: "ارتفاع الكثافة (Density Altitude)", en: "Density Altitude" },
  daHint: {
    ar: "محسوب من درجة الحرارة والضغط الحاليين وارتفاع المطار — يؤثر مباشرة على أداء الإقلاع والتسلق.",
    en: "Computed from the current temperature, altimeter setting, and field elevation — directly affects takeoff and climb performance.",
  },
  daLabel: { ar: "ارتفاع الكثافة", en: "Density Altitude" },
  daFieldElev: { ar: "ارتفاع المطار", en: "Field Elevation" },
  daPressureAlt: { ar: "الارتفاع الضغطي", en: "Pressure Altitude" },
  daDiff: { ar: "الفرق عن الارتفاع الفعلي", en: "Difference from Field Elevation" },
  daNoteSevere: {
    ar: "الأداء منخفض بشكل ملحوظ اليوم — توقّع مسافة إقلاع أطول ومعدل تسلق أبطأ بكثير. تعامل مع الأمر وكأن المطار أعلى بكثير مما هو عليه فعلياً.",
    en: "Performance is significantly degraded today — expect a much longer takeoff roll and reduced climb rate. Treat this like departing from a considerably higher airfield.",
  },
  daNoteModerate: {
    ar: "تأثير ملحوظ على الأداء — راجع جداول أداء طائرتك قبل الإقلاع.",
    en: "Noticeable performance impact — check your aircraft's performance charts before departure.",
  },
  daNoteNormal: { ar: "تأثير الأداء ضئيل اليوم.", en: "Performance impact is minimal today." },

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
  fallbackNotice: {
    ar: "تعذّر الوصول لمصدر البيانات الحية حالياً — المعروض أدناه تقرير METAR احتياطي أُدخل يدوياً (غير حي) مؤقتاً ريثما يتم حل مشكلة الاتصال.",
    en: "Live data source is temporarily unreachable — showing a manually entered backup METAR below (not real-time) while we resolve a connectivity issue.",
  },
  sigmetFetchFailed: { ar: "تعذّر جلب بيانات SIGMET حالياً.", en: "Unable to fetch SIGMET data right now." },
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
    ar: "مستخرجة تلقائياً من نشرة PIB الرسمية للبحرين — هذه النشرة ليست بالضرورة محدثة لحظياً، والموقع الرسمي لا يضمن تحديثها يومياً كما هو معلن. تحقق دائماً من البوابة الرسمية قبل الطيران الفعلي.",
    en: "Auto-extracted from Bahrain's official PIB bulletin — this bulletin isn't guaranteed to refresh in real time despite being labeled \"Daily\" on the official site. Always verify with the official portal before actual flight.",
  },
  notamBtn: { ar: "افتح بوابة معلومات الطيران الرسمية للبحرين (AIS)", en: "Open Bahrain's Official AIS Portal" },
  notamFresh: { ar: "آخر إصدار للنشرة", en: "Bulletin last issued" },
  notamNone: { ar: "لا توجد نوتامات نشطة ضمن هذه النشرة.", en: "No active NOTAMs in this bulletin." },
  notamFetchFailed: { ar: "تعذر جلب نشرة النوتام حالياً.", en: "Could not fetch the NOTAM bulletin right now." },
  notamCatWARN: { ar: "تحذير", en: "Warning" },
  notamCatINFO: { ar: "معلومة", en: "Info" },
  notamCatAGA: { ar: "مرافق أرضية", en: "Ground Aids" },
  notamCatATM: { ar: "إدارة حركة جوية", en: "Air Traffic" },
  notamScopeFIR: { ar: "منطقة معلومات الطيران", en: "FIR-wide" },
  notamScopeDEP: { ar: "المغادرة", en: "Departure" },
  notamScopeDEST: { ar: "الوجهة", en: "Destination" },
  notamScopeINTM: { ar: "وسيط", en: "Intermediate" },

  bulletinTitle: { ar: "النشرة الجوية العامة (البحرين)", en: "Public Weather Bulletin (Bahrain)" },
  bWeather: { ar: "الطقس", en: "Weather" },
  bWind: { ar: "الرياح", en: "Wind" },
  bWarning: { ar: "التحذير", en: "Warning" },
  bSeaState: { ar: "حالة البحر", en: "Sea State" },
  bulletinValidFrom: { ar: "سارية من", en: "Valid from" },
  bulletinValidUntil: { ar: "حتى", en: "until" },
  bulletinLocal: { ar: "بتوقيت البحرين", en: "Bahrain local time" },
  bulletinExpired: {
    ar: "⚠️ انتهت صلاحية هذه النشرة ولم تُصدر إدارة الأرصاد البحرينية نشرة جديدة بعد — القيم المعروضة من آخر نشرة متوفرة.",
    en: "⚠️ This bulletin's validity window has expired and Bahrain's Met Directorate hasn't published a new one yet — showing the last available bulletin.",
  },
  bulletinFetchFailed: { ar: "تعذر جلب النشرة الجوية العامة حالياً.", en: "Could not fetch the public weather bulletin right now." },

  heliTitle: { ar: "توقعات المروحيات والمنطقة المحلية", en: "Helicopter Ops & Local Area Forecast" },
  heliHint: {
    ar: "مستخرجة تلقائياً من نشرة إدارة الأرصاد الجوية البحرينية الرسمية — رياح وحرارة من السطح حتى FL390، مستوى التجمد، منسوب التروبوبوز، وتحذيرات التجمد لدائرة 50 كم حول مطار البحرين الدولي.",
    en: "Auto-extracted from Bahrain Met Directorate's official bulletin — winds and temperature from the surface to FL390, freezing level, tropopause, and icing warnings for a 50km radius around Bahrain International Airport.",
  },
  heliBtn: { ar: "افتح نشرة توقعات المروحيات والمنطقة المحلية (PDF)", en: "Open Helicopter Ops / Local Area Forecast (PDF)" },
  heliFetchFailed: { ar: "تعذر جلب نشرة توقعات المروحيات حالياً.", en: "Could not fetch the helicopter ops forecast right now." },
  heliIssued: { ar: "صدرت", en: "Issued" },
  heliValidFrom: { ar: "سارية من", en: "Valid from" },
  heliValidUntil: { ar: "حتى", en: "until" },
  heliSynopsis: { ar: "الوضع العام", en: "Synopsis" },
  heliWarnings: { ar: "تحذيرات", en: "Warnings" },
  heliSurface: { ar: "السطح", en: "Surface" },
  heliSurfaceCloud: { ar: "الغيوم عند السطح", en: "Surface Cloud" },
  heliLevelsTitle: { ar: "الرياح والحرارة حسب الارتفاع", en: "Winds & Temperature Aloft" },
  heliColLevel: { ar: "المستوى", en: "Level" },
  heliColWind: { ar: "الرياح", en: "Wind" },
  heliColTemp: { ar: "الحرارة", en: "Temp" },
  heliVisibility: { ar: "الرؤية", en: "Visibility" },
  heliWeather: { ar: "الطقس", en: "Weather" },
  heliIsotherm: { ar: "خط تجمد 0°C", en: "0°C Isotherm" },
  heliContrails: { ar: "خطوط التكاثف", en: "Contrails" },
  heliTropopause: { ar: "التروبوبوز", en: "Tropopause" },
  heliIcing: { ar: "تجمد الهيكل", en: "Airframe Icing" },
  heliSunTimes: { ar: "الشروق / الغروب (UTC)", en: "Sunrise / Sunset (UTC)" },
  heliOutlook: { ar: "توقعات الـ 12 ساعة القادمة", en: "Next 12-Hour Outlook" },
  heliRemarks: { ar: "ملاحظات", en: "Remarks" },
  heliportsTitle: { ar: "أقرب مهابط الهليكوبتر", en: "Nearby Heliports" },
  heliportColName: { ar: "المهبط", en: "Heliport" },
  heliportColId: { ar: "المعرف", en: "ID" },
  heliportColDist: { ar: "المسافة", en: "Distance" },
  heliportColDir: { ar: "الاتجاه", en: "Direction" },

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

  sigmetTitle: { ar: "تحذيرات SIGMET — منطقة معلومات الطيران", en: "SIGMET — Flight Information Region" },
  sigmetHint: {
    ar: "تحذيرات جوية رسمية من مصدر NOAA — لا تُغني عن الإحاطة الرسمية قبل الرحلة.",
    en: "Official aviation hazard advisories from NOAA — not a substitute for an official pre-flight briefing.",
  },
  sigmetNone: { ar: "لا توجد تحذيرات SIGMET نشطة حالياً لهذه المنطقة.", en: "No active SIGMETs currently for this region." },
  sigmetUnavailable: { ar: "بيانات SIGMET غير مرتبطة بهذا المطار حالياً.", en: "SIGMET data isn't mapped to this airport yet." },
  bahrainOnlyNote: {
    ar: "هذا القسم خاص ببيانات البحرين (مطار OBBI) فقط، ولا يتوفر للمطارات الأخرى التي تبحث عنها.",
    en: "This section is Bahrain (OBBI)-specific data only and isn't available for other airports you search.",
  },
  sigmetValid: { ar: "صالح", en: "Valid" },
  sigmetAlt: { ar: "الارتفاع", en: "Altitude" },
  sigmetSurface: { ar: "من السطح", en: "Surface" },
  hazardTURB: { ar: "اضطراب (Turbulence)", en: "Turbulence" },
  hazardICE: { ar: "تجمد (Icing)", en: "Icing" },
  hazardMTW: { ar: "موجة جبلية (Mountain Wave)", en: "Mountain Wave" },
  hazardTS: { ar: "عاصفة رعدية (Thunderstorm)", en: "Thunderstorm" },
  hazardTSGR: { ar: "عاصفة رعدية مع برد", en: "Thunderstorm with Hail" },
  hazardGR: { ar: "برد (Hail)", en: "Hail" },
  hazardDS: { ar: "عاصفة ترابية (Dust Storm)", en: "Dust Storm" },
  hazardSS: { ar: "عاصفة رملية (Sand Storm)", en: "Sand Storm" },
  hazardVA: { ar: "رماد بركاني (Volcanic Ash)", en: "Volcanic Ash" },
  hazardTC: { ar: "إعصار مداري (Tropical Cyclone)", en: "Tropical Cyclone" },
  hazardIFR: { ar: "طيران آلي منخفض (IFR)", en: "IFR Conditions" },
  hazardMTOBSC: { ar: "جبال محجوبة", en: "Mountains Obscured" },
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

// Approximate magnetic variation for the Bahrain region (°E). Used only to
// derive an indicative true heading from the magnetic heading we actually
// use for wind calculations — not sourced from an official AIP.
const BAHRAIN_MAG_VAR = 4;

// Geodesic destination point (Earth treated as a sphere) — used to derive
// approximate runway threshold coordinates by projecting from the airport's
// known reference point along the runway bearing, rather than trusting any
// unverified lat/lon figures for individual thresholds.
function destinationPoint(lat, lon, bearingDeg, distanceM) {
  const R = 6371000;
  const delta = distanceM / R;
  const theta = (bearingDeg * Math.PI) / 180;
  const phi1 = (lat * Math.PI) / 180;
  const lambda1 = (lon * Math.PI) / 180;
  const phi2 = Math.asin(Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta));
  const lambda2 = lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * Math.sin(phi2));
  return { lat: (phi2 * 180) / Math.PI, lon: (((lambda2 * 180) / Math.PI + 540) % 360) - 180 };
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

/* ---------- Unit preferences (temperature / visibility) ---------- */
let tempUnit = localStorage.getItem("obbi_temp_unit") || "C";
let visUnit = localStorage.getItem("obbi_vis_unit") || "SM";

function fmtTemp(c) {
  if (c === undefined || c === null) return "--";
  if (tempUnit === "F") return `${Math.round((c * 9) / 5 + 32)}°F`;
  return `${fmtNum(c)}°C`;
}

function fmtVis(rawVisib) {
  if (rawVisib === undefined || rawVisib === null || rawVisib === "") return "--";
  if (visUnit === "SM") return `${rawVisib} SM`;
  const num = parseVisib(rawVisib);
  if (num === null) return "--";
  const hasPlus = typeof rawVisib === "string" && rawVisib.endsWith("+");
  const km = num * 1.609344;
  const kmStr = km >= 10 ? Math.round(km).toString() : km.toFixed(1);
  return `${kmStr}${hasPlus ? "+" : ""} km`;
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

/* Two-digit aviation heading numbers at every 30°, skipping the cardinal
   positions (0/90/180/270) which already show N/E/S/W. Lets a pilot read
   runway-vs-wind alignment at a glance, same convention as a real HSI. */
function buildCompassHeadingNums() {
  const g = document.getElementById("compass-heading-nums");
  g.innerHTML = "";
  const cx = 150, cy = 150, r = 118;
  for (let deg = 0; deg < 360; deg += 30) {
    if (deg % 90 === 0) continue;
    const rad = (deg * Math.PI) / 180;
    const x = cx + r * Math.sin(rad);
    const y = cy - r * Math.cos(rad);
    const label = String(Math.round(deg / 10)).padStart(2, "0");
    const text = svgEl("text", { x, y, class: "compass-heading-num", "text-anchor": "middle", "dominant-baseline": "middle" });
    text.textContent = label;
    g.appendChild(text);
  }
}
buildCompassHeadingNums();

/* ---------- Runway strip rendering ---------- */
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

  // Runway numbers painted directly on the strip (matches real runway
  // threshold markings) so wind-vs-runway alignment reads at a glance.
  // Both labels share the strip's own rotation (hdg) so they can't drift
  // out of alignment with it; the far one gets an additional LOCAL 180°
  // flip around its own position (not the shared center) so it still
  // reads upright from its own approach direction.
  const parts = rw.id.split("/");
  const labelInset = 22;
  const y0 = cy - halfLen + labelInset;
  const y1 = cy + halfLen - labelInset;

  const label0 = svgEl("text", {
    x: cx, y: y0,
    class: "runway-num-label" + (activeEndIdx === 0 ? " active" : ""),
    transform: `rotate(${hdg} ${cx} ${cy})`,
  });
  label0.textContent = parts[0];
  g.appendChild(label0);

  const label1 = svgEl("text", {
    x: cx, y: y1,
    class: "runway-num-label" + (activeEndIdx === 1 ? " active" : ""),
    transform: `rotate(${hdg} ${cx} ${cy}) rotate(180 ${cx} ${y1})`,
  });
  label1.textContent = parts[1];
  g.appendChild(label1);
}

function renderCompass(wdir, wspd, wgst) {
  const needle = document.getElementById("wind-needle");
  if (wdir !== null && wdir !== undefined && typeof wdir === "number") {
    needle.setAttribute("transform", `rotate(${wdir} 150 150)`);
    needle.style.display = "";
  } else {
    needle.style.display = "none";
  }
  if (typeof wspd === "number" && wspd > 0) {
    const dur = 3.2 - (Math.min(wspd, 40) / 40) * 2.7;
    needle.style.setProperty("--wind-flow-dur", `${dur.toFixed(2)}s`);
    needle.classList.remove("wind-calm");
  } else {
    needle.classList.add("wind-calm");
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
function getXwindLimit() {
  const raw = localStorage.getItem("obbi_xwind_limit");
  const n = parseFloat(raw);
  return raw && !isNaN(n) && n > 0 ? n : null;
}

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

  const limit = getXwindLimit();
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
    const exceeded = limit !== null && crossAbs > limit;
    const crossFlag = `<span class="wind-flag ${exceeded ? "flag-exceeded" : "flag-cross"}">${t("crosswind")} ${fmtNum(crossAbs, 1)} kt ${crossSide}</span>${
      exceeded ? `<br><span class="xwind-exceeded-note">${t("xwindExceeded")}</span>` : ""
    }`;

    rows += `<tr${exceeded ? ' class="xwind-row-exceeded"' : ""}>
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

/* ---------- Runway specs table (physical reference data) ---------- */
function renderRunwaySpecs(airport) {
  const card = document.getElementById("runway-specs-card");
  const wrap = document.getElementById("runway-specs-wrap");
  if (!airport.runways || airport.runways.length === 0 || airport.lat === null) {
    card.style.display = "none";
    return;
  }
  card.style.display = "";

  const rows = [];
  for (const rw of airport.runways) {
    const parts = rw.id.split("/");
    for (let i = 0; i < 2; i++) {
      const magHdg = rw.hdgs[i];
      const trueHdg = Math.round((magHdg + BAHRAIN_MAG_VAR + 360) % 360);
      const pt = destinationPoint(airport.lat, airport.lon, magHdg, rw.lengthM / 2);
      rows.push(`<tr>
        <td><strong>${parts[i]}</strong></td>
        <td>${trueHdg}°</td>
        <td>${padDir(magHdg)}°</td>
        <td>${rw.lengthM.toLocaleString()} m</td>
        <td>${rw.widthM} m</td>
        <td>${t("surfaceAsphalt")}</td>
        <td>${pt.lat.toFixed(4)}</td>
        <td>${pt.lon.toFixed(4)}</td>
      </tr>`);
    }
  }

  wrap.innerHTML = `<table>
    <thead><tr>
      <th>${t("rsId")}</th>
      <th>${t("rsTrueHdg")}</th>
      <th>${t("rsMagHdg")}</th>
      <th>${t("rsLength")}</th>
      <th>${t("rsWidth")}</th>
      <th>${t("rsSurface")}</th>
      <th>${t("rsLat")}</th>
      <th>${t("rsLon")}</th>
    </tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>`;
}

/* ---------- Density altitude ---------- */
function computeDensityAltitude(tempC, altimHpa, elevFt) {
  if (tempC === undefined || tempC === null || altimHpa === undefined || altimHpa === null || elevFt === undefined || elevFt === null) {
    return null;
  }
  const altimInHg = altimHpa * 0.0295299830714;
  const pressureAlt = elevFt + (29.92 - altimInHg) * 1000;
  const isaTemp = 15 - 2 * (pressureAlt / 1000);
  const densityAlt = pressureAlt + 120 * (tempC - isaTemp);
  return { pressureAlt, densityAlt };
}

function renderDensityAltitude(metar) {
  const card = document.getElementById("da-card");
  const result = computeDensityAltitude(metar.temp, metar.altim, metar.elev);
  if (!result) {
    card.style.display = "none";
    return;
  }
  card.style.display = "";

  const diff = result.densityAlt - metar.elev;
  document.getElementById("da-value").textContent = `${Math.round(result.densityAlt).toLocaleString()} ft`;
  document.getElementById("da-elev").textContent = `${Math.round(metar.elev).toLocaleString()} ft`;
  document.getElementById("da-pa").textContent = `${Math.round(result.pressureAlt).toLocaleString()} ft`;
  document.getElementById("da-diff").textContent = `${diff >= 0 ? "+" : ""}${Math.round(diff).toLocaleString()} ft`;

  const valueEl = document.getElementById("da-value");
  valueEl.classList.remove("da-warn", "da-severe");
  let note = t("daNoteNormal");
  if (diff > 3000) {
    valueEl.classList.add("da-severe");
    note = t("daNoteSevere");
  } else if (diff > 1500) {
    valueEl.classList.add("da-warn");
    note = t("daNoteModerate");
  }
  document.getElementById("da-note").textContent = note;
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

/* ---------- SIGMET ---------- */
function hazardLabel(hazard) {
  return t("hazard" + hazard) !== "hazard" + hazard ? t("hazard" + hazard) : hazard;
}

function renderSigmets(airport, sigmets) {
  const card = document.getElementById("sigmet-card");
  const body = document.getElementById("sigmet-body");

  if (!airport.fir) {
    card.className = "card";
    body.innerHTML = `<p class="hint" style="margin:0">${t("sigmetUnavailable")}</p>`;
    return;
  }

  if (!Array.isArray(sigmets)) {
    card.className = "card";
    body.innerHTML = `<p class="hint" style="margin:0">${t("sigmetFetchFailed")}</p>`;
    return;
  }

  const relevant = sigmets.filter((s) => s.firId === airport.fir);

  if (relevant.length === 0) {
    card.className = "card sigmet-clear";
    body.innerHTML = `<p class="hint" style="margin:0">✅ ${t("sigmetNone")}</p>`;
    return;
  }

  card.className = "card sigmet-active";
  const tz = airport.tzOffset ?? 0;
  const fmtT = (unixSec) => {
    if (!unixSec) return "--";
    const l = new Date(unixSec * 1000 + tz * 3600000);
    return `${pad2(l.getUTCDate())}/${pad2(l.getUTCMonth() + 1)} ${pad2(l.getUTCHours())}:${pad2(l.getUTCMinutes())}`;
  };

  body.innerHTML = relevant
    .map((s) => {
      const altTxt =
        s.top != null
          ? `${s.base != null ? s.base + " ft" : t("sigmetSurface")} – ${s.top} ft`
          : s.base != null
          ? `${s.base}+ ft`
          : "--";
      return `<div class="sigmet-item">
        <div class="sigmet-item-head">
          <span class="sigmet-hazard">${hazardLabel(s.hazard)}${s.qualifier ? " (" + s.qualifier + ")" : ""}</span>
          <span class="sigmet-time">${t("sigmetValid")}: ${fmtT(s.validTimeFrom)} → ${fmtT(s.validTimeTo)}</span>
        </div>
        <div class="hint" style="margin:4px 0">${t("sigmetAlt")}: ${altTxt}</div>
        <pre class="raw-box" style="margin:0">${s.rawSigmet || "--"}</pre>
      </div>`;
    })
    .join("");
}

/* ---------- Air quality ---------- */
function aqiCategory(aqi) {
  if (aqi === null || aqi === undefined) return null;
  if (aqi <= 50) return { cls: "aqi-good", label: t("aqiGood") };
  if (aqi <= 100) return { cls: "aqi-moderate", label: t("aqiModerate") };
  if (aqi <= 150) return { cls: "aqi-sensitive", label: t("aqiSensitive") };
  if (aqi <= 200) return { cls: "aqi-unhealthy", label: t("aqiUnhealthy") };
  if (aqi <= 300) return { cls: "aqi-very-unhealthy", label: t("aqiVeryUnhealthy") };
  return { cls: "aqi-hazardous", label: t("aqiHazardous") };
}

/* ---------- Quick stats ---------- */
function renderQuickStats(metar) {
  const cat = metar.fltCat || computeFlightCategory(parseVisib(metar.visib), parseCeilingFt(metar.clouds));
  const rh = relativeHumidity(metar.temp, metar.dewp);
  const ageMin = metar.obsTime ? Math.round((Date.now() / 1000 - metar.obsTime) / 60) : null;
  const aqi = state ? state.aqi : null;
  const aqiCat = aqiCategory(aqi);

  const stats = [
    { icon: "i-status", label: t("statCategory"), value: cat, cls: `cat-${cat}`, badge: true },
    { icon: "i-thermo", label: t("statTemp"), value: fmtTemp(metar.temp), unitKey: "temp", unitLabel: tempUnit === "C" ? "°F" : "°C" },
    { icon: "i-droplet", label: t("statDew"), value: fmtTemp(metar.dewp), unitKey: "temp", unitLabel: tempUnit === "C" ? "°F" : "°C" },
    { icon: "i-droplets", label: t("statHumidity"), value: rh !== null ? `${rh}%` : "--" },
    { icon: "i-wind", label: t("statWind"), value: fmtWind(metar.wdir, metar.wspd, metar.wgst) },
    { icon: "i-eye", label: t("statVisibility"), value: fmtVis(metar.visib), unitKey: "vis", unitLabel: visUnit === "SM" ? "km" : "SM" },
    { icon: "i-cloud-sun", label: t("dWeather"), value: metar.wxString || t("noWx") },
    { icon: "i-cloud", label: t("dClouds"), value: (metar.clouds || []).map((c) => `${c.cover}${c.base ? " " + c.base + "ft" : ""}`).join(" / ") || t("clearSky") },
    { icon: "i-cloud-rain", label: t("statRain"), value: state && state.rainProb !== null && state.rainProb !== undefined ? `${state.rainProb}%` : "--" },
    {
      icon: "i-leaf",
      label: aqiCat ? `${t("statAqi")} · ${aqiCat.label}` : t("statAqi"),
      value: aqi !== null && aqi !== undefined ? String(aqi) : "--",
      cls: aqiCat ? aqiCat.cls : "",
      badge: true,
    },
    { icon: "i-gauge", label: t("statQnh"), value: metar.altim !== undefined && metar.altim !== null ? `${fmtNum(metar.altim, 1)} hPa` : "--" },
    { icon: "i-clock", label: t("statAge"), value: ageMin !== null ? `${ageMin} ${t("minutesAgo")}` : "--" },
  ];

  const wrap = document.getElementById("quickstats");
  wrap.innerHTML = stats
    .map(
      (s) => `<div class="stat fade-in ${s.badge ? "badge " + s.cls : ""}">
        ${s.unitKey ? `<button class="stat-unit-btn" data-unit-key="${s.unitKey}" title="${t("switchUnit")}">${s.unitLabel}</button>` : ""}
        <span class="stat-icon"><svg class="icon"><use href="#${s.icon}"/></svg></span>
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
    [t("dTemp"), fmtTemp(metar.temp)],
    [t("dDew"), fmtTemp(metar.dewp)],
    [t("dWindDir"), metar.wdir !== undefined && metar.wdir !== null ? `${padDir(metar.wdir)}°` : t("variable")],
    [t("dWindSpeed"), metar.wspd !== undefined ? `${metar.wspd} kt` : "--"],
    [t("dGust"), metar.wgst ? `${metar.wgst} kt` : t("none")],
    [t("dVisibility"), fmtVis(metar.visib)],
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
    const visTxt = fmtVis(f.visib);
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
      <td>${fmtTemp(m.temp)}</td>
      <td>${fmtVis(m.visib)}</td>
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
  renderSigmets(airport, state.sigmets);
  renderDensityAltitude(metar);
  renderCompass(metar.wdir ?? null, metar.wspd ?? null, metar.wgst ?? null);
  renderRunwaySelector(airport);
  renderRunwayMark(airport, state.activeRunway, metar.wdir ?? null);
  renderRunwayTable(airport, metar.wdir ?? null, metar.wspd ?? null);
  renderRunwaySpecs(airport);
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

/* Real-time US AQI (Open-Meteo Air Quality, free, CORS-enabled — no proxy needed). */
async function fetchAirQuality(lat, lon) {
  try {
    const url = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=us_aqi&timezone=UTC`;
    const data = await fetchJsonOnce(url);
    return data.current && typeof data.current.us_aqi === "number" ? data.current.us_aqi : null;
  } catch (err) {
    console.error("Failed to fetch air quality", err);
    return null;
  }
}

function updateBahrainOnlyCards(icao) {
  const isBahrain = icao === "OBBI";
  ["bulletin-card", "notam-card", "heli-card", "comms-card", "navaids-card"].forEach((id) => {
    document.getElementById(id).classList.toggle("bahrain-only-hidden", !isBahrain);
  });
}

async function loadWeather(icaoRaw) {
  const icao = (icaoRaw || DEFAULT_ICAO).trim().toUpperCase();
  updateBahrainOnlyCards(icao);
  const airport = getAirport(icao);
  const banner = document.getElementById("status-banner");
  banner.className = "status-banner";
  banner.removeAttribute("data-i18n");
  banner.textContent = `${t("fetching")} ${icao}...`;

  try {
    const [metarArr, tafArr, rainProb, metarHistory, sigmets, aqi] = await Promise.all([
      fetchJson(`/proxy/metar?ids=${icao}`),
      fetchJson(`/proxy/taf?ids=${icao}`),
      airport.lat !== null ? fetchRainProbability(airport.lat, airport.lon) : Promise.resolve(null),
      fetchJson(`/proxy/metar?ids=${icao}&hours=24`).catch(() => null),
      airport.fir ? fetchJson(`/proxy/isigmet`).catch(() => null) : Promise.resolve(null),
      airport.lat !== null ? fetchAirQuality(airport.lat, airport.lon) : Promise.resolve(null),
    ]);

    if (!metarArr || metarArr.length === 0) {
      banner.className = "status-banner error";
      banner.textContent = `⚠️ ${t("noMetar")} ${icao}. ${t("checkIcao")}`;
      return;
    }

    const metar = metarArr[0];
    const taf = tafArr && tafArr.length ? tafArr[0] : null;

    state = { icao, airport, metar, taf, rainProb, metarHistory: metarHistory || [metar], sigmets, aqi, activeRunway: 0 };
    renderAll();

    banner.className = "status-banner ok";
    const now = new Date();
    document.getElementById("last-updated").textContent =
      `${t("lastUpdated")} ` + pad2(now.getUTCHours()) + ":" + pad2(now.getUTCMinutes()) + " UTC";
  } catch (err) {
    if (!state && MANUAL_FALLBACK[icao]) {
      const metar = MANUAL_FALLBACK[icao];
      state = { icao, airport, metar, taf: null, rainProb: null, metarHistory: [metar], sigmets: null, aqi: null, activeRunway: 0 };
      renderAll();
      banner.className = "status-banner warn";
      banner.textContent = `⚠️ ${t("fallbackNotice")}`;
    } else {
      banner.className = "status-banner error";
      banner.textContent = `❌ ${t("fetchError")} (${err.message}). ${t("checkConn")}`;
    }
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

/* ---------- Theme toggle (day/night) ---------- */
const SUN_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2.5M12 19.5V22M4.2 4.2l1.8 1.8M18 18l1.8 1.8M2 12h2.5M19.5 12H22M4.2 19.8L6 18M18 6l1.8-1.8"/></svg>';
const MOON_ICON =
  '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 14.5A8.5 8.5 0 0 1 9.5 3.5a.6.6 0 0 0-.8-.7A9.5 9.5 0 1 0 21.2 15.3a.6.6 0 0 0-.7-.8Z"/></svg>';

function effectiveTheme() {
  const saved = localStorage.getItem("obbi_theme");
  if (saved) return saved;
  return window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function applyTheme(theme) {
  document.documentElement.setAttribute("data-theme", theme);
  const btn = document.getElementById("theme-toggle");
  if (btn) btn.innerHTML = theme === "dark" ? SUN_ICON : MOON_ICON;
}

function setTheme(theme) {
  localStorage.setItem("obbi_theme", theme);
  applyTheme(theme);
}

document.getElementById("theme-toggle").addEventListener("click", () => {
  setTheme(effectiveTheme() === "dark" ? "light" : "dark");
});

applyTheme(effectiveTheme());

/* ---------- METAR read-aloud (English aviation phraseology, Web Speech API) ---------- */
function ordinal(n) {
  const suffixes = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (suffixes[(v - 20) % 10] || suffixes[v] || suffixes[0]);
}

const WX_INTENSITY_SPEECH = { "-": "light", "+": "heavy" };
const WX_DESC_SPEECH = {
  MI: "shallow", BC: "patches of", PR: "partial", DR: "low drifting",
  BL: "blowing", SH: "showers of", TS: "thunderstorm with", FZ: "freezing",
};
const WX_PHENOM_SPEECH = {
  DZ: "drizzle", RA: "rain", SN: "snow", SG: "snow grains", IC: "ice crystals", PL: "ice pellets",
  GR: "hail", GS: "small hail", UP: "unknown precipitation",
  BR: "mist", FG: "fog", FU: "smoke", VA: "volcanic ash", DU: "dust", SA: "sand", HZ: "haze",
  PY: "spray", PO: "dust whirls", SQ: "squalls", FC: "funnel cloud", SS: "sandstorm", DS: "duststorm",
};
const CLOUD_COVER_SPEECH = {
  FEW: "a few clouds", SCT: "scattered clouds", BKN: "broken clouds",
  OVC: "an overcast layer", VV: "vertical visibility obscured",
};

function decodeWxStringSpeech(wx) {
  const tokens = wx.trim().split(/\s+/).filter(Boolean);
  const phrases = tokens.map((tokRaw) => {
    let tok = tokRaw.startsWith("VC") ? tokRaw.slice(2) : tokRaw;
    let intensity = "";
    if (tok[0] === "-" || tok[0] === "+") {
      intensity = WX_INTENSITY_SPEECH[tok[0]];
      tok = tok.slice(1);
    }
    let desc = "";
    for (const code of Object.keys(WX_DESC_SPEECH)) {
      if (tok.startsWith(code)) {
        desc = WX_DESC_SPEECH[code];
        tok = tok.slice(2);
        break;
      }
    }
    const phenomWords = [];
    while (tok.length >= 2 && WX_PHENOM_SPEECH[tok.slice(0, 2)]) {
      phenomWords.push(WX_PHENOM_SPEECH[tok.slice(0, 2)]);
      tok = tok.slice(2);
    }
    const phenom = phenomWords.join(" and ");
    return [intensity, desc, phenom].filter(Boolean).join(" ") || tokRaw;
  });
  return phrases.join(", ");
}

function buildMetarSpeechText(metar, airport) {
  const name = (airport && airport.name) || metar.name || metar.icaoId || "the airport";
  const parts = [`${name} weather.`];

  if (metar.obsTime) {
    const d = new Date(metar.obsTime * 1000);
    parts.push(`Observed on the ${ordinal(d.getUTCDate())} at ${pad2(d.getUTCHours())} ${pad2(d.getUTCMinutes())} Zulu.`);
  }

  if (typeof metar.wdir === "number" && metar.wspd) {
    let w = `Wind from ${padDir(metar.wdir)} degrees at ${metar.wspd} knots`;
    if (metar.wgst) w += `, gusting ${metar.wgst} knots`;
    parts.push(w + ".");
  } else if (!metar.wspd) {
    parts.push("Wind calm.");
  } else {
    parts.push(`Wind variable at ${metar.wspd} knots.`);
  }

  const visNum = parseVisib(metar.visib);
  if (visNum !== null) {
    const hasPlus = typeof metar.visib === "string" && metar.visib.endsWith("+");
    parts.push(
      visNum >= 10 || hasPlus
        ? "Visibility one zero statute miles or more."
        : `Visibility ${visNum} statute mile${visNum === 1 ? "" : "s"}.`
    );
  }

  if (metar.wxString) {
    const wxTxt = decodeWxStringSpeech(metar.wxString);
    parts.push(wxTxt.charAt(0).toUpperCase() + wxTxt.slice(1) + ".");
  }

  if (metar.clouds && metar.clouds.length) {
    const txt = metar.clouds
      .map((c) => {
        const label = CLOUD_COVER_SPEECH[c.cover] || c.cover;
        return c.base ? `${label} at ${Number(c.base).toLocaleString("en-US")} feet` : label;
      })
      .join(", ");
    parts.push(txt.charAt(0).toUpperCase() + txt.slice(1) + ".");
  } else {
    parts.push("Sky clear.");
  }

  if (metar.temp !== undefined && metar.temp !== null) {
    parts.push(`Temperature ${Math.round(metar.temp)} degrees Celsius, dew point ${Math.round(metar.dewp)} degrees Celsius.`);
  }

  if (metar.altim !== undefined && metar.altim !== null) {
    parts.push(`Altimeter ${Math.round(metar.altim)} hectopascals.`);
  }

  if (/\bNOSIG\b/.test(metar.rawOb || "")) parts.push("No significant change expected.");

  return parts.join(" ");
}

function pickEnglishVoice() {
  if (!("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find((v) => v.lang === "en-US") || voices.find((v) => v.lang && v.lang.startsWith("en")) || null;
}

function updateMetarSpeakBtnLabel() {
  const btn = document.getElementById("metar-speak-btn");
  if (!btn) return;
  const speaking = btn.classList.contains("speaking");
  const label = speaking ? t("metarSpeakStop") : t("metarSpeakTitle");
  btn.title = label;
  btn.setAttribute("aria-label", label);
}

function setMetarSpeakBtnState(speaking) {
  const btn = document.getElementById("metar-speak-btn");
  if (!btn) return;
  btn.classList.toggle("speaking", speaking);
  btn.querySelector(".icon use").setAttribute("href", speaking ? "#i-stop" : "#i-speaker");
  updateMetarSpeakBtnLabel();
}

function toggleMetarSpeech() {
  if (!("speechSynthesis" in window)) {
    alert(t("metarSpeakUnsupported"));
    return;
  }
  if (window.speechSynthesis.speaking) {
    window.speechSynthesis.cancel();
    setMetarSpeakBtnState(false);
    return;
  }
  if (!state || !state.metar) return;
  const text = buildMetarSpeechText(state.metar, state.airport);
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  const voice = pickEnglishVoice();
  if (voice) utter.voice = voice;
  utter.rate = 0.95;
  utter.onend = () => setMetarSpeakBtnState(false);
  utter.onerror = () => setMetarSpeakBtnState(false);
  window.speechSynthesis.speak(utter);
  setMetarSpeakBtnState(true);
}

document.getElementById("metar-speak-btn").addEventListener("click", toggleMetarSpeech);
updateMetarSpeakBtnLabel();
document.addEventListener("langchange", updateMetarSpeakBtnLabel);

/* ---------- Unit toggles (in-card only — Dew Point/Temperature and Visibility squares) ---------- */
function toggleTempUnit() {
  tempUnit = tempUnit === "C" ? "F" : "C";
  localStorage.setItem("obbi_temp_unit", tempUnit);
  if (state) renderAll();
}

function toggleVisUnit() {
  visUnit = visUnit === "SM" ? "KM" : "SM";
  localStorage.setItem("obbi_vis_unit", visUnit);
  if (state) renderAll();
}

document.getElementById("quickstats").addEventListener("click", (e) => {
  const btn = e.target.closest(".stat-unit-btn");
  if (!btn) return;
  if (btn.dataset.unitKey === "temp") toggleTempUnit();
  else if (btn.dataset.unitKey === "vis") toggleVisUnit();
});

/* ---------- Crosswind limit input ---------- */
const xwindInput = document.getElementById("xwind-limit-input");
if (xwindInput) {
  const stored = getXwindLimit();
  if (stored !== null) xwindInput.value = stored;
  xwindInput.addEventListener("input", () => {
    const v = xwindInput.value.trim();
    if (v) localStorage.setItem("obbi_xwind_limit", v);
    else localStorage.removeItem("obbi_xwind_limit");
    if (state) renderRunwayTable(state.airport, state.metar.wdir ?? null, state.metar.wspd ?? null);
  });
}

/* ---------- Refresh on return to foreground ---------- */
/* Mobile browsers throttle/suspend setInterval timers while a tab is
   backgrounded (locked screen, app switch), so REFRESH_MS alone can leave
   stale weather on screen for a long time with no visual warning. Force a
   refetch the moment the tab becomes visible again. */
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && state) {
    loadWeather(state.icao);
  }
});
window.addEventListener("pageshow", () => {
  if (state) loadWeather(state.icao);
});

/* ---------- Init ---------- */
applyStaticTranslations();
renderComms();
loadWeather(DEFAULT_ICAO);
scheduleRefresh(DEFAULT_ICAO);
