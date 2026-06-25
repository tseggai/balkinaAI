import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { generateUniqueMemberCode } from '@/lib/member-code';
import { PROPERTY_MEMBER_TYPES, memberTypeLabel, type PropertyMemberType } from '@balkina/shared';
import { sendEmail, sendSms } from '@balkina/notifications';

/* eslint-disable @typescript-eslint/no-explicit-any */

interface Body {
  email?: string;
  phone?: string;
  member_type?: string;
  unit?: string | null;
  channel?: 'sms' | 'whatsapp';
  resendId?: string;
}

interface Prop { name: string; email: string | null; app_store_url: string | null; play_store_url: string | null }
interface CodeRow { code: string; member_type: string; email: string | null; phone: string | null; unit: string | null }

/** Email + SMS/WhatsApp an invite. Best-effort per channel; returns which succeeded. */
async function deliver(property: Prop, c: CodeRow, channel: 'sms' | 'whatsapp' = 'sms'): Promise<{ email: boolean; sms: boolean }> {
  const typeLabel = memberTypeLabel(c.member_type);
  const out = { email: false, sms: false };

  const storeButton = (href: string, label: string) =>
    `<a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;border-radius:8px;padding:10px 16px;font-size:13px;font-weight:600;margin:4px 6px 4px 0">${label}</a>`;
  const storeButtons = [
    property.app_store_url ? storeButton(property.app_store_url, 'Download for iPhone') : null,
    property.play_store_url ? storeButton(property.play_store_url, 'Download for Android') : null,
  ].filter(Boolean).join('');

  if (c.email) {
    try {
      await sendEmail({
        to: c.email,
        fromName: property.name,
        subject: `You're invited to ${property.name}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">Welcome to ${property.name}</h2>
          <p style="color:#555">You've been invited as a <strong>${typeLabel}</strong>${c.unit ? ` (unit ${c.unit})` : ''}. Verify once in the ${property.name} app to unlock resident announcements and access.</p>
          ${storeButtons ? `<p style="color:#555;margin-top:18px">First, download the app:</p><div style="margin:6px 0 4px">${storeButtons}</div>` : ''}
          <p style="color:#555;margin-top:18px">Then open the app, tap <strong>Verify your residence</strong>, and enter this code:</p>
          <div style="font-size:22px;font-weight:700;letter-spacing:1px;background:#111;color:#fff;border-radius:10px;padding:14px 18px;text-align:center;margin:12px 0">${c.code}</div>
        </div>`,
        text: `Welcome to ${property.name}. You've been invited as a ${typeLabel}${c.unit ? ` (unit ${c.unit})` : ''}. ${storeButtons ? 'Download the app, then ' : ''}open the ${property.name} app, tap "Verify your residence", and enter code ${c.code}.`,
      });
      out.email = true;
    } catch (err) { console.error('[member-invite] email failed:', err); }
  }

  if (c.phone) {
    try {
      await sendSms({
        to: c.phone,
        channel,
        body: `You've been invited to ${property.name} as a ${typeLabel}. Open the ${property.name} app, tap "Verify your residence", and enter code ${c.code}.`,
      });
      out.sms = true;
    } catch (err) { console.error('[member-invite] sms failed:', err); }
  }

  return out;
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Body;

  const { data: propRow } = await (ctx.admin as any)
    .from('properties')
    .select('name, email, app_store_url, play_store_url')
    .eq('id', ctx.propertyId)
    .single();
  const property = (propRow as Prop | null) ?? { name: 'Balkina AI', email: null, app_store_url: null, play_store_url: null };

  // Resend an existing invite.
  if (body.resendId) {
    const { data: existing } = await (ctx.admin as any)
      .from('property_member_codes')
      .select('code, member_type, email, phone, unit')
      .eq('id', body.resendId)
      .eq('property_id', ctx.propertyId)
      .maybeSingle();
    const c = existing as CodeRow | null;
    if (!c || (!c.email && !c.phone)) return NextResponse.json({ error: 'Invite not found' }, { status: 404 });
    const delivery = await deliver(property, c, body.channel === 'whatsapp' ? 'whatsapp' : 'sms');
    await (ctx.admin as any).from('property_member_codes').update({ sent_at: new Date().toISOString() }).eq('id', body.resendId);
    return NextResponse.json({ delivery });
  }

  // New invite.
  const email = body.email?.trim() || null;
  const phone = body.phone?.trim() || null;
  if (!email && !phone) return NextResponse.json({ error: 'An email or phone number is required' }, { status: 400 });

  const member_type = (body.member_type ?? 'homeowner') as PropertyMemberType;
  if (!PROPERTY_MEMBER_TYPES.includes(member_type)) {
    return NextResponse.json({ error: 'Invalid member type' }, { status: 400 });
  }

  const code = await generateUniqueMemberCode(ctx.admin, slug, member_type);
  const unit = body.unit?.trim() || null;

  const { data: saved, error } = await (ctx.admin as any)
    .from('property_member_codes')
    .insert({
      property_id: ctx.propertyId,
      code,
      member_type,
      unit,
      email,
      phone,
      max_redemptions: 1,
      sent_at: new Date().toISOString(),
      created_by: ctx.userId,
    })
    .select('*')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const delivery = await deliver(property, { code, member_type, email, phone, unit }, body.channel === 'whatsapp' ? 'whatsapp' : 'sms');
  return NextResponse.json({ data: saved, delivery });
}
