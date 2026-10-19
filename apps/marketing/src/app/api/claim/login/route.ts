import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// How long after claiming the claim token can still mint sign-in links. Past
// that, the owner uses the welcome email's set-password link or "Forgot password".
const MINT_WINDOW_MS = 24 * 60 * 60 * 1000;

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

const bodySchema = z.object({ token: z.string().regex(/^[a-f0-9]{48}$/) });

/**
 * POST /api/claim/login — { token } → { login_url }
 * Mints a fresh single-use dashboard sign-in URL for a page claimed with this
 * token in the last 24h. Lets the post-claim share screen's "Open my
 * dashboard" button work however long the owner lingers (each sign-in link is
 * consumed on first use).
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const supabase = getSupabase();

  const { data: prospect } = await supabase
    .from('growth_prospects')
    .select('id, tenant_id, claimed_at, claim_email')
    .eq('claim_token', parsed.data.token)
    .maybeSingle();

  const claimedAt = prospect?.claimed_at ? new Date(prospect.claimed_at as string).getTime() : null;
  if (!prospect?.tenant_id || !claimedAt || !prospect.claim_email || Date.now() - claimedAt > MINT_WINDOW_MS) {
    return Response.json({ error: 'Sign-in link expired. Use the link in your welcome email, or "Forgot password".' }, { status: 410 });
  }

  const { data: tenant } = await supabase.from('tenants').select('id, user_id, email').eq('id', prospect.tenant_id).maybeSingle();
  if (!tenant?.user_id || tenant.email !== prospect.claim_email) {
    return Response.json({ error: 'This page is not claimed.' }, { status: 409 });
  }

  const { data: magic, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: prospect.claim_email as string });
  const hashed = magic?.properties?.hashed_token;
  if (error || !hashed) return Response.json({ error: 'Could not create a sign-in link.' }, { status: 500 });

  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://app.balkina.ai').replace(/\/$/, '');
  return Response.json({
    login_url: `${appUrl}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${encodeURIComponent('/dashboard')}`,
  });
}
