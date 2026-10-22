import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/admin-auth';
import { exchangeCode, me, saveTokens } from '@/lib/canva/client';

// GET /api/admin/canva/callback?code&state — finish the OAuth flow and store the tokens.
export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const url = new URL(request.url);
  const back = (q: string) => NextResponse.redirect(new URL(`/dashboard/instagram?canva=${q}`, url.origin));
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const raw = cookies().get('canva_oauth')?.value;
  const saved = raw ? (JSON.parse(raw) as { state: string; verifier: string }) : null;
  if (!code || !state || !saved || saved.state !== state) return back('error_state');

  try {
    const tokens = await exchangeCode(code, saved.verifier);
    const ids = await me(tokens.access_token).catch(() => ({}));
    await saveTokens(auth.supabase, tokens, ids);
  } catch (err) {
    return back(`error_${encodeURIComponent(err instanceof Error ? err.message : 'unknown')}`);
  }
  const res = back('connected');
  res.cookies.set('canva_oauth', '', { path: '/api/admin/canva', maxAge: 0 });
  return res;
}
