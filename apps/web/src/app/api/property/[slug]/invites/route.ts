import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

async function getPropertyAdmin(slug: string) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: admin } = await supabase
    .from('property_admins')
    .select('property_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!admin) return null;
  const { data: prop } = await supabase
    .from('properties')
    .select('id, slug')
    .eq('id', (admin as { property_id: string }).property_id)
    .single();
  if (!prop || (prop as { slug: string }).slug !== slug) return null;
  return { propertyId: (prop as { id: string }).id, userId: user.id, role: (admin as { role: string }).role, supabase };
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await ctx.supabase
    .from('property_invites')
    .select('id, invite_code, email, status, created_at, expires_at')
    .eq('property_id', ctx.propertyId)
    .order('created_at', { ascending: false });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { email?: string };
  const inviteCode = crypto.randomBytes(6).toString('hex');

  const { data, error } = await ctx.supabase
    .from('property_invites')
    .insert({
      property_id: ctx.propertyId,
      invite_code: inviteCode,
      email: body.email || null,
      created_by: ctx.userId,
    } as never)
    .select('id, invite_code')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const origin = request.headers.get('origin') || 'https://app.balkina.ai';
  const inviteUrl = `${origin}/auth/register?property_invite=${inviteCode}`;

  return NextResponse.json({ data, inviteUrl }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await ctx.supabase.from('property_invites').delete().eq('id', id).eq('property_id', ctx.propertyId);
  return NextResponse.json({ success: true });
}
