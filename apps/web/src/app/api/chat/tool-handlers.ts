/**
 * Tool execution handlers for the AI chatbot.
 * Each handler runs a Supabase query and returns a result object
 * that gets sent back to the AI as a tool_result.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

type AdminClient = SupabaseClient;

interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ── Timezone helpers ────────────────────────────────────────────────────────

/**
 * Get the UTC offset in minutes for a given IANA timezone at a reference date.
 * Positive = east of UTC (e.g. Europe/Berlin in summer = +120).
 */
function getTimezoneOffsetMinutes(timezone: string, refDate: Date): number {
  const utcStr = refDate.toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = refDate.toLocaleString('en-US', { timeZone: timezone });
  return (new Date(tzStr).getTime() - new Date(utcStr).getTime()) / 60000;
}

/**
 * Convert a local date + time in a given timezone to a UTC Date.
 * dateStr: "2024-06-15", timeStr: "09:00", timezone: "America/New_York"
 */
function localTimeToUTC(dateStr: string, timeStr: string, timezone: string): Date {
  // Treat the local time as if it were UTC to get a reference point
  const asUtc = new Date(`${dateStr}T${timeStr}:00.000Z`);
  // Compute the timezone offset at that reference point
  const offsetMs = getTimezoneOffsetMinutes(timezone, asUtc) * 60000;
  // UTC = local_time - offset
  return new Date(asUtc.getTime() - offsetMs);
}

/**
 * Fetch the tenant's timezone from their first location, default to UTC.
 */
async function getTenantTimezone(supabase: AdminClient, tenantId: string): Promise<string> {
  const { data } = await supabase
    .from('tenant_locations')
    .select('timezone')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();
  return (data as { timezone: string } | null)?.timezone || 'UTC';
}

// ── Synonym map for search term expansion ────────────────────────────────────
// Maps common search terms to additional terms to search for.
const SEARCH_SYNONYMS: Record<string, string[]> = {
  dentist: ['dental', 'dentistry', 'teeth', 'tooth'],
  dental: ['dentist', 'dentistry', 'teeth', 'tooth'],
  barber: ['haircut', 'hair cut', 'fade', 'barbershop'],
  haircut: ['barber', 'hair cut', 'hair'],
  therapist: ['therapy', 'counseling', 'counselor'],
  therapy: ['therapist', 'counseling', 'counselor'],
  chiropractor: ['chiropractic', 'chiro'],
  chiropractic: ['chiropractor', 'chiro'],
  nail: ['manicure', 'pedicure', 'nails'],
  manicure: ['nail', 'nails', 'pedicure'],
  pedicure: ['nail', 'nails', 'manicure'],
  spa: ['massage', 'facial', 'wellness'],
  doctor: ['medical', 'physician', 'clinic'],
  vet: ['veterinary', 'veterinarian', 'pet', 'animal'],
  veterinary: ['vet', 'veterinarian', 'pet', 'animal'],
};

// ── Incompatible keyword map for semantic service-type filtering ─────────────

const INCOMPATIBLE_KEYWORDS: Record<string, string[]> = {
  haircut: ['pet', 'dog', 'cat', 'pet groom', 'paw', 'nail', 'manicure', 'pedicure', 'massage', 'spa', 'yoga', 'dental', 'therapy', 'chiro', 'coach', 'music', 'auto'],
  massage: ['haircut', 'fade', 'beard', 'pet', 'dog', 'nail', 'manicure', 'dental', 'chiro', 'auto', 'music', 'yoga'],
  manicure: ['haircut', 'fade', 'beard', 'pet', 'dog', 'massage', 'dental', 'chiro', 'auto', 'music', 'yoga', 'therapy'],
  facial: ['haircut', 'fade', 'beard', 'pet', 'dog', 'nail', 'massage', 'dental', 'chiro', 'auto', 'music', 'yoga'],
  yoga: ['haircut', 'fade', 'pet', 'dog', 'nail', 'massage', 'dental', 'chiro', 'auto', 'music'],
  dental: ['haircut', 'fade', 'pet', 'dog', 'nail', 'massage', 'yoga', 'chiro', 'auto', 'music', 'therapy'],
  dentist: ['haircut', 'fade', 'pet', 'dog', 'nail', 'massage', 'yoga', 'chiro', 'auto', 'music', 'therapy'],
};

// ── find_businesses ──────────────────────────────────────────────────────────

/**
 * Haversine distance in km between two lat/lng points.
 */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Estimate driving time in minutes from distance in km.
 * Uses ~30 km/h average for short urban distances, ~50 km/h for longer distances.
 */
function estimateDriveMinutes(distanceKm: number): number {
  const avgSpeedKmh = distanceKm < 5 ? 30 : 50;
  return Math.max(1, Math.round((distanceKm / avgSpeedKmh) * 60));
}

export async function handleFindBusinesses(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  console.log('[find_businesses] called with params:', JSON.stringify(input));

  try {
    return await handleFindBusinessesInner(supabase, input);
  } catch (err) {
    console.error('[find_businesses] CRASHED:', err);
    return { success: false, error: `find_businesses failed: ${err instanceof Error ? err.message : String(err)}` };
  }
}

