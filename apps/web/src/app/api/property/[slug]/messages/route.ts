import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { sendPropertyMessageEmail } from '@balkina/notifications';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/**
 * GET /api/property/[slug]/messages — history of sent messages/broadcasts.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await (ctx.admin as Db)
    .from('property_messages')
    .select('id, tenant_id, subject, body, recipients_count, email_sent_count, created_at, tenants(name)')
    .eq('property_id', ctx.propertyId)
    .order('created_at', { ascending: false })
    .limit(100);

  const messages = ((data ?? []) as { id: string; tenant_id: string | null; subject: string; body: string; recipients_count: number; email_sent_count: number; created_at: string; tenants: { name: string } | null }[])
    .map((m) => ({
      id: m.id,
      tenant_id: m.tenant_id,
      recipient: m.tenant_id ? (m.tenants?.name ?? 'Tenant') : 'All tenants',
      subject: m.subject,
      body: m.body,
      recipients_count: m.recipients_count,
      email_sent_count: m.email_sent_count,
      created_at: m.created_at,
    }));

  return NextResponse.json({ data: messages });
}

/**
 * POST /api/property/[slug]/messages
 * Send a message to one tenant (tenantId set) or broadcast to all (tenantId omitted).
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { subject?: string; body?: string; tenantId?: string };
  const subject = (body.subject || '').trim();
  const messageBody = (body.body || '').trim();
  const tenantId = body.tenantId || null;
  if (!subject || !messageBody) return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });

  const supabase: Db = ctx.admin;

  // Resolve recipients: a single tenant, or every tenant linked to the property.
  let recipientTenantIds: string[];
  if (tenantId) {
    const { data: link } = await supabase
      .from('property_tenants')
      .select('tenant_id')
      .eq('property_id', ctx.propertyId)
      .eq('tenant_id', tenantId)
      .maybeSingle();
    if (!link) return NextResponse.json({ error: 'That business is not part of this property' }, { status: 400 });
    recipientTenantIds = [tenantId];
  } else {
    const { data: links } = await supabase
      .from('property_tenants')
      .select('tenant_id')
      .eq('property_id', ctx.propertyId);
    recipientTenantIds = ((links ?? []) as { tenant_id: string }[]).map((l) => l.tenant_id);
  }

  if (recipientTenantIds.length === 0) {
    return NextResponse.json({ error: 'No tenants to message yet' }, { status: 400 });
  }

  // Fetch recipient emails.
  const { data: tenantRows } = await supabase
    .from('tenants')
    .select('id, name, owner_name, email')
    .in('id', recipientTenantIds);
  const recipients = ((tenantRows ?? []) as { id: string; name: string; owner_name: string | null; email: string | null }[])
    .filter((t) => t.email);

  // Property branding.
  const { data: prop } = await supabase.from('properties').select('name, email').eq('id', ctx.propertyId).single();
  const property = (prop as { name: string; email: string | null } | null) ?? { name: 'Balkina AI', email: null };

  // Send (best-effort per recipient).
  let emailSent = 0;
  const failures: string[] = [];
  for (const r of recipients) {
    try {
      await sendPropertyMessageEmail({
        to: r.email!,
        propertyName: property.name,
        propertyEmail: property.email,
        subject,
        body: messageBody,
        recipientName: r.owner_name || r.name,
      });
      emailSent += 1;
    } catch (err) {
      failures.push(`${r.name}: ${err instanceof Error ? err.message : 'failed'}`);
    }
  }

  // Record the send.
  await supabase.from('property_messages').insert({
    property_id: ctx.propertyId,
    tenant_id: tenantId,
    subject,
    body: messageBody,
    created_by: ctx.userId,
    recipients_count: recipients.length,
    email_sent_count: emailSent,
  });

  return NextResponse.json({
    success: true,
    recipients_count: recipients.length,
    email_sent_count: emailSent,
    failures,
    message: `Sent to ${emailSent} of ${recipients.length} recipient${recipients.length === 1 ? '' : 's'}.${failures.length ? ` ${failures.length} failed.` : ''}`,
  }, { status: 201 });
}
