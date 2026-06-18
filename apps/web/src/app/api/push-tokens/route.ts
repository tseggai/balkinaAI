import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export async function POST(request: Request) {
  const token = getBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json() as {
    token: string;
    recipientType: 'customer' | 'staff';
    recipientId: string;
    platform?: 'ios' | 'android';
    propertySlug?: string | null;
  };

  if (!body.token || !body.recipientType || !body.recipientId) {
    return NextResponse.json({ error: 'Missing required fields: token, recipientType, recipientId' }, { status: 400 });
  }

  const table = body.recipientType === 'customer' ? 'customer_push_tokens' : 'staff_push_tokens';
  const idColumn = body.recipientType === 'customer' ? 'customer_id' : 'staff_id';

  // Ensure the customer record exists (auto-create from auth user if missing)
  if (body.recipientType === 'customer') {
    const { data: existing } = await admin.from('customers').select('id').eq('id', body.recipientId).maybeSingle();
    if (!existing) {
      await admin.from('customers').insert({
        id: body.recipientId,
        display_name: user.user_metadata?.display_name ?? user.email?.split('@')[0] ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
      } as never);
    }
  }

  const propertySlug = body.propertySlug ?? null;

  // Replace stale tokens for this recipient WITHIN THE SAME APP (property scope),
  // so a customer who uses both the Balkina app and a property app keeps both.
  if (body.recipientType === 'customer') {
    let del = admin.from(table).delete().eq(idColumn, body.recipientId).neq('token', body.token);
    del = propertySlug ? del.eq('property_slug', propertySlug) : del.is('property_slug', null);
    await del;
  } else {
    await admin.from(table).delete().eq(idColumn, body.recipientId).neq('token', body.token);
  }

  // Also remove this token if it was registered under a different recipient
  // (e.g. same device switched accounts)
  await admin.from(table).delete().eq('token', body.token).neq(idColumn, body.recipientId);

  const insertRow: Record<string, unknown> = { [idColumn]: body.recipientId, token: body.token, platform: body.platform ?? null };
  if (body.recipientType === 'customer') insertRow.property_slug = propertySlug;
  const { error } = await admin
    .from(table)
    .upsert(insertRow as never, { onConflict: `${idColumn},token` });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
