import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const tokenHash = searchParams.get('token_hash');
  const type = searchParams.get('type');
  const next = searchParams.get('next') ?? '/dashboard';

  // Server-issued links (e.g. the marketing site's one-tap claim) carry a
  // single-use hashed token instead of a PKCE code.
  if (tokenHash && (type === 'magiclink' || type === 'recovery' || type === 'email')) {
    const supabase = createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      if (type === 'recovery') return NextResponse.redirect(`${origin}/auth/reset-password`);
      return NextResponse.redirect(`${origin}${next.startsWith('/') ? next : '/dashboard'}`);
    }
  }

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // If this is a password reset recovery, redirect to the reset-password form
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/auth/reset-password`);
      }
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  // Auth code exchange failed — redirect to login with error
  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`);
}
