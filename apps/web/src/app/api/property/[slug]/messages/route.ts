import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { getPropertyTenantsWithCategory } from '@/lib/property-tenant-categories';
import { sendPropertyMessageEmail } from '@balkina/notifications';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/**
 * GET /api/property/[slug]/messages — history of sent messages/broadcasts, plus
 * the recipient metadata (tenants with category) the compose form needs to
 * offer multi-select and category targeting.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await (ctx.admin as Db)
    .from('property_messages')
    .select('id, tenant_id, subject, body, recipient_label, recipients_count, email_sent_count, created_at, tenants(name)')
    .eq('property_id', ctx.propertyId)
    .order('created_at', { ascending: false })
    .limit(100);

  const messages = ((data ?? []) as { id: string; tenant_id: string | null; subject: string; body: string; recipient_label: string | null; recipients_count: number; email_sent_count: number; created_at: string; tenants: { name: string } | null }[])
    .map((m) => ({
      id: m.id,
      tenant_id: m.tenant_id,
      recipient: m.recipient_label || (m.tenant_id ? (m.tenants?.name ?? 'Tenant') : 'All tenants'),
      subject: m.subject,
      body: m.body,
      recipients_count: m.recipients_count,
      email_sent_count: m.email_sent_count,
      created_at: m.created_at,
    }));

  const tenants = await getPropertyTenantsWithCategory(ctx.admin, ctx.propertyId);
  const categories = Array.from(new Set(tenants.map((t) => t.category).filter(Boolean) as string[])).sort();

  return NextResponse.json({ data: messages, recipients: { tenants, categories } });
}

/**
 * POST /api/property/[slug]/messages
 * Send a message to one tenant (tenantId set) or broadcast to all (tenantId omitted).
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { subject?: string; body?: string; tenantId?: string; tenantIds?: string[]; category?: string };
  const subject = (body.subject || '').trim();
  const messageBody = (body.body || '').trim();
  if (!subject || !messageBody) return NextResponse.json({ error: 'Subject and message are required' }, { status: 400 });

  const supabase: Db = ctx.admin;

  // Every business linked to the property, with its category — the universe we
  // resolve recipients against (so a tenant can never be messaged from a
  // property it doesn't belong to).
  const propertyTenants = await getPropertyTenantsWithCategory(ctx.admin, ctx.propertyId);
  const validIds = new Set(propertyTenants.map((t) => t.id));

  // Resolve recipients across the supported targeting modes.
  let recipientTenantIds: string[];
  let recipientLabel: string | null = null;
  let singleTenantId: string | null = null;

  if (body.category) {
    const inCat = propertyTenants.filter((t) => t.category === body.category);
    recipientTenantIds = inCat.map((t) => t.id);
    recipientLabel = `${body.category} (${recipientTenantIds.length})`;
    if (recipientTenantIds.length === 0) return NextResponse.json({ error: `No businesses in “${body.category}” yet` }, { status: 400 });
  } else if (Array.isArray(body.tenantIds) && body.tenantIds.length > 0) {
    recipientTenantIds = body.tenantIds.filter((id) => validIds.has(id));
    if (recipientTenantIds.length === 0) return NextResponse.json({ error: 'None of those businesses are part of this property' }, { status: 400 });
    if (recipientTenantIds.length === 1) {
      singleTenantId = recipientTenantIds[0]!;
      recipientLabel = propertyTenants.find((t) => t.id === singleTenantId)?.name ?? null;
    } else {
      recipientLabel = `${recipientTenantIds.length} selected businesses`;
    }
  } else if (body.tenantId) {
    if (!validIds.has(body.tenantId)) return NextResponse.json({ error: 'That business is not part of this property' }, { status: 400 });
    singleTenantId = body.tenantId;
    recipientTenantIds = [body.tenantId];
    recipientLabel = propertyTenants.find((t) => t.id === body.tenantId)?.name ?? null;
  } else {
    recipientTenantIds = propertyTenants.map((t) => t.id);
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
    tenant_id: singleTenantId,
    subject,
    body: messageBody,
    recipient_label: recipientLabel,
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