async function handleFindBusinessesInner(
  supabase: AdminClient,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const query = ((input.query as string) || '').trim();
  const userLat = input.latitude as number | undefined;
  const userLng = input.longitude as number | undefined;
  const radiusKm = (input.radius_km as number) || 200; // was 50 — widened for debugging
  const offset = (input.offset as number) || 0;
  const limit = (input.limit as number) || 8;

  const serviceType = ((input.service_type as string) || '').trim();

  console.log('[find_businesses] START params:', JSON.stringify({ query, serviceType, userLat, userLng, radiusKm, offset, limit }));

  // If a service_type is specified, filter tenants that actually offer matching services
  if (serviceType) {
    const sanitizeForLike = (s: string) => s.replace(/%/g, '\\%').replace(/_/g, '\\_');
    const sanitizedType = sanitizeForLike(serviceType);

    // Step 1: Find services matching the service type with flexible patterns
    // Build patterns: exact match, compound splits (e.g., "haircut" → "hair%cut"), word splits
    // Also expand with synonyms (e.g., "dentist" → also search "dental", "dentistry", "teeth")
    const svcPatterns: string[] = [
      `name.ilike.%${sanitizedType}%`,
      `service_category.ilike.%${sanitizedType}%`,
      `description.ilike.%${sanitizedType}%`,
    ];

    // Add synonym patterns
    const synonyms = SEARCH_SYNONYMS[serviceType.toLowerCase()] ?? [];
    for (const syn of synonyms) {
      const sanitizedSyn = sanitizeForLike(syn);
      svcPatterns.push(`name.ilike.%${sanitizedSyn}%`);
      svcPatterns.push(`service_category.ilike.%${sanitizedSyn}%`);
      svcPatterns.push(`description.ilike.%${sanitizedSyn}%`);
    }

    // Compound word splitting: "haircut" → %hair%cut% (catches "Hair Cut", "HairCut", etc.)
    const typeNoSpaces = serviceType.replace(/\s+/g, '');
    if (!serviceType.includes(' ') && serviceType.length > 4) {
      for (let i = 3; i <= serviceType.length - 2; i++) {
        const left = sanitizeForLike(serviceType.slice(0, i));
        const right = sanitizeForLike(serviceType.slice(i));
        svcPatterns.push(`name.ilike.%${left}%${right}%`);
      }
    }

    // Multi-word service types: "hair cut" → %hair%, %cut%
    const typeWords = serviceType.split(/\s+/).filter((w: string) => w.length >= 2);
    if (typeWords.length > 1) {
      for (const w of typeWords) {
        svcPatterns.push(`name.ilike.%${sanitizeForLike(w)}%`);
      }
      // Also try joined version: "hair cut" → %haircut%
      const joined = sanitizeForLike(typeNoSpaces);
      svcPatterns.push(`name.ilike.%${joined}%`);
    }

    const uniqueSvcPatterns = [...new Set(svcPatterns)];
    console.log('[find_businesses] service_type patterns:', uniqueSvcPatterns.length);

    const { data: matchingServices, error: svcError } = await supabase
      .from('services')
      .select('tenant_id, name, price, duration_minutes')
      .or(uniqueSvcPatterns.join(','))
      .limit(200);

    console.log('[find_businesses] matching services for type:', serviceType, 'count:', matchingServices?.length, 'error:', svcError?.message);

    // Also find tenants whose assigned category matches the search term
    // This catches businesses like "Dan the Barber" in "Beauty & Personal Care"
    // even when their service names don't contain the category keywords
    const { data: categoryTenants } = await supabase
      .from('tenants')
      .select('id, name, logo_url, category_id, categories(name)')
      .eq('status', 'active')
      .not('category_id', 'is', null);

    // Filter tenants whose category name matches the service type (case-insensitive)
    const catMatchTenantIds = new Set<string>();
    const typeLC = serviceType.toLowerCase();
    const typeWords2 = typeLC.split(/\s+/).filter((w: string) => w.length >= 2);
    for (const t of (categoryTenants ?? []) as unknown as { id: string; name: string; categories: { name: string } | { name: string }[] | null }[]) {
      const catName = Array.isArray(t.categories) ? t.categories[0]?.name ?? '' : t.categories?.name ?? '';
      const catLC = catName.toLowerCase();
      // Match if category contains the search term, or search term contains the category,
      // or if any significant word from the search term appears in the category name
      if (catLC.includes(typeLC) || typeLC.includes(catLC) || typeWords2.some(w => catLC.includes(w))) {
        catMatchTenantIds.add(t.id);
      }
    }
    console.log('[find_businesses] category-matched tenant IDs:', catMatchTenantIds.size);

    let serviceTenantMap: Map<string, { id: string; name: string; image_url?: string; category?: string | null; business_category?: string | null; matched_services: string[] }>;

    // Collect matching tenant IDs from service name search
    const svcByTenant = new Map<string, string[]>();
    if (matchingServices && matchingServices.length > 0) {
      for (const svc of matchingServices as { tenant_id: string; name: string }[]) {
        const existing = svcByTenant.get(svc.tenant_id) ?? [];
        existing.push(svc.name);
        svcByTenant.set(svc.tenant_id, existing);
      }
    }

    // Merge category-matched tenants into the service match map
    for (const catTenantId of catMatchTenantIds) {
      if (!svcByTenant.has(catTenantId)) {
        svcByTenant.set(catTenantId, ['(category match)']);
      }
    }

    if (svcByTenant.size === 0) {
      // Fall back to all tenants — don't return empty
      console.log('[find_businesses] no service or category match, falling back to all active tenants');
      serviceTenantMap = new Map();
    } else {

      // Filter out tenants whose services are semantically incompatible
      const incompatible = INCOMPATIBLE_KEYWORDS[serviceType.toLowerCase()] ?? [];
      if (incompatible.length > 0) {
        // Also fetch ALL services for matching tenants to check for incompatibility
        const candidateIds = [...svcByTenant.keys()];
        const { data: allTenantServices } = candidateIds.length > 0
          ? await supabase.from('services').select('tenant_id, name').in('tenant_id', candidateIds)
          : { data: [] };

        const allSvcList = (allTenantServices ?? []) as { tenant_id: string; name: string }[];
        const filteredIds = candidateIds.filter(tid => {
          const tenantSvcs = allSvcList.filter(s => s.tenant_id === tid);
          // Tenant must have at least one service that is NOT incompatible
          return tenantSvcs.some(s =>
            !incompatible.some(kw => s.name.toLowerCase().includes(kw))
          );
        });

        // Remove filtered-out tenants from the map
        for (const tid of candidateIds) {
          if (!filteredIds.includes(tid)) {
            svcByTenant.delete(tid);
          }
        }
        console.log('[find_businesses] after incompatible filter:', svcByTenant.size, 'tenants (removed', candidateIds.length - filteredIds.length, ')');
      }

      const matchingTenantIds = [...svcByTenant.keys()];
      console.log('[find_businesses] matching tenant IDs:', matchingTenantIds.length);

      // Step 2: Fetch those tenants with their details
      const { data: tenants, error: tenantError } = await supabase
        .from('tenants')
        .select('id, name, logo_url, categories(name)')
        .in('id', matchingTenantIds)
        .eq('status', 'active');

      console.log('[find_businesses] tenants fetched:', tenants?.length, 'error:', tenantError?.message);

      serviceTenantMap = new Map();
      for (const t of (tenants ?? []) as unknown as { id: string; name: string; logo_url: string | null; categories: { name: string } | { name: string }[] | null }[]) {
        const cat = Array.isArray(t.categories) ? t.categories[0]?.name ?? null : t.categories?.name ?? null;
        serviceTenantMap.set(t.id, { id: t.id, name: t.name, image_url: t.logo_url ?? undefined, category: cat, business_category: cat, matched_services: svcByTenant.get(t.id) ?? [] });
      }
    }

    if (serviceTenantMap.size > 0) {
      let businesses: { id: string; name: string; image_url?: string; category?: string | null; business_category?: string | null; matched_services?: string[]; all_services?: { id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; image_url: string | null }[]; distance_km?: number; distance_mi?: number; estimated_drive_minutes?: number; locations?: { name: string; address: string; latitude: number | null; longitude: number | null }[]; has_availability?: boolean }[] = Array.from(serviceTenantMap.values());

      // Fetch locations
      const bizIds = businesses.map((b) => b.id);
      const { data: bizLocations } = bizIds.length > 0
        ? await supabase.from('tenant_locations').select('tenant_id, name, address, latitude, longitude').in('tenant_id', bizIds)
        : { data: [] };

      console.log('[find_businesses] bizLocations count:', bizLocations?.length);

      // Fetch ALL services for each business so the AI can show them all (not just matched ones)
      const { data: allBizServices } = bizIds.length > 0
        ? await supabase
            .from('services')
            .select('tenant_id, id, name, price, duration_minutes, deposit_enabled, deposit_amount, image_url, visibility')
            .in('tenant_id', bizIds)
            .eq('visibility', 'public')
        : { data: [] };

      const bizSvcMap = new Map<string, { id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; image_url: string | null }[]>();
      for (const svc of (allBizServices ?? []) as { tenant_id: string; id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; image_url: string | null }[]) {
        const existing = bizSvcMap.get(svc.tenant_id) ?? [];
        existing.push({ id: svc.id, name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, deposit_enabled: svc.deposit_enabled, deposit_amount: svc.deposit_amount, image_url: svc.image_url });
        bizSvcMap.set(svc.tenant_id, existing);
      }

      // Attach all_services to each business
      businesses = businesses.map((b) => ({ ...b, all_services: bizSvcMap.get(b.id) ?? [] }));

      const bizLocMap = new Map<string, { name: string; address: string; latitude: number | null; longitude: number | null }[]>();
      for (const loc of (bizLocations ?? []) as { tenant_id: string; name: string; address: string; latitude: number | null; longitude: number | null }[]) {
        const existing = bizLocMap.get(loc.tenant_id) ?? [];
        existing.push({ name: loc.name, address: loc.address, latitude: loc.latitude, longitude: loc.longitude });
        bizLocMap.set(loc.tenant_id, existing);
      }

      // Sort by proximity if user location available
      if (userLat && userLng) {
        const locMap = new Map<string, { latitude: number; longitude: number }>();
        for (const loc of (bizLocations ?? []) as { tenant_id: string; latitude: number | null; longitude: number | null }[]) {
          if (loc.latitude && loc.longitude && !locMap.has(loc.tenant_id)) {
            locMap.set(loc.tenant_id, { latitude: loc.latitude, longitude: loc.longitude });
          }
        }

        const businessesWithDistance = businesses.map((b) => {
          const loc = locMap.get(b.id);
          if (!loc) {
            return { ...b, distance_km: undefined, distance_mi: undefined, estimated_drive_minutes: undefined, locations: bizLocMap.get(b.id) ?? [] };
          }
          const distance = haversineKm(userLat, userLng, loc.latitude, loc.longitude);
          const distKm = Math.round(distance * 10) / 10;
          const distMi = Math.round(distKm * 0.621371 * 10) / 10;
          return { ...b, distance_km: distKm, distance_mi: distMi, estimated_drive_minutes: estimateDriveMinutes(distKm), locations: bizLocMap.get(b.id) ?? [] };
        });

        console.log('[find_businesses] businessesWithDistance count:', businessesWithDistance.length);
        console.log('[find_businesses] sample distances:', businessesWithDistance.slice(0, 3).map(b => ({ name: b.name, dist: b.distance_km })));

        businesses = businessesWithDistance
          .filter((b) => b.distance_km === undefined || b.distance_km <= radiusKm)
          .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));

        console.log('[find_businesses] after proximity filter count:', businesses.length, 'radiusKm used:', radiusKm);
      } else {
        businesses = businesses.map((b) => ({ ...b, locations: bizLocMap.get(b.id) ?? [] }));
      }

      // Check availability
      const bizIdsForAvail = businesses.map((b) => b.id);
      const { data: staffForAvail } = bizIdsForAvail.length > 0
        ? await supabase.from('staff').select('tenant_id, availability_schedule').in('tenant_id', bizIdsForAvail)
        : { data: [] };
      const tenantsWithStaffSet = new Set<string>();
      for (const s of (staffForAvail ?? []) as { tenant_id: string; availability_schedule: Record<string, unknown> | null }[]) {
        if (s.availability_schedule && Object.keys(s.availability_schedule).length > 0) {
          tenantsWithStaffSet.add(s.tenant_id);
        }
      }
      businesses = businesses.map((b) => ({ ...b, has_availability: tenantsWithStaffSet.has(b.id) }));

      const totalCount = businesses.length;
      const paged = businesses.slice(offset, offset + limit);
      const hasMore = offset + limit < totalCount;

      console.log('[find_businesses] returning:', paged.length, 'businesses (total:', totalCount, ')');

      return {
        success: true,
        data: {
          businesses: paged,
          total_count: totalCount,
          offset,
          limit,
          has_more: hasMore,
          matching_services: [],
          location_note: userLat && userLng ? undefined : 'Showing all locations — enable location access for nearby results',
        },
      };
    }
    // If no service-type matches found, fall through to general search below
    console.log('[find_businesses] service_type path found no tenants, falling through to general search');
  }

  if (!query) {
    // Return all active businesses when no query is provided
    const { data, error } = await supabase
      .from('tenants')
      .select('id, name, logo_url, categories(name)')
      .eq('status', 'active')
      .limit(200);

    console.log('[find_businesses] no-query result:', { count: data?.length, error: error?.message });

    if (error) return { success: false, error: error.message };

    let businesses = (data ?? []).map((t: unknown) => {
      const row = t as { id: string; name: string; logo_url: string | null; categories: { name: string } | { name: string }[] | null };
      const cat = Array.isArray(row.categories) ? row.categories[0]?.name ?? null : row.categories?.name ?? null;
      return { id: row.id, name: row.name, image_url: row.logo_url ?? undefined, category: cat, business_category: cat };
    }) as { id: string; name: string; image_url?: string; category?: string | null; business_category?: string | null; distance_km?: number; distance_mi?: number; estimated_drive_minutes?: number; locations?: { name: string; address: string; latitude: number | null; longitude: number | null }[]; has_availability?: boolean }[];
    let locationNote: string | undefined;

    // Fetch locations with addresses for all businesses
    const tenantIdsAll = businesses.map((b) => b.id);
    const { data: locationsAll } = tenantIdsAll.length > 0
      ? await supabase
          .from('tenant_locations')
          .select('tenant_id, name, address, latitude, longitude')
          .in('tenant_id', tenantIdsAll)
      : { data: [] };

    const locAllMap = new Map<string, { name: string; address: string; latitude: number | null; longitude: number | null }[]>();
    for (const loc of (locationsAll ?? []) as { tenant_id: string; name: string; address: string; latitude: number | null; longitude: number | null }[]) {
      const existing = locAllMap.get(loc.tenant_id) ?? [];
      existing.push({ name: loc.name, address: loc.address, latitude: loc.latitude, longitude: loc.longitude });
      locAllMap.set(loc.tenant_id, existing);
    }

    console.log('[find_businesses] no-query locationsAll count:', locationsAll?.length);

    // Fetch ALL services for each business so the AI can show them all
    const { data: noQueryServices } = tenantIdsAll.length > 0
      ? await supabase
          .from('services')
          .select('tenant_id, id, name, price, duration_minutes, deposit_enabled, deposit_amount, image_url, visibility')
          .in('tenant_id', tenantIdsAll)
          .eq('visibility', 'public')
      : { data: [] };

    const noQuerySvcMap = new Map<string, { id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; image_url: string | null }[]>();
    for (const svc of (noQueryServices ?? []) as { tenant_id: string; id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; image_url: string | null }[]) {
      const existing = noQuerySvcMap.get(svc.tenant_id) ?? [];
      existing.push({ id: svc.id, name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, deposit_enabled: svc.deposit_enabled, deposit_amount: svc.deposit_amount, image_url: svc.image_url });
      noQuerySvcMap.set(svc.tenant_id, existing);
    }
    businesses = businesses.map((b) => ({ ...b, all_services: noQuerySvcMap.get(b.id) ?? [] })) as typeof businesses;

    // If user location available, sort by proximity
    if (userLat && userLng && businesses.length > 0) {
      const locMap = new Map<string, { latitude: number; longitude: number }>();
      for (const loc of (locationsAll ?? []) as { tenant_id: string; latitude: number | null; longitude: number | null }[]) {
        if (loc.latitude && loc.longitude && !locMap.has(loc.tenant_id)) {
          locMap.set(loc.tenant_id, { latitude: loc.latitude, longitude: loc.longitude });
        }
      }
      const businessesWithDistance = businesses
        .map((b) => {
          const loc = locMap.get(b.id);
          if (!loc) {
            return { ...b, distance_km: undefined, distance_mi: undefined, estimated_drive_minutes: undefined, locations: locAllMap.get(b.id) ?? [] };
          }
          const distance = haversineKm(userLat, userLng, loc.latitude, loc.longitude);
          const distKm = Math.round(distance * 10) / 10;
          const distMi = Math.round(distKm * 0.621371 * 10) / 10;
          return { ...b, distance_km: distKm, distance_mi: distMi, estimated_drive_minutes: estimateDriveMinutes(distKm), locations: locAllMap.get(b.id) ?? [] };
        });

      console.log('[find_businesses] no-query businessesWithDistance count:', businessesWithDistance.length);
      console.log('[find_businesses] no-query sample distances:', businessesWithDistance.slice(0, 3).map(b => ({ name: b.name, dist: b.distance_km })));

      businesses = businessesWithDistance
        // Only filter out businesses that HAVE coordinates and are outside radius; keep those without coords
        .filter((b) => b.distance_km === undefined || b.distance_km <= radiusKm)
        .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));

      console.log('[find_businesses] no-query after proximity filter count:', businesses.length, 'radiusKm used:', radiusKm);
    } else {
      businesses = businesses.map((b) => ({ ...b, locations: locAllMap.get(b.id) ?? [] }));
      locationNote = 'Showing all locations — enable location access for nearby results';
    }

    // Check availability: each business needs at least 1 active staff with schedule
    const bizIdsForAvail = businesses.map((b: { id: string }) => b.id);
    const { data: staffForAvail } = bizIdsForAvail.length > 0
      ? await supabase
          .from('staff')
          .select('tenant_id, availability_schedule')
          .in('tenant_id', bizIdsForAvail)
      : { data: [] };

    const tenantsWithStaff = new Set<string>();
    for (const s of (staffForAvail ?? []) as { tenant_id: string; availability_schedule: Record<string, unknown> | null }[]) {
      if (s.availability_schedule && Object.keys(s.availability_schedule).length > 0) {
        tenantsWithStaff.add(s.tenant_id);
      }
    }

    businesses = businesses.map((b) => ({
      ...b,
      has_availability: tenantsWithStaff.has(b.id),
    })) as typeof businesses;

    const totalCount = businesses.length;
    const paged = businesses.slice(offset, offset + limit);
    const hasMore = offset + limit < totalCount;

    console.log('[find_businesses] no-query returning:', paged.length, 'businesses (total:', totalCount, ')');

    return { success: true, data: { businesses: paged, total_count: totalCount, offset, limit, has_more: hasMore, matching_services: [], location_note: locationNote } };
  }

  // Sanitize query for use in Supabase filter (escape % and _ which are SQL wildcards)
  const sanitize = (s: string) => s.replace(/%/g, '\\%').replace(/_/g, '\\_');
  const sanitized = sanitize(query);

  // 1. Search tenants by name
  const { data: tenantsByName } = await supabase
    .from('tenants')
    .select('id, name, logo_url, categories(name)')
    .eq('status', 'active')
    .ilike('name', `%${sanitized}%`)
    .limit(50);

  // 2. Build flexible service search patterns
  //    - Full query: "haircut" → %haircut%
  //    - Individual words (multi-word queries): "hair salon" → %hair%, %salon%
  //    - Compound word splits: "haircut" → %hair%cut%, %hai%rcut% (catches "Hair Cut")
  const servicePatterns: string[] = [`name.ilike.%${sanitized}%`];

  // Add synonym patterns for general query search
  const querySynonyms = SEARCH_SYNONYMS[query.toLowerCase()] ?? [];
  for (const syn of querySynonyms) {
    servicePatterns.push(`name.ilike.%${sanitize(syn)}%`);
  }

  const words = query.split(/\s+/).filter((w) => w.length >= 2);
  if (words.length > 1) {
    for (const w of words) {
      servicePatterns.push(`name.ilike.%${sanitize(w)}%`);
    }
  }

  // For single compound words (e.g. "haircut"), try splitting at each position
  // so "haircut" generates patterns like %hair%cut% which matches "Hair Cut"
  if (!query.includes(' ') && query.length > 4) {
    for (let i = 3; i <= query.length - 2; i++) {
      const left = sanitize(query.slice(0, i));
      const right = sanitize(query.slice(i));
      servicePatterns.push(`name.ilike.%${left}%${right}%`);
    }
  }

  const uniquePatterns = [...new Set(servicePatterns)];

  const { data: serviceMatches } = await supabase
    .from('services')
    .select('tenant_id, name, price, duration_minutes, tenants!inner(id, name, categories(name))')
    .or(uniquePatterns.join(','))
    .eq('tenants.status', 'active')
    .limit(20);

  // 3. Search tenants by category (e.g. "beauty" matches "Beauty & Personal Care")
  const { data: tenantsByCategory } = await supabase
    .from('tenants')
    .select('id, name, categories!inner(name)')
    .eq('status', 'active')
    .ilike('categories.name', `%${sanitized}%`)
    .limit(50);

  // Merge all found tenants (deduplicate by id) and track matched services per business
  const tenantMap = new Map<string, { id: string; name: string; image_url?: string; category?: string | null; business_category?: string | null }>();
  const tenantMatchedServices = new Map<string, string[]>();

  for (const t of (tenantsByName ?? []) as unknown as { id: string; name: string; logo_url: string | null; categories: { name: string } | { name: string }[] | null }[]) {
    const cat = Array.isArray(t.categories) ? t.categories[0]?.name ?? null : t.categories?.name ?? null;
    tenantMap.set(t.id, { id: t.id, name: t.name, image_url: t.logo_url ?? undefined, category: cat, business_category: cat });
  }
  for (const s of (serviceMatches ?? []) as unknown as { tenant_id: string; name: string; price: number; tenants: { id: string; name: string; categories: { name: string } | { name: string }[] | null } }[]) {
    if (s.tenants) {
      const sCat = Array.isArray(s.tenants.categories) ? s.tenants.categories[0]?.name ?? null : s.tenants.categories?.name ?? null;
      tenantMap.set(s.tenants.id, { id: s.tenants.id, name: s.tenants.name, category: sCat, business_category: sCat });
      const existing = tenantMatchedServices.get(s.tenants.id) ?? [];
      existing.push(s.name);
      tenantMatchedServices.set(s.tenants.id, existing);
    }
  }
  for (const t of (tenantsByCategory ?? []) as unknown as { id: string; name: string }[]) {
    if (!tenantMap.has(t.id)) tenantMap.set(t.id, { id: t.id, name: t.name, business_category: null });
  }

  let businesses: { id: string; name: string; image_url?: string; category?: string | null; business_category?: string | null; distance_km?: number; distance_mi?: number; estimated_drive_minutes?: number; matched_services?: string[]; locations?: { name: string; address: string; latitude: number | null; longitude: number | null }[] }[] = Array.from(tenantMap.values()).map((t) => ({
    ...t,
    matched_services: tenantMatchedServices.get(t.id),
  }));
  let locationNote: string | undefined;

  // Fetch locations with addresses for all businesses
  const bizIds = businesses.map((b) => b.id);
  const { data: bizLocations } = bizIds.length > 0
    ? await supabase
        .from('tenant_locations')
        .select('tenant_id, name, address, latitude, longitude')
        .in('tenant_id', bizIds)
    : { data: [] };

  const bizLocMap = new Map<string, { name: string; address: string; latitude: number | null; longitude: number | null }[]>();
  for (const loc of (bizLocations ?? []) as { tenant_id: string; name: string; address: string; latitude: number | null; longitude: number | null }[]) {
    const existing = bizLocMap.get(loc.tenant_id) ?? [];
    existing.push({ name: loc.name, address: loc.address, latitude: loc.latitude, longitude: loc.longitude });
    bizLocMap.set(loc.tenant_id, existing);
  }

  // Fetch ALL services for each business
  const { data: queryBizServices } = bizIds.length > 0
    ? await supabase
        .from('services')
        .select('tenant_id, id, name, price, duration_minutes, deposit_enabled, deposit_amount, image_url, visibility')
        .in('tenant_id', bizIds)
        .eq('visibility', 'public')
    : { data: [] };

  const querySvcMap = new Map<string, { id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; image_url: string | null }[]>();
  for (const svc of (queryBizServices ?? []) as { tenant_id: string; id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; image_url: string | null }[]) {
    const existing = querySvcMap.get(svc.tenant_id) ?? [];
    existing.push({ id: svc.id, name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, deposit_enabled: svc.deposit_enabled, deposit_amount: svc.deposit_amount, image_url: svc.image_url });
    querySvcMap.set(svc.tenant_id, existing);
  }
  businesses = businesses.map((b) => ({ ...b, all_services: querySvcMap.get(b.id) ?? [] }));

  // Sort by proximity if user location is available
  if (userLat && userLng && businesses.length > 0) {
    const locMap = new Map<string, { latitude: number; longitude: number }>();
    for (const loc of (bizLocations ?? []) as { tenant_id: string; latitude: number | null; longitude: number | null }[]) {
      if (loc.latitude && loc.longitude && !locMap.has(loc.tenant_id)) {
        locMap.set(loc.tenant_id, { latitude: loc.latitude, longitude: loc.longitude });
      }
    }
    businesses = businesses
      .map((b) => {
        const loc = locMap.get(b.id);
        if (!loc) {
          return { ...b, distance_km: undefined, distance_mi: undefined, estimated_drive_minutes: undefined, locations: bizLocMap.get(b.id) ?? [] };
        }
        const distance = haversineKm(userLat, userLng, loc.latitude, loc.longitude);
        const distKm = Math.round(distance * 10) / 10;
        const distMi = Math.round(distKm * 0.621371 * 10) / 10;
        return { ...b, distance_km: distKm, distance_mi: distMi, estimated_drive_minutes: estimateDriveMinutes(distKm), locations: bizLocMap.get(b.id) ?? [] };
      })
      .filter((b) => b.distance_km === undefined || b.distance_km <= radiusKm)
      .sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999));
  } else {
    businesses = businesses.map((b) => ({ ...b, locations: bizLocMap.get(b.id) ?? [] }));
    locationNote = 'Showing all locations — enable location access for nearby results';
  }

  // Check availability: each business needs at least 1 active staff with schedule
  const bizIdsForAvailQuery = businesses.map((b) => b.id);
  const { data: staffForAvailQuery } = bizIdsForAvailQuery.length > 0
    ? await supabase
        .from('staff')
        .select('tenant_id, availability_schedule')
        .in('tenant_id', bizIdsForAvailQuery)
    : { data: [] };

  const tenantsWithStaffQuery = new Set<string>();
  for (const s of (staffForAvailQuery ?? []) as { tenant_id: string; availability_schedule: Record<string, unknown> | null }[]) {
    if (s.availability_schedule && Object.keys(s.availability_schedule).length > 0) {
      tenantsWithStaffQuery.add(s.tenant_id);
    }
  }

  businesses = businesses.map((b) => ({
    ...b,
    has_availability: tenantsWithStaffQuery.has(b.id),
  }));

  const totalCount = businesses.length;
  const paged = businesses.slice(offset, offset + limit);
  const hasMore = offset + limit < totalCount;

  return {
    success: true,
    data: {
      businesses: paged,
      total_count: totalCount,
      offset,
      limit,
      has_more: hasMore,
      matching_services: serviceMatches ?? [],
      location_note: locationNote,
    },
  };
}

