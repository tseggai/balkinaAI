import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import crypto from 'crypto';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? '';
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI ?? '';
const STATE_SECRET = process.env.NEXTAUTH_SECRET ?? process.env.CRON_SECRET ?? 'balkina-state-secret';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const stateParam = searchParams.get('state');
  const error = searchParams.get('error');

  const dashboardUrl = new URL('/dashboard/staff', request.url);

  if (error || !code || !stateParam) {
    dashboardUrl.searchParams.set('gcal_error', error || 'missing_code');
    return NextResponse.redirect(dashboardUrl);
  }

  let staffId: string;
  let tenantId: string;
  try {
    const decoded = Buffer.from(stateParam, 'base64url').toString();
    const [payload, hmac] = decoded.split('|');
    const expectedHmac = crypto.createHmac('sha256', STATE_SECRET).update(payload ?? '').digest('hex');
    if (hmac !== expectedHmac) throw new Error('Invalid signature');
    const parsed = JSON.parse(payload ?? '{}') as { staffId: string; tenantId: string; ts: number };
    if (Date.now() - parsed.ts > 600000) throw new Error('Expired');
    staffId = parsed.staffId;
    tenantId = parsed.tenantId;
  } catch {
    dashboardUrl.searchParams.set('gcal_error', 'invalid_state');
    return NextResponse.redirect(dashboardUrl);
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: GOOGLE_CLIENT_ID,
      client_secret: GOOGLE_CLIENT_SECRET,
      redirect_uri: GOOGLE_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  if (!tokenRes.ok) {
    dashboardUrl.searchParams.set('gcal_error', 'token_exchange_failed');
    return NextResponse.redirect(dashboardUrl);
  }

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
  };

  if (!tokens.refresh_token) {
    dashboardUrl.searchParams.set('gcal_error', 'no_refresh_token');
    return NextResponse.redirect(dashboardUrl);
  }

  const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const userInfo = await userInfoRes.json() as { email?: string };
  const googleEmail = userInfo.email ?? 'unknown';

  const supabase = createAdminClient();
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from('staff_google_calendar_connections').upsert({
    staff_id: staffId,
    tenant_id: tenantId,
    google_email: googleEmail,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    token_expires_at: expiresAt,
    calendar_id: 'primary',
    is_active: true,
  } as never, { onConflict: 'staff_id' });

  dashboardUrl.searchParams.set('gcal_success', '1');
  return NextResponse.redirect(dashboardUrl);
}
