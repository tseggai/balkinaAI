import { randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { GrowthEnrichment, GrowthProspect } from '@balkina/shared';
import { getGrowthCountry, getGrowthVertical, toSlug } from '@balkina/shared';

/**
 * Pre-provisioner: builds a hidden, unclaimed Balkina booking page for a
 * prospect so outreach can say "your page is ready — claim it".
 *
 * Creates: tenant (status 'unclaimed', no user), category link, default
 * location (with coordinates from Places), an owner staff record (no user,
 * hours from enrichment when parseable), and services (from enrichment when
 * the LLM extracted them, else the vertical's defaults with hidden prices).
 * Issues a one-time claim token (30 days). Idempotent per prospect.
 *
 * Unclaimed tenants are excluded everywhere discovery filters status = 'active'.
 */

const CLAIM_DAYS = 30;
const MAX_SERVICES = 12;

const DEFAULT_SCHEDULE: Record<string, { start: string; end: string }> = {
  monday: { start: '09:00', end: '17:00' },
  tuesday: { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday: { start: '09:00', end: '17:00' },
  friday: { start: '09:00', end: '17:00' },
  saturday: { start: '09:00', end: '17:00' },
};

const DAY_ALIASES: Record<string, string> = {
  mon: 'monday', monday: 'monday', tue: 'tuesday', tues: 'tuesday', tuesday: 'tuesday', wed: 'wednesday', wednesday: 'wednesday',
  thu: 'thursday', thur: 'thursday', thursday: 'thursday', fri: 'friday', friday: 'friday', sat: 'saturday', saturday: 'saturday',
  sun: 'sunday', sunday: 'sunday',
};

export interface PreprovisionResult {
  prospect_id: string;
  tenant_id: string;
  claim_token: string;
  claim_url: string;
  services: number;
  created: boolean;
}

export interface PreprovisionRunResult {
  processed: number;
  created: number;
  existing: number;
  errors: { prospect: string; message: string }[];
  results: PreprovisionResult[];
}

export function claimUrlFor(token: string): string {
  const base = (process.env.GROWTH_CLAIM_BASE_URL ?? 'https://balkina.ai').replace(/\/$/, '');
  return `${base}/claim/${token}`;
}

/** Parse enrichment hours like { monday: "09:00-17:00" } into the staff schedule shape. */
function scheduleFromHours(hours: Record<string, string> | null | undefined): Record<string, { start: string; end: string }> | null {
  if (!hours) return null;
  const out: Record<string, { start: string; end: string }> = {};
  for (const [rawDay, rawRange] of Object.entries(hours)) {
    const day = DAY_ALIASES[rawDay.trim().toLowerCase()];
    if (!day || typeof rawRange !== 'string') continue;
    const m = rawRange.replace(/\s/g, '').match(/^(\d{1,2})(?::(\d{2}))?[-–](\d{1,2})(?::(\d{2}))?$/);
    if (!m) continue;
    const sh = Number(m[1]), sm = Number(m[2] ?? '0'), eh = Number(m[3]), em = Number(m[4] ?? '0');
    if (sh > 23 || eh > 24 || sm > 59 || em > 59 || sh * 60 + sm >= eh * 60 + em) continue;
    out[day] = { start: `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`, end: `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}` };
  }
  return Object.keys(out).length >= 3 ? out : null;
}

async function uniqueSlug(supabase: SupabaseClient, base: string): Promise<string> {
  let slug = base;
  for (let i = 0; i < 5; i++) {
    const { data } = await supabase.from('tenants').select('id').eq('slug', slug).limit(1);
    if (!data?.length) return slug;
    slug = `${base}-${randomBytes(2).toString('hex')}`;
  }
  return `${base}-${randomBytes(4).toString('hex')}`;
}

export async function preprovisionProspect(
  supabase: SupabaseClient,
  prospect: GrowthProspect
): Promise<PreprovisionResult> {
  // Idempotent: a prospect that already has a tenant keeps it (refresh the token if missing/expired).
  if (prospect.tenant_id) {
    let token = prospect.claim_token;
    const expired = prospect.claim_expires_at ? new Date(prospect.claim_expires_at) < new Date() : true;
    if (!token || (expired && !prospect.claimed_at)) {
      token = randomBytes(24).toString('hex');
      await supabase
        .from('growth_prospects')
        .update({ claim_token: token, claim_expires_at: new Date(Date.now() + CLAIM_DAYS * 86400_000).toISOString(), updated_at: new Date().toISOString() })
        .eq('id', prospect.id);
    }
    const { count } = await supabase.from('services').select('id', { count: 'exact', head: true }).eq('tenant_id', prospect.tenant_id);
    return { prospect_id: prospect.id, tenant_id: prospect.tenant_id, claim_token: token, claim_url: claimUrlFor(token), services: count ?? 0, created: false };
  }

  const country = getGrowthCountry(prospect.country);
  const vertical = getGrowthVertical(prospect.vertical);
  const lang = country?.language ?? 'sr';
  const enrichment =
    prospect.enriched_at && prospect.enrichment && typeof prospect.enrichment === 'object' && !Array.isArray(prospect.enrichment)
      ? (prospect.enrichment as unknown as GrowthEnrichment)
      : null;

  const ownerName = enrichment?.owner_name?.trim() || prospect.name;
  const email = prospect.email ?? enrichment?.emails?.[0] ?? '';
  const phone = prospect.phone ?? enrichment?.phones?.[0] ?? null;

  // Category by slug from the vertical catalogue.
  let categoryId: string | null = null;
  if (vertical) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', vertical.category_slug).limit(1).maybeSingle();
    categoryId = (cat as { id: string } | null)?.id ?? null;
  }

  const slugBase = toSlug(prospect.name) || toSlug(`${vertical?.key ?? 'business'} ${prospect.city ?? ''}`) || 'business';
  const slug = await uniqueSlug(supabase, slugBase.slice(0, 60));

  const { data: tenantRow, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      name: prospect.name,
      owner_name: ownerName,
      email,
      phone,
      category_id: categoryId,
      business_type: vertical?.business_type ?? 'service',
      currency: country?.currency ?? 'EUR',
      status: 'unclaimed',
      slug,
      description: enrichment?.summary ?? null,
      user_id: null,
    })
    .select('id')
    .single();
  if (tenantErr || !tenantRow) throw new Error(`tenant insert failed: ${tenantErr?.message ?? 'unknown'}`);
  const tenantId = (tenantRow as { id: string }).id;

  if (categoryId) {
    await supabase.from('tenant_category_links').insert({ tenant_id: tenantId, category_id: categoryId });
  }

  // Default location with coordinates from Places.
  const { data: locRow } = await supabase
    .from('tenant_locations')
    .insert({
      tenant_id: tenantId,
      name: prospect.city ?? 'Main Location',
      address: prospect.address ?? [prospect.city, country?.name].filter(Boolean).join(', ') ?? 'Address pending',
      city: prospect.city,
      country: country?.name ?? prospect.country,
      lat: prospect.lat,
      lng: prospect.lng,
      timezone: country?.timezone ?? 'Europe/Belgrade',
      currency: country?.currency ?? 'EUR',
    })
    .select('id')
    .single();
  const locationId = (locRow as { id: string } | null)?.id ?? null;

  // Owner staff record (no user yet — linked on claim).
  const { data: staffRow } = await supabase
    .from('staff')
    .insert({
      tenant_id: tenantId,
      name: ownerName,
      email,
      phone,
      user_id: null,
      status: 'active',
      availability_schedule: scheduleFromHours(enrichment?.hours) ?? DEFAULT_SCHEDULE,
    })
    .select('id')
    .single();
  const staffId = (staffRow as { id: string } | null)?.id ?? null;
  if (staffId && locationId) {
    await supabase.from('staff_locations').insert({ staff_id: staffId, location_id: locationId });
  }

  // Services: extracted ones first, else vertical defaults with hidden prices.
  const extracted = (enrichment?.services ?? [])
    .filter((s) => s && typeof s.name === 'string' && s.name.trim().length >= 2)
    .slice(0, MAX_SERVICES);
  const defaultDuration = vertical?.default_services[0]?.duration_minutes ?? 45;
  const serviceInputs =
    extracted.length > 0
      ? extracted.map((s) => ({
          name: s.name.trim().slice(0, 120),
          duration_minutes: s.duration_minutes && s.duration_minutes > 0 ? Math.min(s.duration_minutes, 1440) : defaultDuration,
          price: typeof s.price === 'number' && s.price >= 0 ? s.price : null,
        }))
      : (vertical?.default_services ?? [{ name: { sr: 'Usluga', hr: 'Usluga', en: 'Service' }, duration_minutes: 45 }]).map((s) => ({
          name: s.name[lang],
          duration_minutes: s.duration_minutes,
          price: null as number | null,
        }));

  const serviceType = vertical?.business_type === 'hospitality' ? 'table' : 'standard';
  let servicesCreated = 0;
  for (const s of serviceInputs) {
    const { data: svc } = await supabase
      .from('services')
      .insert({
        tenant_id: tenantId,
        name: s.name,
        duration_minutes: s.duration_minutes,
        price: s.price ?? 0,
        hide_price: s.price == null,
        visibility: 'public',
        service_type: serviceType,
      })
      .select('id')
      .single();
    const svcId = (svc as { id: string } | null)?.id;
    if (!svcId) continue;
    servicesCreated++;
    if (locationId) await supabase.from('service_locations').insert({ service_id: svcId, location_id: locationId });
    if (staffId) await supabase.from('service_staff').insert({ service_id: svcId, staff_id: staffId });
  }

  const token = randomBytes(24).toString('hex');
  const now = new Date().toISOString();
  const { error: upErr } = await supabase
    .from('growth_prospects')
    .update({
      tenant_id: tenantId,
      claim_token: token,
      preprovisioned_at: now,
      claim_expires_at: new Date(Date.now() + CLAIM_DAYS * 86400_000).toISOString(),
      stage: ['new', 'enriched', 'qualified'].includes(prospect.stage) ? 'preprovisioned' : prospect.stage,
      updated_at: now,
    })
    .eq('id', prospect.id);
  if (upErr) throw new Error(`prospect update failed: ${upErr.message}`);

  await supabase.from('growth_events').insert({ prospect_id: prospect.id, type: 'page_built', payload: { tenant_id: tenantId, services: servicesCreated } });

  return { prospect_id: prospect.id, tenant_id: tenantId, claim_token: token, claim_url: claimUrlFor(token), services: servicesCreated, created: true };
}

export async function runPreprovisioner(
  supabase: SupabaseClient,
  opts: { prospectIds?: string[]; limit?: number; minScore?: number; segment?: 'tenant' | 'property' } = {}
): Promise<PreprovisionRunResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const result: PreprovisionRunResult = { processed: 0, created: 0, existing: 0, errors: [], results: [] };

  let query = supabase.from('growth_prospects').select('*');
  if (opts.prospectIds?.length) {
    query = query.in('id', opts.prospectIds);
  } else {
    query = query
      .is('tenant_id', null)
      .in('stage', ['enriched', 'qualified'])
      .order('icp_score', { ascending: false })
      .limit(limit);
    if (typeof opts.minScore === 'number') query = query.gte('icp_score', opts.minScore);
    if (opts.segment) query = query.eq('segment', opts.segment);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load prospects: ${error.message}`);

  for (const p of (data ?? []) as GrowthProspect[]) {
    try {
      const r = await preprovisionProspect(supabase, p);
      result.processed++;
      if (r.created) result.created++; else result.existing++;
      result.results.push(r);
    } catch (err) {
      result.errors.push({ prospect: p.name, message: err instanceof Error ? err.message : String(err) });
    }
  }
  return result;
}
