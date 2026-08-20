/*
 * Shared helpers for the Bahrain PDF-derived cards (bulletin.js, notam.js,
 * heli.js) — each fetches its own government PDF independently and parses
 * it differently, but all three need the same fetch-timeout guard and the
 * same freshness-badge age bucketing.
 */

// Some mobile browsers can stall a fetch/parse indefinitely on a slow or
// blocked connection instead of rejecting. Bound every attempt so a hang
// always turns into a visible failure instead of the card sitting blank
// forever with no error and no retry.
export function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("timed out")), ms)),
  ]);
}

// Buckets an age (in hours) into a CSS class suffix for a freshness badge,
// given the caller's own "stale" / "very stale" thresholds.
export function stalenessClass(ageHours, staleAfterH, veryStaleAfterH) {
  if (ageHours > veryStaleAfterH) return " very-stale";
  if (ageHours > staleAfterH) return " stale";
  return "";
}

/*
 * Best-effort Arabic translation for the free-text meteorological English
 * pulled out of Bahrain Met's PDFs (bulletin.js today; heli.js's synopsis/
 * warnings/outlook/remarks are the same style of text and could reuse this
 * later). These bulletins draw from a small, fairly fixed vocabulary of
 * stock phrases and compass directions, not free-form prose, so a
 * dictionary covers real-world sentences well — but it's not a general
 * translator: any word outside this list is left in English rather than
 * guessed at, so a novel phrase degrades to partially-English instead of
 * a wrong translation.
 */
const AR_COMPASS = {
  N: "شمالية", NNE: "شمالية شمالية شرقية", NE: "شمالية شرقية", ENE: "شرقية شمالية شرقية",
  E: "شرقية", ESE: "شرقية جنوبية شرقية", SE: "جنوبية شرقية", SSE: "جنوبية جنوبية شرقية",
  S: "جنوبية", SSW: "جنوبية جنوبية غربية", SW: "جنوبية غربية", WSW: "غربية جنوبية غربية",
  W: "غربية", WNW: "غربية شمالية غربية", NW: "شمالية غربية", NNW: "شمالية شمالية غربية",
};

const AR_PHRASES = [
  [/\bat times during the day\b/gi, "أحياناً خلال النهار"],
  [/\bat times during the night\b/gi, "أحياناً خلال الليل"],
  [/\bduring the day\b/gi, "خلال النهار"],
  [/\bduring the night\b/gi, "خلال الليل"],
  [/\bat times\b/gi, "أحياناً"],
  [/\bin places\b/gi, "في أماكن متفرقة"],
  [/\brising sand\b/gi, "رمال متصاعدة"],
  [/\brising dust\b/gi, "غبار متصاعد"],
  [/\bstrong winds?\b/gi, "رياح قوية"],
  [/\blight winds?\b/gi, "رياح خفيفة"],
  [/\bmoderate winds?\b/gi, "رياح معتدلة"],
  [/\bfresh winds?\b/gi, "رياح منعشة"],
  [/\bbut mainly\b/gi, "لكن غالباً"],
  [/\bthundery activity\b/gi, "نشاط رعدي"],
  [/\bpartly cloudy\b/gi, "غائم جزئياً"],
  [/\bmostly cloudy\b/gi, "غائم غالباً"],
];

const AR_WORDS = {
  hot: "حار", warm: "دافئ", cool: "معتدل البرودة", cold: "بارد",
  humid: "رطب", dry: "جاف",
  clear: "صافٍ", fine: "صافٍ", fair: "معتدل",
  cloudy: "غائم", overcast: "ملبد بالغيوم",
  dusty: "مغبر", sandy: "رملي", sand: "رمل", dust: "غبار", rising: "متصاعد",
  hazy: "ضبابي خفيف", misty: "ضبابي خفيف", foggy: "ضبابي",
  rain: "مطر", rainy: "ممطر", showers: "زخات مطر", drizzle: "رذاذ",
  thunderstorm: "عاصفة رعدية", thunderstorms: "عواصف رعدية", thundery: "رعدي",
  windy: "عاصف", calm: "هادئ", gusty: "بهبات رياح", variable: "متغيرة",
  wind: "رياح", winds: "رياح",
  reaching: "تصل", inshore: "قرب الشاطئ", offshore: "قبالة الشاطئ",
  today: "اليوم", tonight: "الليلة", overnight: "طوال الليل", tomorrow: "غداً", morning: "الصباح", afternoon: "الظهيرة", evening: "المساء", night: "الليل",
  partly: "جزئياً", mostly: "غالباً", occasionally: "أحياناً", occasional: "متقطع",
  isolated: "متفرق", scattered: "متفرق", widespread: "منتشر واسع", places: "أماكن متفرقة",
  likely: "محتمل", possible: "ممكن", becoming: "يتحول إلى",
  mainly: "غالباً", generally: "بشكل عام", for: "بخصوص",
  nil: "لا يوجد", none: "لا يوجد",
  but: "لكن", with: "مع", or: "أو", to: "إلى",
};

export function translateWeatherText(text) {
  if (!text) return text;
  let out = text;

  out = out.replace(/\b(NNE|ENE|ESE|SSE|SSW|WSW|WNW|NNW|NE|SE|SW|NW|N|E|S|W)'ly\b/g, (m, d) => AR_COMPASS[d] || m);
  out = out.replace(/(\d+)\s*kt\b/gi, "$1 عقدة");
  out = out.replace(/(\d+)\s*ft\b/gi, "$1 قدم");
  out = out.replace(/,/g, "،");

  for (const [re, ar] of AR_PHRASES) out = out.replace(re, ar);

  const words = Object.keys(AR_WORDS).sort((a, b) => b.length - a.length);
  const wordRe = new RegExp(`\\b(${words.join("|")})\\b`, "gi");
  out = out.replace(wordRe, (m) => AR_WORDS[m.toLowerCase()] || m);

  // "and" attaches directly to the following word in Arabic ("ورطب", not
  // "و رطب") rather than standing alone with a space like the other
  // connectors, so it needs its own no-trailing-space substitution.
  out = out.replace(/\band\s+/gi, "و");

  return out;
}
