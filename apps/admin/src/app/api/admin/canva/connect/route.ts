import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { requireAdmin } from '@/lib/admin-auth';
import { authorizeUrl, canvaConfigured, pkcePair } from '@/lib/canva/client';

// GET /api/admin/canva/connect — start the Canva OAuth (PKCE) flow. State + verifier live in a short-lived cookie.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  if (!canvaConfigured()) return NextResponse.json({ error: 'CANVA_CLIENT_ID / CANVA_CLIENT_SECRET are not set' }, { status: 500 });

  const state = randomBytes(16).toString('base64url');
  const { verifier, challenge } = pkcePair();
  const res = NextResponse.redirect(authorizeUrl(state, challenge));
  res.cookies.set('canva_oauth', JSON.stringify({ state, verifier }), { httpOnly: true, secure: true, sameSite: 'lax', path: '/api/admin/canva', maxAge: 600 });
  return res;
}
