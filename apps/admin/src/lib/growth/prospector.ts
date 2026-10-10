import type { SupabaseClient } from '@supabase/supabase-js';
import type { GrowthSearchTarget } from '@balkina/shared';
import { searchPlaces, PlacesError } from './places';
import { scoreProspect, extractInstagram } from './score';

export interface ProspectorRunResult {
  targets_run: number;
  places_found: number;
  inserted: number;
  updated: number;
  api_requests: number;
  errors: { target: string; message: string }[];
  stopped_reason: string | null;
}

/**
 * Runs the next `limit` due search targets (least recently run first, by priority),
 * upserts the businesses found into growth_prospects, and records run stats.
 * Safe to call repeatedly: dedupes on google_place_id and never lowers an existing stage.
 */
export async function runProspector(
  supabase: SupabaseClient,
  opts: { limit?: number; targetIds?: string[]; maxPages?: number; segment?: 'tenant' | 'property' } = {}
): Promise<ProspectorRunResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 10, 100));
  const result: ProspectorRunResult = {
    targets_run: 0,
    places_found: 0,
    inserted: 0,
    updated: 0,
    api_requests: 0,
    errors: [],
    stopped_reason: null,
  };

  let query = supabase
    .from('growth_search_targets')
    .select('*')
    .eq('enabled', true)
    .order('last_run_at', { ascending: true, nullsFirst: true })
    .order('priority', { ascending: true })
    .limit(limit);

  if (opts.targetIds?.length) query = query.in('id', opts.targetIds);
  if (opts.segment) query = query.eq('segment', opts.segment);

  const { data: targets, error } = await query;
  if (error) throw new Error(`Failed to load search targets: ${error.message}`);

  for (const target of (targets ?? []) as GrowthSearchTarget[]) {
    const label = `${target.query} · ${target.city} (${target.country})`;
    try {
      const { places, requests } = await searchPlaces({
        textQuery: `${target.query} ${target.city}`,
        languageCode: target.language,
        regionCode: target.country,
        maxPages: opts.maxPages ?? 3,
      });
      result.api_requests += requests;
      result.targets_run++;
      result.places_found += places.length;

      const placeIds = places.map((p) => p.placeId);
      const { data: existing } = placeIds.length
        ? await supabase.from('growth_prospects').select('id, google_place_id, stage').in('google_place_id', placeIds)
        : { data: [] as { id: string; google_place_id: string; stage: string }[] };
      const existingById = new Map((existing ?? []).map((e) => [e.google_place_id as string, e]));

      const now = new Date().toISOString();
      const inserts: Record<string, unknown>[] = [];

      for (const place of places) {
        const row = {
          segment: target.segment,
          vertical: target.vertical,
          name: place.name,
          address: place.address,
          city: place.city ?? target.city,
          country: place.country ?? target.country,
          lat: place.lat,
          lng: place.lng,
          website: place.website,
          instagram: extractInstagram(place.website),
          phone: place.phone,
          google_place_id: place.placeId,
          google_maps_url: place.mapsUrl,
          google_rating: place.rating,
          google_review_count: place.reviewCount,
          google_types: place.types,
          business_status: place.businessStatus,
          source: 'google_places',
          search_target_id: target.id,
          icp_score: scoreProspect(place, target.vertical),
          updated_at: now,
        };

        const prev = existingById.get(place.placeId);
        if (prev) {
          // Refresh public facts only; never touch stage, notes, enrichment or tenant link.
          const { error: upErr } = await supabase
            .from('growth_prospects')
            .update({
              address: row.address,
              website: row.website,
              instagram: row.instagram,
              phone: row.phone,
              google_rating: row.google_rating,
              google_review_count: row.google_review_count,
              business_status: row.business_status,
              updated_at: now,
            })
            .eq('id', prev.id);
          if (!upErr) result.updated++;
        } else {
          inserts.push(row);
        }
      }

      if (inserts.length) {
        const { error: insErr, data: inserted } = await supabase
          .from('growth_prospects')
          .upsert(inserts, { onConflict: 'google_place_id', ignoreDuplicates: true })
          .select('id');
        if (insErr) result.errors.push({ target: label, message: insErr.message });
        else result.inserted += inserted?.length ?? 0;
      }

      await supabase
        .from('growth_search_targets')
        .update({
          last_run_at: now,
          last_results: places.length,
          total_found: (target.total_found ?? 0) + inserts.length,
        })
        .eq('id', target.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      result.errors.push({ target: label, message });
      // A key/billing problem will fail every target identically — stop early.
      if (err instanceof PlacesError && (err.status === 403 || err.status === 429 || err.status === 500)) {
        result.stopped_reason = message;
        break;
      }
    }
  }

  return result;
}
