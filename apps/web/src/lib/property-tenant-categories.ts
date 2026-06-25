import type { SupabaseClient } from '@supabase/supabase-js';

export interface PropertyTenantWithCategory {
  id: string;
  name: string;
  /** Parent category name ("Health & Wellness"), or null when untagged. */
  category: string | null;
}

/**
 * The property's linked businesses, each resolved to its parent category
 * (mirrors the storefront's category derivation in /api/properties). Used to
 * power category-targeted messaging. Service-role client expected.
 */
export async function getPropertyTenantsWithCategory(
  admin: SupabaseClient,
  propertyId: string,
): Promise<PropertyTenantWithCategory[]> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const { data: links } = await (admin as any)
    .from('property_tenants')
    .select('tenant_id, tenants(id, name)')
    .eq('property_id', propertyId);

  const tenants = ((links ?? []) as { tenant_id: string; tenants: { id: string; name: string } | null }[])
    .filter((l) => l.tenants)
    .map((l) => ({ id: l.tenants!.id, name: l.tenants!.name }));

  const ids = tenants.map((t) => t.id);
  if (ids.length === 0) return [];

  const { data: catRows } = await (admin as any)
    .from('tenant_category_links')
    .select('tenant_id, categories!inner(id, name, parent_id)')
    .in('tenant_id', ids);

  type CatRow = { tenant_id: string; categories: { id: string; name: string; parent_id: string | null } | { id: string; name: string; parent_id: string | null }[] };
  const rows = (catRows ?? []) as CatRow[];

  // Resolve parent names for child links so we can report the parent category.
  const parentIds = new Set<string>();
  for (const row of rows) {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (cat?.parent_id) parentIds.add(cat.parent_id);
  }
  const parentNameById = new Map<string, string>();
  if (parentIds.size > 0) {
    const { data: parents } = await (admin as any)
      .from('categories')
      .select('id, name')
      .in('id', Array.from(parentIds));
    for (const p of (parents ?? []) as { id: string; name: string }[]) parentNameById.set(p.id, p.name);
  }

  const categoryByTenant = new Map<string, string>();
  for (const row of rows) {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (!cat?.name) continue;
    if (categoryByTenant.has(row.tenant_id)) continue;
    categoryByTenant.set(row.tenant_id, cat.parent_id ? (parentNameById.get(cat.parent_id) ?? cat.name) : cat.name);
  }

  return tenants.map((t) => ({ ...t, category: categoryByTenant.get(t.id) ?? null }));
}
