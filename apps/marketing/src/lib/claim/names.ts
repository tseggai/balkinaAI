// Display helpers for scraped business names. Google Places names are often
// stuffed with keywords ("Friends Barber Shop man salon By Volkan Korkmaz
// barber shop Turkish frizer salon"); the page shows a short, clean version
// and keeps the full name as secondary text. Owners can rename after claiming.

const DESCRIPTOR_WORDS = new Set([
  'barber', 'barbershop', 'shop', 'salon', 'saloon', 'studio', 'frizer', 'frizerski', 'frizerska',
  'turkish', 'man', 'men', 'mens', "men's", 'women', 'womens', 'beauty', 'hair', 'nails', 'nail', 'spa',
  'centar', 'center', 'centre', 'kozmetički', 'kozmeticki', 'the', 'and', '&', 'by', 'd.o.o.', 'doo',
]);

/** First part before " by <owner>", capped to a few words. */
export function cleanBusinessName(name: string): string {
  const base = name.split(/\s+by\s+/i)[0]?.trim() || name.trim();
  const words = base.split(/\s+/);
  const kept: string[] = [];
  for (const w of words) {
    // Stop once we hit a run of pure descriptors after a real name (e.g. "man salon")
    if (kept.length >= 3 && DESCRIPTOR_WORDS.has(w.toLowerCase())) break;
    kept.push(w);
    if (kept.length >= 6) break;
  }
  return kept.join(' ') || base;
}

/** "… By Volkan Korkmaz barber shop …" → "Volkan Korkmaz". Null when nothing plausible. */
export function guessOwnerName(businessName: string, ownerName?: string | null): string | null {
  if (ownerName && ownerName.trim() && ownerName.trim() !== businessName.trim()) return ownerName.trim();
  const m = businessName.match(/\bby\s+(.+)$/i);
  if (!m?.[1]) return null;
  const words: string[] = [];
  for (const w of m[1].split(/\s+/)) {
    if (DESCRIPTOR_WORDS.has(w.toLowerCase())) break;
    if (!/^\p{Lu}/u.test(w)) break;
    words.push(w);
    if (words.length === 3) break;
  }
  return words.length ? words.join(' ') : null;
}

/** First name for greetings ("Volkane" would need vocative — we keep nominative to stay safe). */
export function firstName(full: string | null): string | null {
  const f = full?.trim().split(/\s+/)[0];
  return f && f.length > 1 ? f : null;
}
