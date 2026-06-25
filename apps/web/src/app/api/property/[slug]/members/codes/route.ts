import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { generateUniqueMemberCode } from '@/lib/member-code';
import { PROPERTY_MEMBER_TYPES, type PropertyMemberType } from '@balkina/shared';

interface CodeBody {
  member_type?: string;
  unit?: string | null;
  label?: string | null;
  max_redemptions?: number | null;
  expires_at?: string | null;
}

interface PatchBody extends CodeBody {
  id?: string;
  is_active?: boolean;
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await ctx.admin
    .from('property_member_codes')
    .select('*')
    .eq('property_id', ctx.propertyId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as CodeBody;
  const member_type = (body.member_type ?? 'homeowner') as PropertyMemberType;
  if (!PROPERTY_MEMBER_TYPES.includes(member_type)) {
    return NextResponse.json({ error: 'Invalid member type' }, { status: 400 });
  }

  const code = await generateUniqueMemberCode(ctx.admin, slug, member_type);

  const { data, error } = await ctx.admin
    .from('property_member_codes')
    .insert({
      property_id: ctx.propertyId,
      code,
      member_type,
      unit: body.unit?.trim() || null,
      label: body.label?.trim() || null,
      max_redemptions: body.max_redemptions ?? null,
      expires_at: body.expires_at || null,
      created_by: ctx.userId,
    })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as PatchBody;
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const patch: Record<string, unknown> = {};
  if (typeof body.is_active === 'boolean') patch.is_active = body.is_active;
  if (body.label !== undefined) patch.label = body.label?.trim() || null;
  if (body.unit !== undefined) patch.unit = body.unit?.trim() || null;
  if (body.max_redemptions !== undefined) patch.max_redemptions = body.max_redemptions;
  if (body.expires_at !== undefined) patch.expires_at = body.expires_at || null;
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });

  const { data, error } = await ctx.admin
    .from('property_member_codes')
    .update(patch)
    .eq('id', body.id)
    .eq('property_id', ctx.propertyId)
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ data });
}
