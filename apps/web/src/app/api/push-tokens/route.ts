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
