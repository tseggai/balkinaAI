import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { randomUUID } from 'crypto';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id, name').eq('user_id', user.id).single();
  return tenant as { id: string; name: string } | null;
}

export async function POST(request: Request) {
  const tenant = await getTenantId();
  if (!tenant) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { staff_id: string };
  const { staff_id } = body;
  if (!staff_id) return NextResponse.json({ data: null, error: { message: 'Missing staff_id' } }, { status: 400 });

  const supabase = createAdminClient();

  // Verify the staff belongs to this tenant
  const { data: staffRow, error: staffErr } = await supabase
    .from('staff')
    .select('id, name, email')
    .eq('id', staff_id)
    .eq('tenant_id', tenant.id)
    .single();

  if (staffErr || !staffRow) {
    return NextResponse.json({ data: null, error: { message: 'Staff not found' } }, { status: 404 });
  }

  const staff = staffRow as { id: string; name: string; email: string };

  // Generate a 6-character invite code (uppercase alphanumeric)
  const token = randomUUID().replace(/-/g, '').substring(0, 6).toUpperCase();
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(); // 7 days

  // Store token on staff row
  const { error: updateErr } = await supabase
    .from('staff')
    .update({
      invite_token: token,
      invite_expires_at: expiresAt,
    } as never)
    .eq('id', staff_id);

  if (updateErr) {
    return NextResponse.json({ data: null, error: { message: updateErr.message } }, { status: 500 });
  }

  // Send invite email via Resend if staff has an email
  if (staff.email) {
    try {
      const resendKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@balkina.ai';
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: staff.email,
            subject: `You've been invited to join ${tenant.name} on Balkina AI`,
            html: `
              <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
                <h2 style="color:#111;margin-top:0;">You're invited to join ${tenant.name}!</h2>
                <p>${tenant.name} has invited you to join their team on Balkina AI — an AI-powered appointment booking platform.</p>

                <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:16px 0;">
                  <p style="margin:0 0 8px 0;"><strong>Your email:</strong> ${staff.email}</p>
                  <p style="margin:0 0 8px 0;"><strong>Invite code:</strong></p>
                  <p style="margin:0;font-size:32px;letter-spacing:4px;color:#6B7FC4;text-align:center;font-weight:700;">${token}</p>
                </div>

                <h3 style="margin-top:24px;">How to get started</h3>
                <ol style="color:#52525b;font-size:14px;line-height:1.8;">
                  <li>Download the Balkina AI app on your phone</li>
                  <li>Tap <strong>"I'm a staff member"</strong> on the login screen</li>
                  <li>Tap <strong>"New staff? Use invite code"</strong></li>
                  <li>Enter the invite code above, your email, and create a password</li>
                </ol>

                <p style="margin:24px 0;">
                  <a href="https://apps.apple.com/us/app/balkina-ai/id6761651423" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Download for iOS</a>
                </p>

                <p style="color:#9ca3af;font-size:13px;">This invite code expires in 7 days. If you need help, contact your manager or email <a href="mailto:support@balkina.ai" style="color:#6B7FC4;">support@balkina.ai</a>.</p>
                <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
                <p style="color:#a1a1aa;font-size:12px;margin:0;">Balkina AI · AI-powered appointment booking</p>
              </div>
            `,
          }),
        });
      }
    } catch {
      // Email sending is best-effort, don't fail the invite
    }
  }

  return NextResponse.json({
    data: { token, expires_at: expiresAt, staff_name: staff.name, email_sent: !!staff.email },
    error: null,
  });
}
