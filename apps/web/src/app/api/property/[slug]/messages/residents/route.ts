import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { notifyMembers } from '@/lib/notify-members';
import { memberTypeLabel } from '@balkina/shared';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * POST /api/property/[slug]/messages/residents
 * Push-notify the property's verified members (push only). audience:
 * 'all' | 'residents' | 'homeowner' | 'renter' | 'commercial_owner'.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { subject?: string; body?: string; audience?: string };
  const subject = (body.subject || '').trim();
  const messageBody = (body.body || '').trim();
  if (!subject || !messageBody) return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });

  const audience = body.audience || 'all';
  const label = audience === 'all'
    ? 'All residents'
    : audience === 'residents' ? 'Residents' : `${memberTypeLabel(audience)}s`;

  const { matched, pushed } = await notifyMembers(ctx.admin, ctx.propertyId, slug, audience, { title: subject, body: messageBody });

  if (matched === 0) {
    return NextResponse.json({ error: `No verified ${label.toLowerCase()} to notify yet` }, { status: 400 });
  }

  // Record the send in the shared history (push only — email_sent_count carries
  // the number of devices reached).
  await (ctx.admin as any).from('property_messages').insert({
    property_id: ctx.propertyId,
    tenant_id: null,
    subject,
    body: messageBody,
    recipient_label: label,
    created_by: ctx.userId,
    recipients_count: matched,
    email_sent_count: pushed,
  });

  return NextResponse.json({
    success: true,
    recipients_count: matched,
    email_sent_count: pushed,
    message: pushed > 0
      ? `Notified ${pushed} device${pushed === 1 ? '' : 's'} across ${matched} ${label.toLowerCase()}.`
      : `${matched} ${label.toLowerCase()} matched, but none have the app installed yet.`,
  }, { status: 201 });
}