// ── get_locations ───────────────────────────────────────────────────────────

export async function handleGetLocations(
  supabase: AdminClient,
  tenantId: string,
  _input: Record<string, unknown>,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('tenant_locations')
    .select('id, name, address, latitude, longitude, timezone')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

// ── get_services ────────────────────────────────────────────────────────────

export async function handleGetServices(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  console.log('[get_services] called with tenantId:', tenantId);
  const serviceId = input.service_id as string | undefined;

  // Base query — always scope to tenant
  let query = supabase
    .from('services')
    .select(`
      id, name, price, duration_minutes, description, image_url,
      deposit_enabled, deposit_amount, deposit_type,
      service_category, service_subcategory,
      service_extras (id, name, price, duration_minutes),
      service_staff (
        staff_id,
        staff:staff_id (id, name, image_url)
      )
    `)
    .eq('tenant_id', tenantId)
    .eq('visibility', 'public');

  if (serviceId) {
    query = query.eq('id', serviceId);
  }

  const { data: services, error } = await query;
  if (error) return { success: false, error: error.message };

  const mapped = ((services ?? []) as unknown as {
    id: string; name: string; price: number; duration_minutes: number;
    description: string | null; image_url: string | null; deposit_enabled: boolean; deposit_amount: number | null;
    deposit_type: string | null; service_category: string | null; service_subcategory: string | null;
    service_extras: { id: string; name: string; price: number; duration_minutes: number }[] | null;
    service_staff: { staff_id: string; staff: { id: string; name: string; image_url: string | null } | null }[] | null;
  }[]).map((s) => ({
    id: s.id,
    name: s.name,
    price: s.price,
    duration_minutes: s.duration_minutes,
    description: s.description,
    image_url: s.image_url,
    deposit_enabled: s.deposit_enabled,
    deposit_amount: s.deposit_amount,
    deposit_type: s.deposit_type,
    category: s.service_category,
    // Extras scoped to THIS service only
    extras: s.service_extras ?? [],
    has_extras: (s.service_extras ?? []).length > 0,
    // Staff assigned to THIS service only
    staff: (s.service_staff ?? []).map((ss) => ss.staff).filter(Boolean),
    staff_ids: (s.service_staff ?? []).map((ss) => ss.staff_id),
  }));

  return { success: true, data: mapped };
}

// ── get_service_details ─────────────────────────────────────────────────────

export async function handleGetServiceDetails(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const serviceId = input.service_id as string;
  if (!serviceId) return { success: false, error: 'service_id is required' };

  const { data, error } = await supabase
    .from('services')
    .select('*, service_extras(*), categories(name)')
    .eq('id', serviceId)
    .single();

  if (error) return { success: false, error: error.message };

  // Fetch staff assigned to THIS service via service_staff junction table
  const service = data as { tenant_id: string } | null;
  if (service) {
    const { data: serviceStaffData } = await supabase
      .from('service_staff')
      .select('staff:staff_id(id, name, image_url)')
      .eq('service_id', serviceId);
    const assignedStaff = ((serviceStaffData ?? []) as unknown as { staff: { id: string; name: string; image_url: string | null } | null }[])
      .map((ss) => ss.staff)
      .filter(Boolean);
    return { success: true, data: { ...service, available_staff: assignedStaff } };
  }

  return { success: true, data };
}

// ── get_staff ───────────────────────────────────────────────────────────────

export async function handleGetStaff(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const serviceId = input.service_id as string | undefined;

  if (serviceId) {
    // Return only staff assigned to this specific service
    const { data, error } = await supabase
      .from('service_staff')
      .select('staff:staff_id(id, name, image_url, availability_schedule)')
      .eq('service_id', serviceId);

    if (error) return { success: false, error: error.message };

    const staffList = ((data ?? []) as unknown as { staff: { id: string; name: string; image_url: string | null; availability_schedule: unknown } | null }[])
      .map((ss) => ss.staff)
      .filter(Boolean);

    return { success: true, data: staffList };
  }

  // Fallback: all active staff for tenant
  const { data, error } = await supabase
    .from('staff')
    .select('id, name, image_url, availability_schedule')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) return { success: false, error: error.message };
  return { success: true, data };
}

