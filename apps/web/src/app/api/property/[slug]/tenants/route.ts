import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { syncPropertySeats } from '@/lib/property-billing';

/**
 * POST /api/property/[slug]/tenants  { tenantId }
 *
 * Links an existing Balkina business to this property (used by the
 * discover-tenants flow). Email-based onboarding stays in /invites.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { tenantId?: string };
  const tenantId = (body.tenantId || '').trim();
  if (!tenantId) return NextResponse.json({ error: 'tenantId is required' }, { status: 400 });

  const { data: tenant } = await ctx.admin
    .from('tenants')
    .select('id, name, status')
    .eq('id', tenantId)
    .maybeSingle();
  if (!tenant) return NextResponse.json({ error: 'Business not found' }, { status: 404 });
  const t = tenant as { id: string; name: string; status: string };

  const { data: existing } = await ctx.admin
    .from('property_tenants')
    .select('id')
    .eq('property_id', ctx.propertyId)
    .eq('tenant_id', t.id)
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ status: 'already_linked', message: `${t.name} is already in this property.` });
  }

  const { error: linkErr } = await ctx.admin
    .from('property_tenants')
    .insert({ property_id: ctx.propertyId, tenant_id: t.id, featured: false } as never);
  if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });

  await syncPropertySeats(ctx.admin, ctx.propertyId);
  return NextResponse.json({ status: 'added', message: `${t.name} added to your property.` });
}
