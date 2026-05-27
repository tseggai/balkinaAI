/**
 * POST /api/booking/businesses
 * REST endpoint for business discovery — bypasses OpenAI entirely.
 * Used for category browsing and direct business search.
 *
 * Body: { categoryId?, query?, serviceType?, latitude?, longitude?, radiusKm?, offset?, limit? }
 * Returns: { businesses: [...], total_count, has_more }
 */
import { createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function estimateDriveMinutes(km: number): number {
  if (km < 1) return 1;
  if (km < 5) return Math.round(km * 3);
  return Math.round(km * 2);
}

export async function POST(request: Request) {
  const t0 = Date.now();

  try {
    const body = await request.json();
    const {
      categoryId,
      query,
      serviceType,
      latitude,
      longitude,
      radiusKm = 200,
      offset = 0,
      limit = 8,
    } = body as {
      categoryId?: string;
      query?: string;
      serviceType?: string;
      latitude?: number;
      longitude?: number;
      radiusKm?: number;
      offset?: number;
      limit?: number;
    };

    const supabase = createAdminClient();

    // ── Category path (fastest — direct DB filter) ──────────────────────
    if (categoryId) {
      // Find tenants linked to this category via junction table
      const { data: linkedTenants } = await supabase
        .from('tenant_category_links')
        .select('tenant_id')
        .eq('category_id', categoryId);
      const linkedIds = ((linkedTenants ?? []) as { tenant_id: string }[]).map((t) => t.tenant_id);

      if (linkedIds.length === 0) {
        return Response.json({ businesses: [], total_count: 0, has_more: false }, { headers: CORS_HEADERS });
      }

      const { data: tenants, error } = await supabase
        .from('tenants')
        .select('id, name, logo_url, avg_rating, review_count, description')
        .eq('status', 'active')
        .in('id', linkedIds);

      if (error) {
        return Response.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
      }

      // Get category name for display
      const { data: catRow } = await supabase.from('categories').select('name').eq('id', categoryId).single();
      const catName = (catRow as { name: string } | null)?.name ?? null;

      const businesses = (tenants ?? []).map((t: { id: string; name: string; logo_url: string | null; avg_rating: number | null; review_count: number | null; description: string | null }) => {
        return { id: t.id, name: t.name, image_url: t.logo_url ?? undefined, category: catName, avg_rating: t.avg_rating ?? undefined, review_count: t.review_count ?? 0, description: t.description ?? undefined };
      });

      const bizIds = businesses.map((b) => b.id);

      // Fetch subcategories for businesses
      const subcatMap = new Map<string, string>();
      if (bizIds.length > 0) {
        const { data: subcatRows } = await supabase
          .from('tenant_category_links')
          .select('tenant_id, categories!inner(name, parent_id)')
          .in('tenant_id', bizIds)
          .not('categories.parent_id', 'is', null);
        for (const row of (subcatRows ?? []) as { tenant_id: string; categories: { name: string; parent_id: string } | { name: string; parent_id: string }[] }[]) {
          const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
          if (cat?.name && !subcatMap.has(row.tenant_id)) {
            subcatMap.set(row.tenant_id, cat.name);
          }
        }
      }

      // Fetch locations, services, and gallery photos in parallel
      const [{ data: locs }, { data: svcs }, { data: galleryRows }] = bizIds.length > 0
        ? await Promise.all([
            supabase.from('tenant_locations').select('id, tenant_id, name, address, latitude, longitude, currency').in('tenant_id', bizIds),
            supabase.from('services').select('tenant_id, id, name, price, duration_minutes, deposit_enabled, deposit_amount, deposit_type, image_url, pricing_type').in('tenant_id', bizIds).eq('visibility', 'public'),
            supabase.from('location_gallery').select('tenant_id, id, image_url, caption').in('tenant_id', bizIds).order('sort_order', { ascending: true }).limit(50),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }];

      // Build service map per tenant
      const svcMap = new Map<string, { id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; deposit_type: string | null; image_url: string | null; pricing_type: string }[]>();
      for (const svc of (svcs ?? []) as { tenant_id: string; id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; deposit_type: string | null; image_url: string | null; pricing_type: string | null }[]) {
        const existing = svcMap.get(svc.tenant_id) ?? [];
        existing.push({ id: svc.id, name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, deposit_enabled: svc.deposit_enabled, deposit_amount: svc.deposit_amount, deposit_type: svc.deposit_type, image_url: svc.image_url, pricing_type: svc.pricing_type ?? 'per_service' });
        svcMap.set(svc.tenant_id, existing);
      }

      // Build location map + find closest per tenant
      const locMap = new Map<string, { locationId: string; lat: number; lng: number; dist: number; currency: string }>();
      for (const loc of (locs ?? []) as { id: string; tenant_id: string; latitude: number | null; longitude: number | null; currency?: string }[]) {
        if (!locMap.has(loc.tenant_id)) {
          locMap.set(loc.tenant_id, { locationId: loc.id, lat: loc.latitude ?? 0, lng: loc.longitude ?? 0, dist: 9999, currency: loc.currency ?? 'USD' });
        }
        if (latitude && longitude && loc.latitude && loc.longitude) {
          const dist = haversineKm(latitude, longitude, loc.latitude, loc.longitude);
          const existing = locMap.get(loc.tenant_id);
          if (!existing || dist < existing.dist) {
            locMap.set(loc.tenant_id, { locationId: loc.id, lat: loc.latitude, lng: loc.longitude, dist, currency: loc.currency ?? 'USD' });
          }
        }
      }

      // Build gallery map per tenant (max 5 per business for discovery)
      const galleryMap = new Map<string, { id: string; image_url: string; caption: string | null }[]>();
      for (const g of (galleryRows ?? []) as { tenant_id: string; id: string; image_url: string; caption: string | null }[]) {
        const existing = galleryMap.get(g.tenant_id) ?? [];
        if (existing.length < 5) existing.push({ id: g.id, image_url: g.image_url, caption: g.caption });
        galleryMap.set(g.tenant_id, existing);
      }

      // Enrich businesses with services, distance, closest_location_id, gallery
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let enriched: any[] = businesses.map((b) => {
        const closest = locMap.get(b.id);
        const distKm = closest && closest.dist < 9999 ? Math.round(closest.dist * 10) / 10 : undefined;
        return {
          ...b,
          subcategory: subcatMap.get(b.id) ?? undefined,
          currency: closest?.currency ?? 'USD',
          all_services: svcMap.get(b.id) ?? [],
          gallery_photos: galleryMap.get(b.id) ?? [],
          closest_location_id: closest?.locationId,
          distance_km: distKm,
          distance_mi: distKm !== undefined ? Math.round(distKm * 0.621371 * 10) / 10 : undefined,
          estimated_drive_minutes: distKm !== undefined ? estimateDriveMinutes(distKm) : undefined,
        };
      });

      // Sort by distance if user has location — include tenants without coords at the end
      if (latitude && longitude) {
        const withDist = enriched.filter((b) => b.distance_km !== undefined && b.distance_km <= radiusKm);
        const noDist = enriched.filter((b) => b.distance_km === undefined);
        enriched = [
          ...withDist.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999)),
          ...noDist,
        ];
      }

      const totalCount = enriched.length;
      const paged = enriched.slice(offset, offset + limit);
      const hasMore = offset + limit < totalCount;

      console.log(`[businesses REST] ⏱ category path: ${Date.now() - t0}ms — ${paged.length} businesses (total: ${totalCount})`);

      return Response.json({
        businesses: paged,
        total_count: totalCount,
        offset,
        limit,
        has_more: hasMore,
      }, { headers: CORS_HEADERS });
    }

    // ── Query/service type path ─────────────────────────────────────────
    if (query || serviceType) {
      const searchTerm = (serviceType || query || '').trim();

      // Find tenants matching by name or service
      const { data: byName } = await supabase
        .from('tenants')
        .select('id, name, logo_url, avg_rating, review_count, description, categories(name)')
        .eq('status', 'active')
        .ilike('name', `%${searchTerm}%`)
        .limit(limit);

      const { data: bySvc } = await supabase
        .from('services')
        .select('tenant_id')
        .ilike('name', `%${searchTerm}%`)
        .eq('visibility', 'public');

      const svcTenantIds = new Set((bySvc ?? []).map((s: { tenant_id: string }) => s.tenant_id));
      const nameIds = new Set((byName ?? []).map((t: { id: string }) => t.id));
      const allIds = [...new Set([...nameIds, ...svcTenantIds])];

      // Fetch full tenant data for service matches not in name results
      const missingIds = allIds.filter((id) => !nameIds.has(id));
      let allTenants = (byName ?? []) as { id: string; name: string; logo_url: string | null; avg_rating: number | null; review_count: number | null; description: string | null; categories: { name: string } | { name: string }[] | null }[];

      if (missingIds.length > 0) {
        const { data: extra } = await supabase
          .from('tenants')
          .select('id, name, logo_url, avg_rating, review_count, description, categories(name)')
          .eq('status', 'active')
          .in('id', missingIds);
        if (extra) allTenants = [...allTenants, ...(extra as typeof allTenants)];
      }

      // Same enrichment as category path
      const bizIds = allTenants.map((t) => t.id);
      const [{ data: locs }, { data: svcs }, { data: galleryRows2 }] = bizIds.length > 0
        ? await Promise.all([
            supabase.from('tenant_locations').select('id, tenant_id, latitude, longitude, currency').in('tenant_id', bizIds),
            supabase.from('services').select('tenant_id, id, name, price, duration_minutes, deposit_enabled, deposit_amount, deposit_type, image_url, pricing_type').in('tenant_id', bizIds).eq('visibility', 'public'),
            supabase.from('location_gallery').select('tenant_id, id, image_url, caption').in('tenant_id', bizIds).order('sort_order', { ascending: true }).limit(50),
          ])
        : [{ data: [] }, { data: [] }, { data: [] }];

      const svcMap = new Map<string, unknown[]>();
      for (const svc of (svcs ?? []) as { tenant_id: string; id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount: number | null; deposit_type: string | null; image_url: string | null; pricing_type: string | null }[]) {
        const existing = svcMap.get(svc.tenant_id) ?? [];
        existing.push({ id: svc.id, name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, deposit_enabled: svc.deposit_enabled, deposit_amount: svc.deposit_amount, deposit_type: svc.deposit_type, image_url: svc.image_url, pricing_type: svc.pricing_type ?? 'per_service' });
        svcMap.set(svc.tenant_id, existing);
      }

      const locMap = new Map<string, { locationId: string; dist: number; currency: string }>();
      for (const loc of (locs ?? []) as { id: string; tenant_id: string; latitude: number | null; longitude: number | null; currency?: string }[]) {
        if (!locMap.has(loc.tenant_id)) {
          locMap.set(loc.tenant_id, { locationId: loc.id, dist: 9999, currency: loc.currency ?? 'USD' });
        }
        if (latitude && longitude && loc.latitude && loc.longitude) {
          const dist = haversineKm(latitude, longitude, loc.latitude, loc.longitude);
          const existing = locMap.get(loc.tenant_id);
          if (!existing || dist < existing.dist) {
            locMap.set(loc.tenant_id, { locationId: loc.id, dist, currency: loc.currency ?? 'USD' });
          }
        }
      }

      // Build gallery map for query path
      const galleryMap2 = new Map<string, { id: string; image_url: string; caption: string | null }[]>();
      for (const g of (galleryRows2 ?? []) as { tenant_id: string; id: string; image_url: string; caption: string | null }[]) {
        const existing = galleryMap2.get(g.tenant_id) ?? [];
        if (existing.length < 5) existing.push({ id: g.id, image_url: g.image_url, caption: g.caption });
        galleryMap2.set(g.tenant_id, existing);
      }

      // Fetch subcategories for query path businesses
      const subcatMap2 = new Map<string, string>();
      if (bizIds.length > 0) {
        const { data: subcatRows2 } = await supabase
          .from('tenant_category_links')
          .select('tenant_id, categories!inner(name, parent_id)')
          .in('tenant_id', bizIds)
          .not('categories.parent_id', 'is', null);
        for (const row of (subcatRows2 ?? []) as { tenant_id: string; categories: { name: string; parent_id: string } | { name: string; parent_id: string }[] }[]) {
          const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
          if (cat?.name && !subcatMap2.has(row.tenant_id)) {
            subcatMap2.set(row.tenant_id, cat.name);
          }
        }
      }

      let results = allTenants.map((t) => {
        const cat = Array.isArray(t.categories) ? t.categories[0]?.name ?? null : t.categories?.name ?? null;
        const closest = locMap.get(t.id);
        const distKm = closest && closest.dist < 9999 ? Math.round(closest.dist * 10) / 10 : undefined;
        return {
          id: t.id,
          name: t.name,
          image_url: t.logo_url ?? undefined,
          category: cat,
          subcategory: subcatMap2.get(t.id) ?? undefined,
          currency: locMap.get(t.id)?.currency ?? 'USD',
          description: t.description ?? undefined,
          avg_rating: t.avg_rating ?? undefined,
          review_count: t.review_count ?? 0,
          all_services: svcMap.get(t.id) ?? [],
          gallery_photos: galleryMap2.get(t.id) ?? [],
          closest_location_id: closest?.locationId,
          distance_km: distKm,
          distance_mi: distKm !== undefined ? Math.round(distKm * 0.621371 * 10) / 10 : undefined,
          estimated_drive_minutes: distKm !== undefined ? estimateDriveMinutes(distKm) : undefined,
        };
      });

      if (latitude && longitude) {
        const withDist = results.filter((b) => b.distance_km !== undefined && b.distance_km <= radiusKm);
        const noDist = results.filter((b) => b.distance_km === undefined);
        results = [
          ...withDist.sort((a, b) => (a.distance_km ?? 9999) - (b.distance_km ?? 9999)),
          ...noDist,
        ];
      }

      const totalCount = results.length;
      const paged = results.slice(offset, offset + limit);

      console.log(`[businesses REST] ⏱ query path: ${Date.now() - t0}ms — ${paged.length} businesses (total: ${totalCount})`);

      return Response.json({
        businesses: paged,
        total_count: totalCount,
        offset,
        limit,
        has_more: offset + limit < totalCount,
      }, { headers: CORS_HEADERS });
    }

    return Response.json({ error: 'Provide categoryId, query, or serviceType' }, { status: 400, headers: CORS_HEADERS });
  } catch (err) {
    console.error('[businesses REST] error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
