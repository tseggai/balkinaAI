import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getPropertyAdmin } from '@/lib/property-admin';
import { sendPropertyInviteEmail } from '@balkina/notifications';

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

/**
 * Add-or-invite a business by email (single "+ Add Tenant" action):
 *  - If a tenant already exists with that email → link them to the property now.
 *  - Otherwise → create an invite and email a property-branded signup link.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { email?: string };
  const email = (body.email || '').trim().toLowerCase();
  if (!email) return NextResponse.json({ error: 'Email is required' }, { status: 400 });

  // 1. Does a tenant already exist with this email? If so, link immediately.
  const { data: existingTenant } = await ctx.admin
    .from('tenants')
    .select('id, name')
    .ilike('email', email)
    .maybeSingle();

  if (existingTenant) {
    const tenant = existingTenant as { id: string; name: string };
    const { data: link } = await ctx.admin
      .from('property_tenants')
      .select('id')
      .eq('property_id', ctx.propertyId)
      .eq('tenant_id', tenant.id)
      .maybeSingle();
    if (link) {
      return NextResponse.json({ status: 'already_linked', message: `${tenant.name} is already in this property.` });
    }
    const { error: linkErr } = await ctx.admin
      .from('property_tenants')
      .insert({ property_id: ctx.propertyId, tenant_id: tenant.id, featured: false } as never);
    if (linkErr) return NextResponse.json({ error: linkErr.message }, { status: 500 });
    return NextResponse.json({ status: 'added', message: `${tenant.name} added to your property.` });
  }

  // 2. No existing tenant — create an invite and email a signup link.
  const inviteCode = crypto.randomBytes(6).toString('hex');
  const { data: inviteData, error: inviteErr } = await ctx.admin
    .from('property_invites')
    .insert({
      property_id: ctx.propertyId,
      invite_code: inviteCode,
      email,
      created_by: ctx.userId,
    } as never)
    .select('id, invite_code')
    .single();
  if (inviteErr || !inviteData) {
    return NextResponse.json({ error: inviteErr?.message ?? 'Failed to create invite' }, { status: 500 });
  }

  // Property details for branding the email.
  const { data: prop } = await ctx.admin
    .from('properties')
    .select('name, email')
    .eq('id', ctx.propertyId)
    .single();
  const property = (prop as { name: string; email: string | null } | null) ?? { name: 'Balkina AI', email: null };

  const marketingOrigin = process.env.NEXT_PUBLIC_MARKETING_URL || 'https://balkina.ai';
  const signupUrl = `${marketingOrigin}/join?property_invite=${inviteCode}`;

  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendPropertyInviteEmail({
      email,
      propertyName: property.name,
      propertyEmail: property.email,
      signupUrl,
    });
    emailSent = true;
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    status: 'invited',
    email_sent: emailSent,
    email_error: emailError,
    signupUrl,
    message: emailSent
      ? `Invite sent to ${email}.`
      : `Invite created, but the email failed to send. Share this link: ${signupUrl}`,
  }, { status: 201 });
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
