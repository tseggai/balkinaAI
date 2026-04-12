import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { sendTenantLoginEmail } from '@balkina/notifications';

/**
 * POST /api/admin/waitlist/invite
 * Resets the tenant owner's password to a fresh temporary password and emails
 * them branded login credentials directly from Balkina AI (via Resend).
 *
 * This replaces the old behaviour, which triggered Supabase's default
 * "Reset Your Password" email — that email is generic, doesn't reveal the
 * password, and looks like it comes from "Supabase Auth".
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { email } = body;

  if (!email) {
    return NextResponse.json({ error: 'email is required' }, { status: 400 });
  }

  // Find the auth user by email so we can reset their password.
  const { data: usersList, error: listErr } = await auth.supabase.auth.admin.listUsers();
  if (listErr) {
    return NextResponse.json({ error: `Failed to look up user: ${listErr.message}` }, { status: 500 });
  }
  const user = (usersList?.users ?? []).find((u: { email?: string }) => u.email === email);
  if (!user) {
    return NextResponse.json({ error: `No user found with email ${email}. Run "Setup" first to create the tenant.` }, { status: 404 });
  }

  // Look up the tenant for owner_name + business_name to personalise the email.
  // Falls back to placeholders if no tenant row is found.
  const { data: tenant } = await auth.supabase
    .from('tenants')
    .select('name, owner_name')
    .eq('user_id', user.id)
    .maybeSingle();
  const tenantRow = tenant as { name?: string; owner_name?: string } | null;
  const businessName = tenantRow?.name ?? 'your business';
  const ownerName = tenantRow?.owner_name ?? user.user_metadata?.full_name ?? 'there';

  // Generate a fresh, human-pronounceable temp password.
  const tempPassword = generateTempPassword();

  // Update the user's password directly via the admin API. This works because
  // requireAdmin() returns the service-role client.
  const { error: updateErr } = await auth.supabase.auth.admin.updateUserById(user.id, {
    password: tempPassword,
    email_confirm: true,
  });
  if (updateErr) {
    return NextResponse.json({ error: `Failed to set temporary password: ${updateErr.message}` }, { status: 500 });
  }

  const loginUrl = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/auth/login`
    : 'https://app.balkina.ai/auth/login';

  try {
    await sendTenantLoginEmail({
      email,
      ownerName,
      businessName,
      tempPassword,
      loginUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Password was reset but the email failed to send: ${msg}` }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `Login credentials sent to ${email}` });
}

/**
 * Generate a 14-character temp password with mixed case, digits, and one symbol.
 * Avoids ambiguous characters (0/O, 1/l/I) so it's easy to type from the email.
 */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digit = '23456789';
  const symbol = '!@#$%&*';
  const all = upper + lower + digit;
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  // Guarantee at least one of each required class.
  const required = [pick(upper), pick(lower), pick(digit), pick(symbol)];
  const remaining = Array.from({ length: 10 }, () => pick(all));
  return [...required, ...remaining].sort(() => Math.random() - 0.5).join('');
}
