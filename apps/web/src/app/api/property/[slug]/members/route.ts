import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { PROPERTY_MEMBER_TYPES, type PropertyMemberType } from '@balkina/shared';

interface PatchBody {
  id?: string;
  status?: 'active' | 'revoked';
  member_type?: string;
  unit?: string | null;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: members } = await ctx.admin
    .from('property_members')
    .select('*')
    .eq('property_id', ctx.propertyId)
    .order('created_at', { ascending: false });

  const list = (members ?? []) as { customer_id: string }[];

  // Attach customer display info in one batch.
  const ids = Array.from(new Set(list.map((m) => m.customer_id)));
  const byId = new Map<string, { name: string | null; email: string | null; phone: string | null }>();
  if (ids.length > 0) {
    const { data: customers } = await ctx.admin
      .from('customers')
      .select('id, display_name, first_name, last_name, email, phone')
      .in('id', ids);
    for (const c of (customers ?? []) as {
      id: string; display_name: string | null; first_name: string | null; last_name: string | null; email: string | null; phone: string | null;
    }[]) {
      const name = c.display_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || null;
      byId.set(c.id, { name, email: c.email, phone: c.phone });
    }
  }

  return NextResponse.json({
    data: list.map((m) => ({ ...m, customer: byId.get(m.customer_id) ?? { name: null, email: null, phone: null } })),
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (body.status) patch.status = body.status;
  if (body.member_type) {
    if (!PROPERTY_MEMBER_TYPES.includes(body.member_type as PropertyMemberType)) {
      return NextResponse.json({ error: 'Invalid member type' }, { status: 400 });
    }
    patch.member_type = body.member_type;
  }
  if (body.unit !== undefined) patch.unit = body.unit?.trim() || null;

  const { data, error } = await ctx.admin
    .from('property_members')
    .update(patch)
    .eq('id', body.id)
    .eq('property_id', ctx.propertyId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
