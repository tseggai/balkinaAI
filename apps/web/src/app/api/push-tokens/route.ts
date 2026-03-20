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
  };

  if (!body.token || !body.recipientType || !body.recipientId) {
    return NextResponse.json({ error: 'Missing required fields: token, recipientType, recipientId' }, { status: 400 });
  }

  const table = body.recipientType === 'customer' ? 'customer_push_tokens' : 'staff_push_tokens';
  const idColumn = body.recipientType === 'customer' ? 'customer_id' : 'staff_id';

  // Delete old tokens for this recipient, then insert the current one.
  // This prevents stale tokens from accumulating across app reinstalls/rebuilds
  // and wasting Expo push API calls on every notification.
  await admin.from(table).delete().eq(idColumn, body.recipientId).neq('token', body.token);

  // Also remove this token if it was registered under a different recipient
  // (e.g. same device switched accounts)
  await admin.from(table).delete().eq('token', body.token).neq(idColumn, body.recipientId);

  const { error } = await admin
    .from(table)
    .upsert({
      [idColumn]: body.recipientId,
      token: body.token,
      platform: body.platform ?? null,
    } as never, { onConflict: `${idColumn},token` });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