// ── check_availability ──────────────────────────────────────────────────────

export async function handleCheckAvailability(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
  sessionInfo?: { customerId: string | null; customerName: string | null; customerPhone: string | null; chatSessionId: string; userId: string | null },
): Promise<ToolResult> {
  const serviceId = input.service_id as string;
  const date = input.date as string; // YYYY-MM-DD
  const staffId = input.staff_id as string | undefined;
  const offset = (input.offset as number) || 0;
  const MAX_SLOTS = 6;

  if (!serviceId || !date) {
    return { success: false, error: 'service_id and date are required' };
  }

  // Validate date format — must be YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { success: false, error: `Date must be in YYYY-MM-DD format. Received: ${date}` };
  }

  // 1. Get service details including buffer times
  const { data: service, error: svcErr } = await supabase
    .from('services')
    .select('duration_minutes, tenant_id, buffer_time_before, buffer_time_after')
    .eq('id', serviceId)
    .single();

  if (svcErr || !service) return { success: false, error: 'Service not found' };
  const svc = service as { duration_minutes: number; tenant_id: string; buffer_time_before: number | null; buffer_time_after: number | null };
  const bufferBefore = svc.buffer_time_before ?? 0;
  const bufferAfter = svc.buffer_time_after ?? 0;
  const totalSlotMinutes = bufferBefore + svc.duration_minutes + bufferAfter;

  // 2. Check service_special_days for this date (day off or special hours)
  const { data: serviceSpecialDays } = await supabase
    .from('service_special_days')
    .select('is_day_off, start_time, end_time, breaks')
    .eq('service_id', serviceId)
    .eq('date', date);

  const serviceSpecialDay = (serviceSpecialDays ?? [])[0] as { is_day_off: boolean; start_time: string | null; end_time: string | null; breaks: unknown } | undefined;

  if (serviceSpecialDay?.is_day_off) {
    return { success: true, data: { date, service_duration_minutes: svc.duration_minutes, available_slots: [], message: 'This service is not available on this date.' } };
  }

  // 3. Get staff assigned to THIS service only via service_staff junction
  const { data: serviceStaffRows } = await supabase
    .from('service_staff')
    .select('staff_id, staff:staff_id(id, name, availability_schedule)')
    .eq('service_id', serviceId);

  let eligibleStaff = ((serviceStaffRows ?? []) as unknown as { staff_id: string; staff: { id: string; name: string; availability_schedule: Record<string, unknown> } | null }[])
    .map((ss) => ss.staff)
    .filter(Boolean) as { id: string; name: string; availability_schedule: Record<string, unknown> }[];

  if (eligibleStaff.length === 0) {
    return { success: true, data: { available_slots: [], message: 'No staff assigned to this service', date, service_duration_minutes: svc.duration_minutes } };
  }

  // Filter to requested staff if specified
  if (staffId) {
    eligibleStaff = eligibleStaff.filter((s) => s.id === staffId);
  }

  const staffList = eligibleStaff;
  if (staffList.length === 0) {
    return { success: true, data: { available_slots: [], message: 'Requested staff is not assigned to this service' } };
  }

  // 4. Check staff_special_days and staff_holidays for this date
  const staffIds = (staffList as { id: string }[]).map((s) => s.id);

  const { data: staffSpecialDays } = await supabase
    .from('staff_special_days')
    .select('staff_id, is_day_off, start_time, end_time, breaks')
    .in('staff_id', staffIds)
    .eq('date', date);

  const staffSpecialMap = new Map<string, { is_day_off: boolean; start_time: string | null; end_time: string | null; breaks: unknown }>();
  for (const ssd of (staffSpecialDays ?? []) as { staff_id: string; is_day_off: boolean; start_time: string | null; end_time: string | null; breaks: unknown }[]) {
    staffSpecialMap.set(ssd.staff_id, ssd);
  }

  // staff_holidays table has a single `date` column (not start_date/end_date)
  const { data: staffHolidays } = await supabase
    .from('staff_holidays')
    .select('staff_id')
    .in('staff_id', staffIds)
    .eq('date', date);

  const holidayStaffIds = new Set(((staffHolidays ?? []) as { staff_id: string }[]).map((h) => h.staff_id));

  // 5. Resolve the tenant's timezone so we generate slots in local time
  const timezone = await getTenantTimezone(supabase, tenantId);

  // Query existing appointments for the entire local day (converted to UTC range)
  const dayStartUtc = localTimeToUTC(date, '00:00', timezone).toISOString();
  const dayEndUtc = localTimeToUTC(date, '23:59', timezone).toISOString();

  const { data: existingAppts } = await supabase
    .from('appointments')
    .select('staff_id, start_time, end_time')
    .eq('tenant_id', tenantId)
    .gte('start_time', dayStartUtc)
    .lte('start_time', dayEndUtc)
    .in('status', ['pending', 'confirmed']);

  const appointments = (existingAppts ?? []) as { staff_id: string | null; start_time: string; end_time: string }[];

  // 6. Fetch the customer's existing appointments for this day (for conflict awareness)
  let customerAppointments: { id: string; start_time: string; end_time: string; service_name: string; business_name: string }[] = [];
  const customerId = sessionInfo?.customerId ?? null;
  let resolvedCustomerId = customerId;

  if (!resolvedCustomerId && sessionInfo?.userId) {
    const { data: byUserId } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', sessionInfo.userId)
      .limit(1)
      .maybeSingle();
    if (byUserId) resolvedCustomerId = (byUserId as { id: string }).id;
  }

  if (resolvedCustomerId) {
    const { data: custAppts } = await supabase
      .from('appointments')
      .select('id, start_time, end_time, services(name), tenants(name)')
      .eq('customer_id', resolvedCustomerId)
      .gte('start_time', dayStartUtc)
      .lte('start_time', dayEndUtc)
      .in('status', ['pending', 'confirmed']);

    customerAppointments = ((custAppts ?? []) as unknown as { id: string; start_time: string; end_time: string; services: { name: string } | null; tenants: { name: string } | null }[]).map((a) => ({
      id: a.id,
      start_time: a.start_time,
      end_time: a.end_time,
      service_name: a.services?.name ?? 'Unknown',
      business_name: a.tenants?.name ?? 'Unknown',
    }));
  }

  // 7. Generate available slots from staff schedules
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const dayOfWeek = dayNames[new Date(date).getDay()] as string;

  const slots: { time: string; local_time: string; staff_id: string; staff_name: string }[] = [];

  for (const staff of staffList as { id: string; name: string; availability_schedule: Record<string, unknown> }[]) {
    // Skip staff on holiday
    if (holidayStaffIds.has(staff.id)) continue;

    // Check staff special day
    const staffSpecial = staffSpecialMap.get(staff.id);
    if (staffSpecial?.is_day_off) continue;

    const schedule = staff.availability_schedule as Record<string, { start: string; end: string } | undefined>;
    let dayScheduleStart: string;
    let dayScheduleEnd: string;

    if (staffSpecial?.start_time && staffSpecial?.end_time) {
      // Use special day hours override
      dayScheduleStart = staffSpecial.start_time;
      dayScheduleEnd = staffSpecial.end_time;
    } else {
      const daySchedule = schedule[dayOfWeek];
      if (!daySchedule?.start || !daySchedule?.end) continue;
      dayScheduleStart = daySchedule.start;
      dayScheduleEnd = daySchedule.end;
    }

    // If service has special hours, further constrain
    if (serviceSpecialDay?.start_time && serviceSpecialDay?.end_time) {
      // Use the more restrictive window
      if (serviceSpecialDay.start_time > dayScheduleStart) dayScheduleStart = serviceSpecialDay.start_time;
      if (serviceSpecialDay.end_time < dayScheduleEnd) dayScheduleEnd = serviceSpecialDay.end_time;
    }

    // Parse schedule hours
    const startParts = dayScheduleStart.split(':').map(Number);
    const endParts = dayScheduleEnd.split(':').map(Number);
    const scheduleStartMinutes = (startParts[0] ?? 0) * 60 + (startParts[1] ?? 0);
    const scheduleEndMinutes = (endParts[0] ?? 0) * 60 + (endParts[1] ?? 0);

    // Generate slots in 30-minute increments — convert local time to UTC
    for (let minutes = scheduleStartMinutes; minutes + totalSlotMinutes <= scheduleEndMinutes; minutes += 30) {
      const slotHour = Math.floor(minutes / 60);
      const slotMin = minutes % 60;
      const localTimeStr = `${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`;

      // Convert the local slot time to proper UTC (buffer_before comes before the actual start)
      const bufferStartUtc = localTimeToUTC(date, localTimeStr, timezone);
      const slotStartUtc = new Date(bufferStartUtc.getTime() + bufferBefore * 60000);
      const slotEndUtc = new Date(slotStartUtc.getTime() + svc.duration_minutes * 60000);
      const bufferEndUtc = new Date(slotEndUtc.getTime() + bufferAfter * 60000);

      // Check for conflicts against existing appointments (including buffer)
      const hasConflict = appointments.some((appt) => {
        if (appt.staff_id !== staff.id) return false;
        const apptStart = new Date(appt.start_time).getTime();
        const apptEnd = new Date(appt.end_time).getTime();
        return bufferStartUtc.getTime() < apptEnd && bufferEndUtc.getTime() > apptStart;
      });

      if (!hasConflict) {
        // Compute human-readable local start time (accounting for buffer before)
        const serviceStartMinutes = minutes + bufferBefore;
        const displayHour = Math.floor(serviceStartMinutes / 60);
        const displayMin = serviceStartMinutes % 60;
        const ampm = displayHour >= 12 ? 'PM' : 'AM';
        const displayHour12 = displayHour === 0 ? 12 : displayHour > 12 ? displayHour - 12 : displayHour;
        const localDisplay = `${displayHour12}:${String(displayMin).padStart(2, '0')} ${ampm}`;

        slots.push({
          time: slotStartUtc.toISOString(),
          local_time: localDisplay,
          staff_id: staff.id,
          staff_name: staff.name,
        });
      }
    }
  }

  // Paginate: return max 6 slots per call
  const totalSlots = slots.length;
  const pagedSlots = slots.slice(offset, offset + MAX_SLOTS);
  const hasMore = offset + MAX_SLOTS < totalSlots;

  return {
    success: true,
    data: {
      date,
      service_duration_minutes: svc.duration_minutes,
      available_slots: pagedSlots,
      total_slots: totalSlots,
      offset,
      has_more: hasMore,
      next_offset: hasMore ? offset + MAX_SLOTS : null,
      customer_appointments_on_this_day: customerAppointments.length > 0 ? customerAppointments : undefined,
    },
  };
}

