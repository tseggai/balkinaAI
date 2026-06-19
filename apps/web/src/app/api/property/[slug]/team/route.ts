import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getPropertyAdmin(slug: string) {
  // Identify the signed-in user from their session…
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // …but resolve the property + verify membership with the service-role client,
  // so RLS scoping / multiple admin rows can't make this silently return null.
  const adminClient = createAdminClient();
  const { data: prop } = await adminClient
    .from('properties')
    .select('id, slug')
    .eq('slug', slug)
    .maybeSingle();
  if (!prop) return null;

  const { data: membership } = await adminClient
    .from('property_admins')
    .select('role')
    .eq('property_id', (prop as { id: string }).id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership || (membership as { role: string }).role !== 'admin') return null;

  return { propertyId: (prop as { id: string }).id, userId: user.id, supabase };
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const adminClient = createAdminClient();
  // Read the full team with the service-role client (caller is already verified
  // as an admin above) so RLS scoping never hides other members.
  const { data: admins } = await adminClient
    .from('property_admins')
    .select('id, user_id, role, created_at')
    .eq('property_id', ctx.propertyId)
    .order('created_at');

  const userIds = ((admins ?? []) as { user_id: string }[]).map((a) => a.user_id);
  // Resolve each admin's email directly (listUsers() is paginated and can miss
  // members, which made some — including the current admin — show as Unknown).
  const userMap = new Map<string, string>();
  await Promise.all(userIds.map(async (uid) => {
    try {
      const { data } = await adminClient.auth.admin.getUserById(uid);
      if (data?.user?.email) userMap.set(uid, data.user.email);
    } catch { /* ignore */ }
  }));

  const team = ((admins ?? []) as { id: string; user_id: string; role: string; created_at: string }[]).map((a) => ({
    id: a.id,
    user_id: a.user_id,
    email: userMap.get(a.user_id) ?? 'Unknown',
    role: a.role,
    is_self: a.user_id === ctx.userId,
    created_at: a.created_at,
  }));

  return NextResponse.json({ data: team });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { email: string; role?: string };
  if (!body.email) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const adminClient = createAdminClient();

  // Find or create user
  const { data: existingUsers } = await adminClient.auth.admin.listUsers();
  const existing = (existingUsers as { users: { id: string; email?: string }[] })?.users?.find(
    (u) => u.email?.toLowerCase() === body.email.toLowerCase()
  );

  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const { data: newUser, error } = await adminClient.auth.admin.createUser({
      email: body.email,
      email_confirm: true,
      user_metadata: { source: 'property_admin_invite' },
    });
    if (error || !newUser.user) return NextResponse.json({ error: error?.message ?? 'Failed to create user' }, { status: 500 });
    userId = newUser.user.id;
  }

  const { error: insertErr } = await ctx.supabase
    .from('property_admins')
    .insert({
      property_id: ctx.propertyId,
      user_id: userId,
      role: body.role || 'manager',
    } as never);

  if (insertErr) {
    if (insertErr.message.includes('duplicate')) return NextResponse.json({ error: 'User is already a team member' }, { status: 409 });
    return NextResponse.json({ error: insertErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true }, { status: 201 });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  // Don't allow removing yourself
  const { data: target } = await ctx.supabase.from('property_admins').select('user_id').eq('id', id).single();
  if (target && (target as { user_id: string }).user_id === ctx.userId) {
    return NextResponse.json({ error: 'Cannot remove yourself' }, { status: 400 });
  }

  await ctx.supabase.from('property_admins').delete().eq('id', id).eq('property_id', ctx.propertyId);
  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { id: string; role: string };
  if (!body.id || !body.role) return NextResponse.json({ error: 'id and role required' }, { status: 400 });

  await ctx.supabase.from('property_admins').update({ role: body.role } as never).eq('id', body.id).eq('property_id', ctx.propertyId);
  return NextResponse.json({ success: true });
}
