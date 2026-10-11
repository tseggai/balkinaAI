import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const bodySchema = z.object({
  token: z.string().regex(/^[a-f0-9]{48}$/, 'Invalid claim link'),
  owner_name: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  password: z.string().min(8).max(200),
});

/**
 * POST /api/claim
 * Claims a pre-provisioned ("unclaimed") booking page: creates the owner's
 * login, links it to the tenant and its owner staff record, activates the
 * tenant and marks the prospect as claimed.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request' }, { status: 400 });
  }
  const { token, owner_name, email, password } = parsed.data;
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

  const { data: tenant } = await supabase.from('tenants').select('id, status, user_id').eq('id', prospect.tenant_id).maybeSingle();
  if (!tenant || tenant.status !== 'unclaimed' || tenant.user_id) {
    return Response.json({ error: 'This page is no longer available to claim.' }, { status: 409 });
  }

  // Create the owner's login. They chose the password themselves, so the
  // account is usable immediately (same trust level as the admin setup flow).
  const { data: created, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: owner_name },
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
    .update({ user_id: userId, email, owner_name, status: 'active' })
    .eq('id', tenant.id);
  if (tErr) return Response.json({ error: `Could not activate your page: ${tErr.message}` }, { status: 500 });

  await supabase
    .from('staff')
    .update({ user_id: userId, email, name: owner_name })
    .eq('tenant_id', tenant.id)
    .is('user_id', null);

  await supabase
    .from('growth_prospects')
    .update({ claimed_at: now, claim_email: email, stage: 'claimed', updated_at: now })
    .eq('id', prospect.id);

  await supabase.from('growth_events').insert({ prospect_id: prospect.id, type: 'claimed', channel: 'web', payload: { tenant_id: tenant.id, email } });

  const loginUrl = process.env.NEXT_PUBLIC_APP_URL ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')}/auth/login` : 'https://app.balkina.ai/auth/login';
  return Response.json({ success: true, login_url: loginUrl, business_name: prospect.name });
}
