import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** GET /api/staff/profile — fetch authenticated staff member's own profile */
export async function GET(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: staffMember, error } = await admin
    .from('staff')
    .select('id, tenant_id, user_id, name, email, phone, image_url, requires_approval, notify_sms, notify_push')
    .eq('user_id', user.id)
    .single();

  if (error || !staffMember) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
  }

  // Get tenant name
  const sm = staffMember as { id: string; tenant_id: string; name: string; email: string | null; phone: string | null; image_url: string | null; requires_approval: boolean; notify_sms: boolean | null; notify_push: boolean | null };
  const { data: tenant } = await admin
    .from('tenants')
    .select('name')
    .eq('id', sm.tenant_id)
    .single();

  return NextResponse.json({
    data: {
      ...sm,
      tenant_name: (tenant as { name: string } | null)?.name ?? null,
    },
  });
}

/** PATCH /api/staff/profile — update authenticated staff member's own profile */
export async function PATCH(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: staffMember } = await admin
    .from('staff')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!staffMember) {
    return NextResponse.json({ error: 'Staff not found' }, { status: 404 });
  }

  const body = await request.json() as {
    notify_sms?: boolean;
    notify_push?: boolean;
    name?: string;
    phone?: string;
    image_url?: string | null;
  };

  const updateFields: Record<string, boolean | string | null> = {};
  if (typeof body.notify_sms === 'boolean') updateFields.notify_sms = body.notify_sms;
  if (typeof body.notify_push === 'boolean') updateFields.notify_push = body.notify_push;
  if (typeof body.name === 'string' && body.name.trim().length > 0) updateFields.name = body.name.trim();
  if (typeof body.phone === 'string' && body.phone.trim().length > 0) updateFields.phone = body.phone.trim();
  if ('image_url' in body) {
    updateFields.image_url = typeof body.image_url === 'string' && body.image_url.trim().length > 0
      ? body.image_url.trim()
      : null;
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await admin
    .from('staff')
    .update(updateFields as never)
    .eq('id', (staffMember as { id: string }).id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
