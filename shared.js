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
