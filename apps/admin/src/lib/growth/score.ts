import type { PlaceResult } from './places';

/** Verticals where booking pain and Instagram presence are highest (tier 1–2 in the plan). */
const TIER_1_2 = new Set([
  'hair_salon', 'barber', 'nail_studio', 'lash_brow', 'beauty_clinic',
  'massage', 'spa', 'physio', 'dentist',
]);

/** Booking widgets we can detect from a website URL alone (competitor-hosted pages). */
const COMPETITOR_HOSTS = ['fresha.com', 'booksy.com', 'treatwell', 'simplybook', 'calendly.com', 'setmore', 'zakazi'];

const INSTAGRAM_RE = /instagram\.com\/([A-Za-z0-9_.]+)/i;

export function extractInstagram(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(INSTAGRAM_RE);
  return m?.[1] ? m[1].replace(/\/$/, '') : null;
}

/**
 * ICP score from Places data alone (enrichment adds more later).
 * Mirrors section 5.1 of docs/GTM_GROWTH_PLAN.md.
 */
export function scoreProspect(place: PlaceResult, vertical: string): number {
  let score = 0;

  if (TIER_1_2.has(vertical)) score += 1;

  if ((place.reviewCount ?? 0) >= 20 && (place.rating ?? 0) >= 4.3) score += 2;
  else if ((place.reviewCount ?? 0) >= 5) score += 1;

  if (place.phone) score += 1;

  const site = place.website?.toLowerCase() ?? '';
  if (site) {
    if (COMPETITOR_HOSTS.some((h) => site.includes(h))) score -= 3;
    else if (site.includes('instagram.com') || site.includes('facebook.com')) score += 2; // books by DM today
    else score += 1; // own site, likely no booking widget
  }

  if (place.businessStatus && place.businessStatus !== 'OPERATIONAL') score -= 5;

  return score;
}
