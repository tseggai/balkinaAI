import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as Record<string, unknown> & { tenantIds?: string[] };
  const { tenantIds, ...fields } = body;

  const allowed = ['title', 'blurb', 'description', 'image_url', 'campaign_type', 'starts_at', 'ends_at', 'location', 'is_property_only', 'cta_label', 'cta_url', 'is_active'];
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const k of allowed) if (k in fields) update[k] = (fields as Record<string, unknown>)[k];

  const { error } = await ctx.admin
    .from('property_campaigns')
    .update(update as never)
    .eq('id', id)
    .eq('property_id', ctx.propertyId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Replace tenant links when provided.
  if (Array.isArray(tenantIds)) {
    await ctx.admin.from('campaign_tenants').delete().eq('campaign_id', id);
    if (tenantIds.length > 0) {
      await ctx.admin
        .from('campaign_tenants')
        .insert(tenantIds.map((tid) => ({ campaign_id: id, tenant_id: tid })) as never);
    }
  }

  return NextResponse.json({ status: 'updated' });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await ctx.admin.from('property_campaigns').delete().eq('id', id).eq('property_id', ctx.propertyId);
  return NextResponse.json({ success: true });
}
