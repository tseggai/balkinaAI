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
async function mintLoginUrl(token: string): Promise<{ login_url: string } | { error: string; status: number }> {
  const supabase = getSupabase();

  const { data: prospect } = await supabase
    .from('growth_prospects')
    .select('id, tenant_id, claimed_at, claim_email')
    .eq('claim_token', token)
    .maybeSingle();

  const claimedAt = prospect?.claimed_at ? new Date(prospect.claimed_at as string).getTime() : null;
  if (!prospect?.tenant_id || !claimedAt || !prospect.claim_email || Date.now() - claimedAt > MINT_WINDOW_MS) {
    return { error: 'Sign-in link expired. Sign in at app.balkina.ai, or use "Forgot password".', status: 410 };
  }

  const { data: tenant } = await supabase.from('tenants').select('id, user_id, email').eq('id', prospect.tenant_id).maybeSingle();
  if (!tenant?.user_id || tenant.email !== prospect.claim_email) {
    return { error: 'This page is not claimed.', status: 409 };
  }

  const { data: magic, error } = await supabase.auth.admin.generateLink({ type: 'magiclink', email: prospect.claim_email as string });
  const hashed = magic?.properties?.hashed_token;
  if (error || !hashed) return { error: 'Could not create a sign-in link.', status: 500 };

  return {
    login_url: `${appUrl()}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=magiclink&next=${encodeURIComponent('/dashboard')}`,
  };
}

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://app.balkina.ai').replace(/\/$/, '');
}

/** POST { token } → { login_url } — used by the share screen's dashboard button. */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Invalid request' }, { status: 400 });
  const r = await mintLoginUrl(parsed.data.token);
  return 'error' in r ? Response.json({ error: r.error }, { status: r.status }) : Response.json(r);
}

/** GET ?token= → redirect — used by the welcome email's "open dashboard" button. */
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get('token') ?? '';
  const parsed = bodySchema.safeParse({ token });
  const r = parsed.success ? await mintLoginUrl(parsed.data.token) : { error: 'Invalid link', status: 400 as const };
  const target = 'error' in r ? `${appUrl()}/auth/login` : r.login_url;
  return Response.redirect(target, 302);
}
