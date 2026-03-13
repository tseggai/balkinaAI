import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

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

  // Find customer by user_id
  const { data: customer } = await admin
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 });
  }

  const body = await request.json() as {
    notify_sms?: boolean;
    notify_push?: boolean;
    notify_email?: boolean;
  };

  const updateFields: Record<string, boolean> = {};
  if (typeof body.notify_sms === 'boolean') updateFields.notify_sms = body.notify_sms;
  if (typeof body.notify_push === 'boolean') updateFields.notify_push = body.notify_push;
  if (typeof body.notify_email === 'boolean') updateFields.notify_email = body.notify_email;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 });
  }

  const { error } = await admin
    .from('customers')
    .update(updateFields as never)
    .eq('id', (customer as { id: string }).id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