// ── book_appointment ────────────────────────────────────────────────────────

export async function handleBookAppointment(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
  sessionInfo: { customerId: string | null; customerName: string | null; customerPhone: string | null; chatSessionId: string; userId: string | null },
): Promise<ToolResult> {
  const serviceId = input.service_id as string;
  const startTime = input.start_time as string;
  const staffId = (input.staff_id as string) || null;
  const locationId = (input.location_id as string) || null;
  const selectedExtras = (input.selected_extras as { extra_id: string; quantity?: number }[] | undefined) ?? [];
  const couponCode = (input.coupon_code as string) || null;
  const loyaltyPointsToRedeem = (input.loyalty_points_to_redeem as number) || 0;
  const useCustomerPackage = (input.use_customer_package as boolean) || false;
  const _packageId = (input.package_id as string) || null;

  if (!serviceId || !startTime) {
    return { success: false, error: 'service_id and start_time are required' };
  }

  // ── Phase 3: Parallel initial queries ──────────────────────────────────────
  // Steps 1 (service), 4 (customer), 5 (location+timezone), 6 (staff) are independent.
  // Run them all in parallel to cut latency.

  const needsTimezone = !/Z$|[+-]\d{2}:\d{2}$/.test(startTime);

  const [serviceResult, customerResult, locationResult, staffResult] = await Promise.all([
    // 1. Service details
    supabase.from('services').select('*').eq('id', serviceId).single(),

    // 4. Find customer
    (async () => {
      if (sessionInfo.customerId) return { id: sessionInfo.customerId, created: false };
      if (sessionInfo.userId) {
        const { data } = await supabase.from('customers').select('id').eq('user_id', sessionInfo.userId).limit(1).maybeSingle();
        if (data) return { id: (data as { id: string }).id, created: false };
      }
      if (sessionInfo.customerPhone) {
        const { data } = await supabase.from('customers').select('id').eq('phone', sessionInfo.customerPhone).limit(1).maybeSingle();
        if (data) return { id: (data as { id: string }).id, created: false };
      }
      // Create anonymous customer
      const email = `chat_${Date.now()}@widget.balkina.ai`;
      const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
        email, email_confirm: true,
        user_metadata: { display_name: sessionInfo.customerName ?? 'Guest', source: 'chat_widget' },
      });
      if (authErr || !authUser.user) return { id: null, error: authErr?.message ?? 'Unknown error', created: false };
      await supabase.from('customers').insert({
        id: authUser.user.id, display_name: sessionInfo.customerName,
        phone: sessionInfo.customerPhone, email: null, user_id: sessionInfo.userId ?? null,
      } as never);
      return { id: authUser.user.id, created: true };
    })(),

    // 5. Location (+ timezone for time parsing and response formatting)
    (async () => {
      if (locationId) {
        const { data } = await supabase.from('tenant_locations').select('id, address, timezone').eq('id', locationId).single();
        const loc = data as { id: string; address: string; timezone: string } | null;
        return { id: loc?.id ?? locationId, address: loc?.address ?? null, timezone: loc?.timezone ?? 'UTC' };
      }
      const { data } = await supabase.from('tenant_locations').select('id, address, timezone').eq('tenant_id', tenantId).limit(1);
      const loc = (data as { id: string; address: string; timezone: string }[] | null)?.[0];
      return { id: loc?.id ?? null, address: loc?.address ?? null, timezone: loc?.timezone ?? 'UTC' };
    })(),

    // 6. Staff
    (async () => {
      if (staffId) {
        const { data } = await supabase.from('staff').select('id, name').eq('id', staffId).single();
        const s = data as { id: string; name: string } | null;
        return { id: s?.id ?? staffId, name: s?.name ?? null };
      }
      const { data } = await supabase.from('staff').select('id, name').eq('tenant_id', tenantId).limit(1);
      const s = (data as { id: string; name: string }[] | null)?.[0];
      return { id: s?.id ?? null, name: s?.name ?? null };
    })(),
  ]);

  // Unpack service
  if (!serviceResult.data) return { success: false, error: 'Service not found' };
  const service = serviceResult.data;
  const svc = service as { duration_minutes: number; price: number; deposit_enabled: boolean; deposit_type: string | null; deposit_amount: number | null; tenant_id: string };

  // Unpack customer
  const customerId = customerResult.id;
  if (!customerId) {
    return { success: false, error: `Failed to create customer: ${(customerResult as { error?: string }).error ?? 'Unknown error'}` };
  }

  // Unpack location & timezone
  const finalLocationId = locationResult.id;
  const bookingTimezone = locationResult.timezone;
  const locationAddress = locationResult.address;

  // Unpack staff
  const finalStaffId = staffResult.id;
  const staffName = staffResult.name;

  // 2. Calculate start/end times
  let start: Date;
  if (!needsTimezone) {
    start = new Date(startTime);
  } else {
    const [datePart, timePart] = startTime.split('T');
    if (datePart && timePart) {
      start = localTimeToUTC(datePart, timePart.slice(0, 5), bookingTimezone);
    } else {
      start = new Date(startTime);
    }
  }
  const end = new Date(start.getTime() + svc.duration_minutes * 60000);

  // 3. Calculate deposit
  let depositAmount: number | null = null;
  if (svc.deposit_enabled && svc.deposit_amount) {
    depositAmount = svc.deposit_type === 'percentage'
      ? (svc.price * svc.deposit_amount) / 100
      : svc.deposit_amount;
  }

  // 7. Create the appointment
  const balanceDue = depositAmount ? svc.price - depositAmount : svc.price;

  const { data: appointment, error: apptErr } = await supabase
    .from('appointments')
    .insert({
      customer_id: customerId,
      tenant_id: tenantId,
      service_id: serviceId,
      staff_id: finalStaffId,
      location_id: finalLocationId,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      status: 'confirmed',
      total_price: svc.price,
      deposit_paid: false,
      deposit_amount_paid: depositAmount,
      balance_due: balanceDue,
    } as never)
    .select()
    .single();

  if (apptErr) return { success: false, error: apptErr.message };

  const appointmentId = (appointment as { id: string }).id;

  // ── Phase 3: Parallel post-insert operations ────────────────────────────────
  // Run extras lookup, coupon validation, loyalty program fetch, package decrement,
  // chat session update, and business name fetch all in parallel where possible.

  const [extrasResult, couponResult, loyaltyProgram, packageResult, , tenantResult] = await Promise.all([
    // 8a. Fetch extra prices (if any)
    selectedExtras.length > 0
      ? supabase.from('service_extras').select('id, price').in('id', selectedExtras.map((e) => e.extra_id))
      : Promise.resolve({ data: [] }),

    // 8b. Fetch coupon (if provided)
    couponCode
      ? supabase.from('coupons').select('id, discount_type, discount_value, expires_at, usage_count, usage_limit')
          .eq('tenant_id', tenantId).eq('code', couponCode).limit(1).single()
      : Promise.resolve({ data: null }),

    // 8c+8d. Fetch loyalty program (single query for both redeem and earn)
    customerId && (loyaltyPointsToRedeem > 0 || true)
      ? supabase.from('loyalty_programs')
          .select('points_to_currency_rate, points_per_booking, points_per_dollar, is_active')
          .eq('tenant_id', tenantId).limit(1).single()
      : Promise.resolve({ data: null }),

    // 8e. Fetch package service entry (if using package)
    useCustomerPackage && customerId
      ? supabase.from('customer_package_services')
          .select('id, sessions_remaining, customer_package_id')
          .eq('service_id', serviceId).gt('sessions_remaining', 0).limit(1).single()
      : Promise.resolve({ data: null }),

    // 9. Link customer to chat session
    customerId
      ? supabase.from('chat_sessions').update({ customer_id: customerId } as never).eq('id', sessionInfo.chatSessionId)
      : Promise.resolve(),

    // Fetch business name for response
    supabase.from('tenants').select('name').eq('id', tenantId).single(),
  ]);

  // 8a. Process extras
  let extrasTotal = 0;
  if (selectedExtras.length > 0 && extrasResult.data) {
    const extraPriceMap = new Map<string, number>();
    for (const ex of (extrasResult.data as { id: string; price: number }[])) {
      extraPriceMap.set(ex.id, ex.price);
    }
    const extrasInserts = selectedExtras.map((e) => {
      const price = extraPriceMap.get(e.extra_id) ?? 0;
      const qty = e.quantity ?? 1;
      extrasTotal += price * qty;
      return { appointment_id: appointmentId, extra_id: e.extra_id, quantity: qty, price_at_booking: price };
    });
    await supabase.from('appointment_extras').insert(extrasInserts as never[]);
  }

  // 8b. Process coupon
  let couponDiscount = 0;
  if (couponCode && couponResult.data) {
    const c = couponResult.data as { id: string; discount_type: string; discount_value: number; expires_at: string | null; usage_count: number; usage_limit: number | null };
    const isValid = (!c.expires_at || new Date(c.expires_at) >= new Date()) &&
      (c.usage_limit === null || c.usage_count < c.usage_limit);
    if (isValid) {
      couponDiscount = c.discount_type === 'percentage'
        ? (svc.price * c.discount_value) / 100
        : c.discount_value;
      couponDiscount = Math.min(couponDiscount, svc.price);
      // Record usage, increment count, store on appointment — all in parallel
      await Promise.all([
        supabase.from('coupon_usage').insert({
          coupon_id: c.id, appointment_id: appointmentId, customer_id: customerId, discount_amount: couponDiscount,
        } as never),
        supabase.from('coupons').update({ usage_count: c.usage_count + 1 } as never).eq('id', c.id),
        supabase.from('appointments').update({ coupon_id: c.id } as never).eq('id', appointmentId),
      ]);
    }
  }

  // 8c. Handle loyalty points redemption
  let loyaltyDiscount = 0;
  if (loyaltyPointsToRedeem > 0 && customerId && loyaltyProgram.data) {
    const lp = loyaltyProgram.data as { points_to_currency_rate: number; is_active: boolean };
    if (lp.is_active) {
      loyaltyDiscount = Math.min(
        loyaltyPointsToRedeem * lp.points_to_currency_rate,
        svc.price + extrasTotal - couponDiscount,
      );
      // Insert redeem transaction + fetch current balance in parallel
      const [, { data: currentPts }] = await Promise.all([
        supabase.from('loyalty_transactions').insert({
          customer_id: customerId, tenant_id: tenantId, appointment_id: appointmentId,
          type: 'redeem', points: -loyaltyPointsToRedeem, description: 'Points redeemed for booking discount',
        } as never),
        supabase.from('customer_loyalty_points').select('points_balance')
          .eq('customer_id', customerId).eq('tenant_id', tenantId).limit(1).single(),
      ]);
      if (currentPts) {
        const newBalance = (currentPts as { points_balance: number }).points_balance - loyaltyPointsToRedeem;
        await supabase.from('customer_loyalty_points')
          .update({ points_balance: Math.max(0, newBalance) } as never)
          .eq('customer_id', customerId).eq('tenant_id', tenantId);
      }
    }
  }

  // 8d. Earn loyalty points
  let pointsEarned = 0;
  if (customerId && loyaltyProgram.data) {
    const lp = loyaltyProgram.data as { points_per_booking: number; points_per_dollar: number | null; is_active: boolean };
    if (lp.is_active) {
      pointsEarned = (lp.points_per_booking ?? 0) + Math.floor((lp.points_per_dollar ?? 0) * svc.price);
      if (pointsEarned > 0) {
        await supabase.from('loyalty_transactions').insert({
          customer_id: customerId, tenant_id: tenantId, appointment_id: appointmentId,
          type: 'earn', points: pointsEarned, description: 'Points earned from booking',
        } as never);
      }
    }
  }

  // 8e. Decrement package sessions
  if (useCustomerPackage && customerId && packageResult.data) {
    const entry = packageResult.data as { id: string; sessions_remaining: number; customer_package_id: string };
    const { data: cpCheck } = await supabase.from('customer_packages').select('id')
      .eq('id', entry.customer_package_id).eq('customer_id', customerId).eq('tenant_id', tenantId).limit(1).single();
    if (cpCheck) {
      await supabase.from('customer_package_services')
        .update({ sessions_remaining: entry.sessions_remaining - 1 } as never).eq('id', entry.id);
    }
  }

  // Update appointment total if adjustments were made
  const finalTotal = svc.price + extrasTotal - couponDiscount - loyaltyDiscount;
  if (extrasTotal > 0 || couponDiscount > 0 || loyaltyDiscount > 0) {
    await supabase.from('appointments').update({
      total_price: finalTotal, balance_due: finalTotal - (depositAmount ?? 0),
    } as never).eq('id', appointmentId);
  }

  const businessName = (tenantResult.data as { name: string } | null)?.name ?? null;

  // 10. Compute human-readable local times (timezone already fetched in parallel step 5)
  const localStartStr = start.toLocaleString('en-US', { timeZone: bookingTimezone, hour: 'numeric', minute: '2-digit', hour12: true });
  const localEndStr = end.toLocaleString('en-US', { timeZone: bookingTimezone, hour: 'numeric', minute: '2-digit', hour12: true });
  const localDateStr = start.toLocaleDateString('en-US', { timeZone: bookingTimezone, weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return {
    success: true,
    data: {
      appointment_id: appointmentId,
      service_name: (service as { name: string }).name,
      staff_name: staffName,
      business_name: businessName,
      start_time: start.toISOString(),
      end_time: end.toISOString(),
      local_start_time: localStartStr,
      local_end_time: localEndStr,
      local_date: localDateStr,
      location_address: locationAddress,
      subtotal: svc.price,
      extras_total: extrasTotal,
      coupon_discount: couponDiscount,
      coupon_code: couponCode,
      loyalty_discount: loyaltyDiscount,
      loyalty_points_redeemed: loyaltyPointsToRedeem,
      loyalty_points_earned: pointsEarned,
      total_price: finalTotal,
      deposit_amount: depositAmount,
      balance_due: finalTotal - (depositAmount ?? 0),
      used_package: useCustomerPackage,
      status: 'confirmed',
    },
  };
}

// ── cancel_appointment ──────────────────────────────────────────────────────

export async function handleCancelAppointment(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
  sessionInfo: { customerId: string | null; customerName: string | null; customerPhone: string | null; chatSessionId: string; userId: string | null },
): Promise<ToolResult> {
  const appointmentId = input.appointment_id as string;
  const customerId = input.customer_id as string | undefined;
  const customerPhone = input.customer_phone as string | undefined;
  const customerEmail = input.customer_email as string | undefined;

  // If an appointment_id is given, cancel it directly
  if (appointmentId) {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'cancelled' } as never)
      .eq('id', appointmentId)
      .in('status', ['pending', 'confirmed'])
      .select('id, status')
      .single();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: 'Appointment not found or already cancelled/completed' };
    return { success: true, data };
  }

  // Otherwise, list all cancellable appointments for this customer
  let resolvedCustomerId = customerId ?? sessionInfo.customerId ?? undefined;

  // Try user_id lookup first (authenticated mobile user)
  if (!resolvedCustomerId && sessionInfo.userId) {
    const { data: byUserId } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', sessionInfo.userId)
      .limit(1)
      .maybeSingle();
    if (byUserId) resolvedCustomerId = (byUserId as { id: string }).id;
  }

  if (!resolvedCustomerId && (customerPhone || customerEmail || sessionInfo.customerPhone)) {
    let query = supabase.from('customers').select('id');
    if (customerEmail) query = query.eq('email', customerEmail);
    else if (customerPhone) query = query.eq('phone', customerPhone);
    else if (sessionInfo.customerPhone) query = query.eq('phone', sessionInfo.customerPhone);
    const { data: cust } = await query.limit(1).single();
    resolvedCustomerId = (cust as { id: string } | null)?.id;
  }

  if (!resolvedCustomerId) {
    return { success: false, error: 'Please provide appointment_id, customer_id, customer_email, or customer_phone to identify the appointment.' };
  }

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, status, services(name, price), staff(name), tenant_locations(name), tenants(name)')
    .eq('customer_id', resolvedCustomerId)
    .in('status', ['pending', 'confirmed'])
    .gte('start_time', new Date().toISOString())
    .order('start_time', { ascending: true });

  if (error) return { success: false, error: error.message };
  if (!appointments || appointments.length === 0) {
    return { success: true, data: { message: 'No upcoming cancellable appointments found.', appointments: [] } };
  }

  return {
    success: true,
    data: {
      message: `Found ${appointments.length} cancellable appointment(s). Ask the customer which one to cancel, then call cancel_appointment with the appointment_id.`,
      appointments,
    },
  };
}

