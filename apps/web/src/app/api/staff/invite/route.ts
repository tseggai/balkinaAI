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
              <h2>Welcome to Balkina AI!</h2>
              <p>${tenant.name} has invited you to join their team.</p>
              <p>Download the Balkina AI app and enter your invite code:</p>
              <h1 style="font-size: 32px; letter-spacing: 4px; color: #6B7FC4; text-align: center;">${token}</h1>
              <p>This code expires in 7 days.</p>
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
