import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? '';
const STATE_SECRET = process.env.NEXTAUTH_SECRET ?? process.env.CRON_SECRET ?? 'balkina-state-secret';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const staffId = searchParams.get('staffId');

  if (!staffId) return NextResponse.json({ error: 'staffId required' }, { status: 400 });

  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL('/auth/login', request.url));

  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  if (!tenant) return NextResponse.json({ error: 'Not a tenant' }, { status: 403 });

  const tenantId = (tenant as { id: string }).id;

  const statePayload = JSON.stringify({ staffId, tenantId, ts: Date.now() });
  const hmac = crypto.createHmac('sha256', STATE_SECRET).update(statePayload).digest('hex');
  const state = Buffer.from(`${statePayload}|${hmac}`).toString('base64url');

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email',
    access_type: 'offline',
    prompt: 'consent',
    state,
  });

  return NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`);
}
