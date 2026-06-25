import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
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

// A readable, hard-to-mistype suffix (no 0/O/1/I).
function randomSuffix(len = 4): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function buildCode(slug: string, type: string): string {
  const base = slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const typeTag = type === 'commercial_owner' ? 'RETAIL' : type.toUpperCase();
  return `${base}-${typeTag}-${randomSuffix()}`;
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

  // Generate a unique code (retry on the rare collision).
  let code = buildCode(slug, member_type);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await ctx.admin
      .from('property_member_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!existing) break;
    code = buildCode(slug, member_type);
  }

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