// ── get_booking_details ─────────────────────────────────────────────────────

export async function handleGetBookingDetails(
  supabase: AdminClient,
  _tenantId: string,
  input: Record<string, unknown>,
  sessionInfo: { customerId: string | null; customerName: string | null; customerPhone: string | null; chatSessionId: string; userId: string | null },
): Promise<ToolResult> {
  const appointmentId = input.appointment_id as string | undefined;
  const customerId = input.customer_id as string | undefined;
  const customerPhone = input.customer_phone as string | undefined;
  const customerEmail = input.customer_email as string | undefined;

  // If an appointment_id is given, fetch that single appointment
  if (appointmentId) {
    const { data, error } = await supabase
      .from('appointments')
      .select('*, services(name, duration_minutes, price), staff(name), tenant_locations(name, address), tenants(name)')
      .eq('id', appointmentId)
      .single();

    if (error) return { success: false, error: error.message };
    return { success: true, data };
  }

  // Otherwise, fetch ALL upcoming appointments for the customer
  let resolvedCustomerId = customerId ?? sessionInfo.customerId ?? undefined;

  // Try user_id lookup first (authenticated mobile user)
  if (!resolvedCustomerId && sessionInfo.userId) {
    const { data: byUserId } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', sessionInfo.userId)
      .limit(1)
      .maybeSingle();
    if (byUserId) resolvedCustomerId = (byUserId as { id: string }).id;
  }

  if (!resolvedCustomerId && (customerPhone || customerEmail || sessionInfo.customerPhone)) {
    let query = supabase.from('customers').select('id');
    if (customerEmail) query = query.eq('email', customerEmail);
    else if (customerPhone) query = query.eq('phone', customerPhone);
    else if (sessionInfo.customerPhone) query = query.eq('phone', sessionInfo.customerPhone);
    const { data: cust } = await query.limit(1).single();
    resolvedCustomerId = (cust as { id: string } | null)?.id;
  }

  if (!resolvedCustomerId) {
    return { success: false, error: 'Please provide appointment_id, customer_id, customer_email, or customer_phone.' };
  }

  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, status, total_price, services(name, duration_minutes, price), staff(name), tenant_locations(name, address), tenants(name)')
    .eq('customer_id', resolvedCustomerId)
    .gte('start_time', new Date().toISOString())
    .in('status', ['pending', 'confirmed'])
    .order('start_time', { ascending: true });

  if (error) return { success: false, error: error.message };
  if (!appointments || appointments.length === 0) {
    return { success: true, data: { message: 'No upcoming appointments found.', appointments: [] } };
  }

  return { success: true, data: { appointments } };
}

