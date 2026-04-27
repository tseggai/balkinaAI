import { NextResponse } from 'next/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function POST(request: Request) {
  try {
    const ctx = await getTenantContext(request);
    if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

    const body = await request.json() as { staff_id: string };
    if (!body.staff_id) return NextResponse.json({ error: 'staff_id required' }, { status: 400, headers: CORS_HEADERS });

    const { data: staff } = await ctx.admin.from('staff').select('id, name, email').eq('id', body.staff_id).eq('tenant_id', ctx.tenantId).single();
    if (!staff) return NextResponse.json({ error: 'Staff not found' }, { status: 404, headers: CORS_HEADERS });

    const s = staff as { id: string; name: string; email: string | null };
    if (!s.email) return NextResponse.json({ error: 'Staff has no email address' }, { status: 400, headers: CORS_HEADERS });

    const token = Math.random().toString(36).substring(2, 8).toUpperCase();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await ctx.admin.from('staff').update({ invite_token: token, invite_expires_at: expiresAt } as never).eq('id', s.id);

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@balkina.ai';
    if (resendKey) {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: fromEmail,
          to: s.email,
          subject: `You've been invited to join ${ctx.tenantName} on Balkina AI`,
          html: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
            <h2>You're invited to join ${ctx.tenantName}!</h2>
            <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:16px 0;">
              <p style="margin:0 0 8px 0;"><strong>Your email:</strong> ${s.email}</p>
              <p style="margin:0;font-size:32px;letter-spacing:4px;color:#6B7FC4;text-align:center;font-weight:700;">${token}</p>
            </div>
            <h3>How to get started</h3>
            <ol style="color:#52525b;font-size:14px;line-height:1.8;">
              <li>Download the Balkina AI app</li>
              <li>Tap "I'm a staff member"</li>
              <li>Tap "New staff? Use invite code"</li>
              <li>Enter the code, your email, and create a password</li>
            </ol>
            <p><a href="https://apps.apple.com/us/app/balkina-ai/id6761651423" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Download for iOS</a></p>
            <p style="color:#9ca3af;font-size:13px;">This code expires in 7 days.</p>
          </div>`,
        }),
      });
    }

    return NextResponse.json({ data: { token, email: s.email } }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[tenant/staff-invite] error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500, headers: CORS_HEADERS });
  }
}
