import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { cleanBusinessName, guessOwnerName } from '@/lib/claim/names';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const bodySchema = z.object({
  token: z.string().regex(/^[a-f0-9]{48}$/, 'Invalid claim link'),
  email: z.string().trim().email().max(200),
  owner_name: z.string().trim().min(2).max(120).optional(),
  password: z.string().min(8).max(200).optional(),
});

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://app.balkina.ai').replace(/\/$/, '');
}

/**
 * Best-effort welcome email; never blocks the claim. The "open dashboard"
 * button goes through GET /api/claim/login, which mints a fresh single-use
 * sign-in link on click (valid for 24h after claiming). Supabase keeps only
 * one outstanding link per user, so we never pre-generate links for email.
 */
async function sendWelcomeEmail(to: string, businessName: string, openUrl: string, bookingUrl: string | null) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!key || !from) return;
  const forgot = `${appUrl()}/auth/forgot-password`;
  const html = `
    <div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#111;line-height:1.5">
      <h2 style="margin:0 0 12px">${businessName} je sada na Balkini 🎉</h2>
      ${bookingUrl ? `<p>Vaš link za rezervacije: <a href="${bookingUrl}">${bookingUrl}</a></p>` : ''}
      <p><a href="${openUrl}" style="display:inline-block;background:#4f5fc4;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600">Otvori moj panel</a></p>
      <p style="color:#555;font-size:13px">Dugme radi 24h. Kasnije se prijavite sa e-mailom ${to} — lozinku postavite preko <a href="${forgot}">„Zaboravljena lozinka“</a>.</p>
      <hr style="border:0;border-top:1px solid #eee;margin:20px 0">
      <p style="color:#555;font-size:13px">Your page is live on Balkina. <a href="${openUrl}">Open your dashboard</a> (link works for 24h). To set a password later, use <a href="${forgot}">Forgot password</a> with ${to}.</p>
    </div>`;
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: `${businessName} — vaša Balkina stranica je aktivna`, html }),
    });
  } catch (err) {
    console.error('[claim] welcome email failed:', err);
  }
}

/**
 * POST /api/claim
 * One-tap claim of a pre-provisioned ("unclaimed") booking page: creates the
 * owner's login (password optional), links it to the tenant and its owner
 * staff record, activates the tenant, marks the prospect claimed, and returns
 * a single-use sign-in URL so the owner lands in the dashboard immediately.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const { token, email, password } = parsed.data;
  const supabase = getSupabase();

  const { data: prospect } = await supabase
    .from('growth_prospects')
    .select('id, name, tenant_id, claimed_at, claim_expires_at')
    .eq('claim_token', token)
    .maybeSingle();

  if (!prospect || !prospect.tenant_id) return Response.json({ error: 'This claim link is not valid.' }, { status: 404 });
  if (prospect.claimed_at) return Response.json({ error: 'This page has already been claimed. Log in at app.balkina.ai.' }, { status: 409 });
  if (prospect.claim_expires_at && new Date(prospect.claim_expires_at) < new Date()) {
    return Response.json({ error: 'This claim link has expired. Reply to our email and we will send a new one.' }, { status: 410 });
  }

  const { data: tenant } = await supabase.from('tenants').select('id, name, slug, status, user_id, owner_name').eq('id', prospect.tenant_id).maybeSingle();
  if (!tenant || tenant.status !== 'unclaimed' || tenant.user_id) {
    return Response.json({ error: 'This page is no longer available to claim.' }, { status: 409 });
  }

  const businessName = cleanBusinessName(tenant.name as string);
  const ownerName = parsed.data.owner_name || guessOwnerName(tenant.name as string, tenant.owner_name as string | null) || businessName;

  // The owner proved they hold the claim link we sent; the account is usable
  // immediately. Without a password they sign in via the returned link and can
  // set one later from the welcome email.
  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email,
    ...(password ? { password } : {}),
    email_confirm: true,
    user_metadata: { full_name: ownerName },
  });
  if (authErr || !created?.user) {
    const msg = authErr?.message ?? '';
    if (/already|exists|registered/i.test(msg)) {
      return Response.json({ error: 'An account with this email already exists. Log in at app.balkina.ai, or use a different email.' }, { status: 409 });
    }
    return Response.json({ error: `Could not create your login: ${msg || 'unknown error'}` }, { status: 500 });
  }
  const userId = created.user.id;
  const now = new Date().toISOString();

  const { error: tErr } = await supabase
    .from('tenants')
    .update({ user_id: userId, email, owner_name: ownerName, status: 'active' })
    .eq('id', tenant.id);
  if (tErr) return Response.json({ error: `Could not activate your page: ${tErr.message}` }, { status: 500 });

  await supabase
    .from('staff')
    .update({ user_id: userId, email, name: ownerName })
    .eq('tenant_id', tenant.id)
    .is('user_id', null);

  await supabase
    .from('growth_prospects')
    .update({ claimed_at: now, claim_email: email, stage: 'claimed', updated_at: now })
    .eq('id', prospect.id);

  await supabase.from('growth_events').insert({ prospect_id: prospect.id, type: 'claimed', channel: 'web', payload: { tenant_id: tenant.id, email } });

  // Single-use sign-in link consumed by app.balkina.ai/auth/callback.
  let loginUrl = `${appUrl()}/auth/login`;
  const { data: magic } = await supabase.auth.admin.generateLink({ type: 'magiclink', email });
  const hashed = magic?.properties?.hashed_token;
  if (hashed) {
    loginUrl = `${appUrl()}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${encodeURIComponent('/dashboard')}`;
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || 'https://balkina.ai').replace(/\/$/, '');
  const bookingUrl = tenant.slug ? `${siteUrl}/b/${tenant.slug}` : null;
  await sendWelcomeEmail(email, businessName, `${siteUrl}/api/claim/login?token=${token}`, bookingUrl);
  return Response.json({ success: true, login_url: loginUrl, booking_url: bookingUrl, business_name: businessName });
}