// ── get_packages ────────────────────────────────────────────────────────────

export async function handleGetPackages(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const customerId = input.customer_id as string | undefined;
  const serviceId = input.service_id as string | undefined;

  // Fetch available packages for this tenant
  const { data: packagesData, error } = await supabase
    .from('packages')
    .select('*, package_services(quantity, service_id, services(name, price, duration_minutes))')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);
  if (error) return { success: false, error: error.message };

  let availablePackages = (packagesData ?? []) as { id: string; package_services: { service_id: string; quantity: number; services: { name: string } | null }[]; [key: string]: unknown }[];

  // If serviceId provided, filter to packages that include this service
  if (serviceId) {
    availablePackages = availablePackages.filter((pkg) =>
      pkg.package_services?.some((ps) => ps.service_id === serviceId)
    );
  }

  // If customerId provided, also fetch customer-owned packages
  let customerPackages: unknown[] = [];
  if (customerId) {
    const { data: custPkgs } = await supabase
      .from('customer_packages')
      .select('*, package:packages(name, price), sessions:customer_package_services(service_id, sessions_remaining, services(name))')
      .eq('customer_id', customerId)
      .eq('tenant_id', tenantId)
      .gt('expires_at', new Date().toISOString());

    let ownedPackages = (custPkgs ?? []) as { sessions: { service_id: string; sessions_remaining: number }[]; [key: string]: unknown }[];

    // If serviceId provided, filter to owned packages that cover this service with remaining sessions
    if (serviceId) {
      ownedPackages = ownedPackages.filter((cp) =>
        cp.sessions?.some((s) => s.service_id === serviceId && s.sessions_remaining > 0)
      );
    }

    customerPackages = ownedPackages;
  }

  return {
    success: true,
    data: {
      available_packages: availablePackages,
      customer_packages: customerPackages,
    },
  };
}

// ── get_loyalty_info ────────────────────────────────────────────────────────

export async function handleGetLoyaltyInfo(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const customerId = input.customer_id as string;
  const servicePrice = input.service_price as number | undefined;
  if (!customerId) return { success: false, error: 'customer_id is required' };

  // Fetch the loyalty program for this tenant
  const { data: program, error: programErr } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  if (programErr || !program) {
    return { success: true, data: { loyalty_program_active: false } };
  }

  const loyaltyProgram = program as {
    id: string;
    is_active: boolean;
    points_per_booking: number;
    points_per_dollar: number | null;
    points_to_currency_rate: number;
    tiers: unknown;
    minimum_redemption_points: number;
  };

  if (!loyaltyProgram.is_active) {
    return { success: true, data: { loyalty_program_active: false } };
  }

  // Fetch the customer's loyalty points for this tenant
  const { data: customerPoints } = await supabase
    .from('customer_loyalty_points')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  const pointsData = customerPoints as {
    points_balance: number;
    tier: string;
    lifetime_points: number;
  } | null;

  const pointsBalance = pointsData?.points_balance ?? 0;
  const redeemableValue = pointsBalance * loyaltyProgram.points_to_currency_rate;

  // Calculate points the customer would earn for this service
  let pointsToEarn: number | null = null;
  if (servicePrice != null) {
    const perBooking = loyaltyProgram.points_per_booking ?? 0;
    const perDollar = loyaltyProgram.points_per_dollar ?? 0;
    pointsToEarn = perBooking + Math.floor(perDollar * servicePrice);
  }

  return {
    success: true,
    data: {
      loyalty_program_active: true,
      points_balance: pointsBalance,
      redeemable_value_usd: Math.round(redeemableValue * 100) / 100,
      tier: pointsData?.tier ?? null,
      points_to_earn_for_this_service: pointsToEarn,
      program: {
        points_per_booking: loyaltyProgram.points_per_booking,
        points_per_dollar: loyaltyProgram.points_per_dollar ?? 0,
        points_to_currency_rate: loyaltyProgram.points_to_currency_rate,
        minimum_redemption_points: loyaltyProgram.minimum_redemption_points,
      },
    },
  };
}

// ── apply_coupon ────────────────────────────────────────────────────────────

export async function handleApplyCoupon(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const couponCode = input.coupon_code as string;
  const serviceId = input.service_id as string;
  const totalPrice = input.total_price as number;

  if (!couponCode) return { success: false, error: 'coupon_code is required' };
  if (!serviceId) return { success: false, error: 'service_id is required' };
  if (totalPrice == null) return { success: false, error: 'total_price is required' };

  // Look up the coupon by code and tenant
  const { data: coupon, error: couponErr } = await supabase
    .from('coupons')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('code', couponCode)
    .limit(1)
    .single();

  if (couponErr || !coupon) {
    return { success: false, error: 'Coupon not found' };
  }

  const c = coupon as {
    id: string;
    discount_type: string;
    discount_value: number;
    expires_at: string | null;
    usage_count: number;
    usage_limit: number | null;
  };

  // Validate expiration
  if (c.expires_at && new Date(c.expires_at) < new Date()) {
    return { success: false, error: 'Coupon has expired' };
  }

  // Validate usage limit
  if (c.usage_limit !== null && c.usage_count >= c.usage_limit) {
    return { success: false, error: 'Coupon usage limit has been reached' };
  }

  // Calculate discount
  let discountAmount: number;
  if (c.discount_type === 'percentage') {
    discountAmount = (totalPrice * c.discount_value) / 100;
  } else {
    discountAmount = c.discount_value;
  }

  // Ensure discount does not exceed total price
  discountAmount = Math.min(discountAmount, totalPrice);
  const finalPrice = totalPrice - discountAmount;

  return {
    success: true,
    data: {
      valid: true,
      discount_amount: discountAmount,
      final_price: finalPrice,
      coupon_id: c.id,
    },
  };
}

// ── redeem_loyalty_points ───────────────────────────────────────────────────

export async function handleRedeemLoyaltyPoints(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const customerId = input.customer_id as string;
  const pointsToRedeem = input.points_to_redeem as number;
  const totalPrice = input.total_price as number;

  if (!customerId) return { success: false, error: 'customer_id is required' };
  if (pointsToRedeem == null) return { success: false, error: 'points_to_redeem is required' };
  if (totalPrice == null) return { success: false, error: 'total_price is required' };

  // Fetch the loyalty program for this tenant
  const { data: program, error: programErr } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  if (programErr || !program) {
    return { success: false, error: 'No loyalty program found for this business' };
  }

  const loyaltyProgram = program as {
    points_to_currency_rate: number;
    minimum_redemption_points: number;
    is_active: boolean;
  };

  if (!loyaltyProgram.is_active) {
    return { success: false, error: 'Loyalty program is not active' };
  }

  // Fetch the customer's loyalty points
  const { data: customerPoints, error: pointsErr } = await supabase
    .from('customer_loyalty_points')
    .select('*')
    .eq('customer_id', customerId)
    .eq('tenant_id', tenantId)
    .limit(1)
    .single();

  if (pointsErr || !customerPoints) {
    return { success: false, error: 'No loyalty points found for this customer' };
  }

  const pointsData = customerPoints as { points_balance: number };

  // Validate enough points
  if (pointsData.points_balance < pointsToRedeem) {
    return {
      success: false,
      error: `Insufficient points. Available: ${pointsData.points_balance}, requested: ${pointsToRedeem}`,
    };
  }

  // Validate minimum redemption threshold
  if (pointsToRedeem < loyaltyProgram.minimum_redemption_points) {
    return {
      success: false,
      error: `Minimum redemption is ${loyaltyProgram.minimum_redemption_points} points`,
    };
  }

  // Calculate discount (DON'T actually deduct points — that happens when booking is confirmed)
  const discountAmount = Math.min(
    pointsToRedeem * loyaltyProgram.points_to_currency_rate,
    totalPrice,
  );
  const finalPrice = totalPrice - discountAmount;
  const remainingPoints = pointsData.points_balance - pointsToRedeem;

  return {
    success: true,
    data: {
      valid: true,
      points_used: pointsToRedeem,
      discount_amount: discountAmount,
      final_price: finalPrice,
      remaining_points: remainingPoints,
    },
  };
}

