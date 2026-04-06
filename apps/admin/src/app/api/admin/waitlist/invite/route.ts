import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * POST /api/admin/waitlist/invite
 * Sends a password reset (magic link) email to the tenant owner
 * so they can set their password and log in.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  const redirectTo = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/auth/reset-password`
    : 'https://app.balkina.ai/auth/reset-password';

  const { error } = await auth.supabase.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo },
  });

  if (error) {
    return NextResponse.json({ error: `Failed to send invite: ${error.message}` }, { status: 500 });
  }

  // Also send via Supabase's built-in email (which actually sends the email)
  const { error: resetErr } = await auth.supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (resetErr) {
    return NextResponse.json({ error: `Failed to send email: ${resetErr.message}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `Login invite sent to ${email}` });
}
