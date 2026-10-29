import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { igAccountInfo, refreshLongLivedToken, resolveIgCredentials } from '@/lib/ig/publish';

const Body = z.object({ access_token: z.string().min(20).max(1000) });
const SIXTY_DAYS = 60 * 24 * 3600 * 1000;

/**
 * POST /api/admin/ig/token — connect: validate a pasted long-lived token against the account and store it
 * (replaces the previous one). The token is never returned to the browser.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Paste the long-lived access token from the Meta app dashboard' }, { status: 400 });
  const accessToken = parsed.data.access_token.trim();
  try {
    const account = await igAccountInfo({ userId: 'me', accessToken });
    const now = new Date();
    const { error } = await auth.supabase
      .from('ig_settings')
      .update({ access_token: accessToken, token_expires_at: new Date(now.getTime() + SIXTY_DAYS).toISOString(), token_updated_at: now.toISOString(), ig_username: account.username ?? null, ig_user_id: account.user_id ?? account.id, updated_at: now.toISOString() })
      .eq('id', 1);
    if (error) throw new Error(error.message);
    return NextResponse.json({ ok: true, account });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

/** PUT /api/admin/ig/token — refresh the stored token for another 60 days (must be at least 24 h old). */
export async function PUT() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const state = await resolveIgCredentials(auth.supabase);
  if (!state.creds || state.source !== 'db') return NextResponse.json({ error: 'Only a token stored here can be refreshed. Paste the token first.' }, { status: 400 });
  try {
    const r = await refreshLongLivedToken(state.creds.accessToken);
    const now = new Date();
    await auth.supabase.from('ig_settings').update({ access_token: r.accessToken, token_expires_at: new Date(now.getTime() + r.expiresIn * 1000).toISOString(), token_updated_at: now.toISOString(), updated_at: now.toISOString() }).eq('id', 1);
    return NextResponse.json({ ok: true, expires_at: new Date(now.getTime() + r.expiresIn * 1000).toISOString() });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 400 });
  }
}

/** DELETE /api/admin/ig/token — disconnect: forget the stored token (the env fallback, if any, remains). */
export async function DELETE() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const { error } = await auth.supabase.from('ig_settings').update({ access_token: null, token_expires_at: null, token_updated_at: null, ig_username: null, ig_user_id: null, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