// ── get_inventory ───────────────────────────────────────────────────────────

export async function handleGetInventory(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
): Promise<ToolResult> {
  const serviceId = input.service_id as string | undefined;

  if (serviceId) {
    // Fetch products linked to this service via the junction table
    const { data, error } = await supabase
      .from('product_services')
      .select('products(id, name, sell_price, quantity_on_hand, display_in_booking)')
      .eq('service_id', serviceId)
      .eq('products.tenant_id', tenantId)
      .eq('products.is_active', true);

    if (error) return { success: false, error: error.message };

    // Extract products from the nested join
    const products = (data ?? [])
      .map((row) => (row as { products: unknown }).products)
      .filter(Boolean);

    return { success: true, data: products };
  }

  // Fetch all active products for the tenant
  const { data, error } = await supabase
    .from('products')
    .select('id, name, sell_price, quantity_on_hand, display_in_booking')
    .eq('tenant_id', tenantId)
    .eq('is_active', true);

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

// ── get_custom_fields ───────────────────────────────────────────────────────

export async function handleGetCustomFields(
  supabase: AdminClient,
  tenantId: string,
  _input: Record<string, unknown>,
): Promise<ToolResult> {
  const { data, error } = await supabase
    .from('custom_fields')
    .select('id, name, field_type, options, is_required')
    .eq('tenant_id', tenantId)
    .eq('applies_to', 'appointment')
    .order('display_order');

  if (error) return { success: false, error: error.message };
  return { success: true, data: data ?? [] };
}

// ── reschedule_appointment ──────────────────────────────────────────────────

export async function handleRescheduleAppointment(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
  _sessionInfo: { customerId: string | null; customerName: string | null; customerPhone: string | null; chatSessionId: string; userId: string | null },
): Promise<ToolResult> {
  const appointmentId = input.appointment_id as string;
  const newStartTime = input.new_start_time as string;

  if (!appointmentId) return { success: false, error: 'appointment_id is required' };
  if (!newStartTime) return { success: false, error: 'new_start_time is required' };

  // 1. Fetch the existing appointment
  const { data: existing, error: fetchErr } = await supabase
    .from('appointments')
    .select('id, customer_id, tenant_id, service_id, staff_id, location_id, status, start_time, end_time, services(duration_minutes, name, price)')
    .eq('id', appointmentId)
    .in('status', ['pending', 'confirmed'])
    .single();

  if (fetchErr || !existing) {
    return { success: false, error: 'Appointment not found or cannot be rescheduled (already cancelled/completed).' };
  }

  const appt = existing as unknown as {
    id: string; customer_id: string; tenant_id: string;
    service_id: string; staff_id: string | null; location_id: string | null;
    status: string; start_time: string; end_time: string;
    services: { duration_minutes: number; name: string; price: number } | null;
  };

  const durationMinutes = appt.services?.duration_minutes ?? 30;
  const effectiveTenantId = appt.tenant_id || tenantId;

  // 2. Parse the new start time (handle timezone like booking handler)
  let newStart: Date;
  const hasTimezoneInfo = /Z$|[+-]\d{2}:\d{2}$/.test(newStartTime);
  if (hasTimezoneInfo) {
    newStart = new Date(newStartTime);
  } else {
    const timezone = await getTenantTimezone(supabase, effectiveTenantId);
    const [datePart, timePart] = newStartTime.split('T');
    if (datePart && timePart) {
      newStart = localTimeToUTC(datePart, timePart.slice(0, 5), timezone);
    } else {
      newStart = new Date(newStartTime);
    }
  }
  const newEnd = new Date(newStart.getTime() + durationMinutes * 60000);

  // 3. Check for conflicts at the new time (same staff)
  if (appt.staff_id) {
    const { data: conflicts } = await supabase
      .from('appointments')
      .select('id, start_time, end_time')
      .eq('staff_id', appt.staff_id)
      .neq('id', appointmentId)
      .in('status', ['pending', 'confirmed'])
      .lt('start_time', newEnd.toISOString())
      .gt('end_time', newStart.toISOString());

    if (conflicts && conflicts.length > 0) {
      return {
        success: false,
        error: `The new time slot conflicts with an existing appointment. Please choose a different time.`,
      };
    }
  }

  // 4. Atomically update the appointment
  const { data: updated, error: updateErr } = await supabase
    .from('appointments')
    .update({
      start_time: newStart.toISOString(),
      end_time: newEnd.toISOString(),
    } as never)
    .eq('id', appointmentId)
    .select('id, start_time, end_time, status, services(name, price), staff(name), tenant_locations(name, address), tenants(name)')
    .single();

  if (updateErr) return { success: false, error: updateErr.message };

  return {
    success: true,
    data: {
      message: 'Appointment rescheduled successfully.',
      appointment: updated,
      old_start_time: appt.start_time,
      new_start_time: newStart.toISOString(),
      new_end_time: newEnd.toISOString(),
    },
  };
}

// ── get_directions ──────────────────────────────────────────────────────────

export async function handleGetDirections(
  supabase: AdminClient,
  tenantId: string,
  input: Record<string, unknown>,
  userLocation?: { latitude: number; longitude: number } | null,
): Promise<ToolResult> {
  const locationId = input.location_id as string | undefined;
  const destinationAddress = input.destination_address as string | undefined;
  const originLat = (input.origin_latitude as number) ?? userLocation?.latitude;
  const originLng = (input.origin_longitude as number) ?? userLocation?.longitude;

  let destLat: number | null = null;
  let destLng: number | null = null;
  let destAddress: string | null = destinationAddress ?? null;
  let destName: string | null = null;

  // Resolve destination from location_id
  if (locationId) {
    const { data: loc } = await supabase
      .from('tenant_locations')
      .select('name, address, latitude, longitude')
      .eq('id', locationId)
      .single();

    if (loc) {
      const location = loc as { name: string; address: string; latitude: number | null; longitude: number | null };
      destLat = location.latitude;
      destLng = location.longitude;
      destAddress = location.address;
      destName = location.name;
    }
  }

  // If no location_id, try to find by tenant_id
  if (!destAddress && tenantId) {
    const { data: loc } = await supabase
      .from('tenant_locations')
      .select('name, address, latitude, longitude')
      .eq('tenant_id', tenantId)
      .limit(1)
      .single();

    if (loc) {
      const location = loc as { name: string; address: string; latitude: number | null; longitude: number | null };
      destLat = location.latitude;
      destLng = location.longitude;
      destAddress = location.address;
      destName = location.name;
    }
  }

  if (!destAddress && !destLat) {
    return { success: false, error: 'Could not determine destination. Please provide a location_id or destination_address.' };
  }

  // Build Google Maps directions URL
  const destination = destAddress
    ? encodeURIComponent(destAddress)
    : `${destLat},${destLng}`;
  const origin = originLat && originLng
    ? `&origin=${originLat},${originLng}`
    : '';

  const mapsUrl = `https://www.google.com/maps/dir/?api=1${origin}&destination=${destination}&travelmode=driving`;

  // Calculate straight-line distance if we have both coordinates
  let distanceInfo: { distance_km: number; distance_mi: number; estimated_drive_minutes: number } | null = null;
  if (originLat && originLng && destLat && destLng) {
    const distKm = haversineKm(originLat, originLng, destLat, destLng);
    const distMi = distKm * 0.621371;
    // Rough estimate: average 30 km/h in urban areas
    const estMinutes = Math.round((distKm / 30) * 60);
    distanceInfo = {
      distance_km: Math.round(distKm * 10) / 10,
      distance_mi: Math.round(distMi * 10) / 10,
      estimated_drive_minutes: Math.max(estMinutes, 1),
    };
  }

  return {
    success: true,
    data: {
      destination_name: destName,
      destination_address: destAddress,
      directions_url: mapsUrl,
      distance: distanceInfo,
    },
  };
}

// ── Tool dispatcher ─────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: AdminClient,
  tenantId: string,
  sessionInfo: { customerId: string | null; customerName: string | null; customerPhone: string | null; chatSessionId: string; userId: string | null },
  userLocation?: { latitude: number; longitude: number } | null,
): Promise<ToolResult> {
  try {
    switch (toolName) {
      case 'find_businesses':
        return await handleFindBusinesses(supabase, tenantId, toolInput);
      case 'search_services':
      case 'get_services':
        return await handleGetServices(supabase, tenantId, toolInput);
      case 'get_service_details':
        return await handleGetServiceDetails(supabase, tenantId, toolInput);
      case 'search_tenants':
      case 'get_staff':
        return await handleGetStaff(supabase, tenantId, toolInput);
      case 'check_availability':
        return await handleCheckAvailability(supabase, tenantId, toolInput, sessionInfo);
      case 'create_booking':
        return await handleBookAppointment(supabase, tenantId, toolInput, sessionInfo);
      case 'cancel_appointment':
        return await handleCancelAppointment(supabase, tenantId, toolInput, sessionInfo);
      case 'get_customer_appointments':
      case 'get_booking_details':
        return await handleGetBookingDetails(supabase, tenantId, toolInput, sessionInfo);
      case 'get_packages':
        return await handleGetPackages(supabase, tenantId, toolInput);
      case 'get_locations':
        return await handleGetLocations(supabase, tenantId, toolInput);
      case 'get_loyalty_info':
        return await handleGetLoyaltyInfo(supabase, tenantId, toolInput);
      case 'apply_coupon':
        return await handleApplyCoupon(supabase, tenantId, toolInput);
      case 'redeem_loyalty_points':
        return await handleRedeemLoyaltyPoints(supabase, tenantId, toolInput);
      case 'get_inventory':
        return await handleGetInventory(supabase, tenantId, toolInput);
      case 'get_custom_fields':
        return await handleGetCustomFields(supabase, tenantId, toolInput);
      case 'reschedule_appointment':
        return await handleRescheduleAppointment(supabase, tenantId, toolInput, sessionInfo);
      case 'get_directions':
        return await handleGetDirections(supabase, tenantId, toolInput, userLocation);
      default:
        return { success: false, error: `Unknown tool: ${toolName}` };
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Tool execution failed';
    console.error(`[chat] Tool "${toolName}" threw an error:`, err instanceof Error ? err.stack : err);
    return { success: false, error: `Tool "${toolName}" encountered an error: ${errorMessage}. Please try again.` };
  }
}
