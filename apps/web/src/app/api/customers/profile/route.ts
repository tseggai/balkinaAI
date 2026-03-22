import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

/** GET /api/customers/profile — fetch authenticated customer's own profile */
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

  const { data: customer, error } = await admin
    .from('customers')
    .select('id, user_id, display_name, first_name, last_name, phone, email, date_of_birth, gender, profile_image_url, notify_sms, notify_push, notify_email')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .single();

  if (error || !customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  return NextResponse.json({ data: customer });
}

/** PATCH /api/customers/profile — update authenticated customer's own profile */
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

  // Find customer by user_id or id
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .or(`id.eq.${user.id},user_id.eq.${user.id}`)
    .single();

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const body = await request.json() as {
    display_name?: string;
    first_name?: string;
    last_name?: string;
    phone?: string;
    date_of_birth?: string | null;
    gender?: string | null;
    profile_image_url?: string | null;
  };

  const allowedStringFields = ['display_name', 'first_name', 'last_name', 'phone'] as const;
  const allowedNullableFields = ['date_of_birth', 'gender', 'profile_image_url'] as const;

  const updateFields: Record<string, string | null> = {};

  for (const field of allowedStringFields) {
    if (typeof body[field] === 'string' && body[field].trim().length > 0) {
      updateFields[field] = body[field].trim();
    }
  }

  for (const field of allowedNullableFields) {
    if (field in body) {
      const val = body[field];
      updateFields[field] = typeof val === 'string' && val.trim().length > 0 ? val.trim() : null;
    }
  }

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  // Also update display_name in auth metadata if changed
  if (updateFields.display_name) {
    await admin.auth.admin.updateUserById(user.id, {
      user_metadata: { ...user.user_metadata, display_name: updateFields.display_name },
    });
  }

  const { error } = await admin
    .from('customers')
    .update(updateFields as never)
    .eq('id', (customer as { id: string }).id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Fetch updated profile to return
  const { data: updated } = await admin
    .from('customers')
    .select('id, user_id, display_name, first_name, last_name, phone, email, date_of_birth, gender, profile_image_url, notify_sms, notify_push, notify_email')
    .eq('id', (customer as { id: string }).id)
    .single();

  return NextResponse.json({ data: updated });
}
