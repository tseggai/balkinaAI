import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/** Resolve the signed-in user's tenant id, or null. */
async function getTenantId(): Promise<string | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin: Db = createAdminClient();
  const { data } = await admin.from('tenants').select('id').eq('user_id', user.id).maybeSingle();
  return (data as { id: string } | null)?.id ?? null;
}

/**
 * GET /api/tenant/messages
 * Messages visible to the signed-in tenant: announcements (broadcasts) for the
 * properties they belong to, plus messages addressed directly to them.
 */
export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin: Db = createAdminClient();

  const { data: links } = await admin.from('property_tenants').select('property_id').eq('tenant_id', tenantId);
  const propertyIds = ((links ?? []) as { property_id: string }[]).map((l) => l.property_id);

  // Direct messages + broadcasts for the tenant's properties.
  const [{ data: direct }, { data: broadcasts }] = await Promise.all([
    admin.from('property_messages')
      .select('id, subject, body, tenant_id, created_at, properties(name)')
      .eq('tenant_id', tenantId),
    propertyIds.length
      ? admin.from('property_messages')
          .select('id, subject, body, tenant_id, created_at, properties(name)')
          .is('tenant_id', null)
          .in('property_id', propertyIds)
      : Promise.resolve({ data: [] }),
  ]);

  type Row = { id: string; subject: string; body: string; tenant_id: string | null; created_at: string; properties: { name: string } | null };
  const rows = ([...((direct ?? []) as Row[]), ...((broadcasts ?? []) as Row[])])
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  const { data: reads } = await admin.from('property_message_reads').select('message_id').eq('tenant_id', tenantId);
  const readSet = new Set(((reads ?? []) as { message_id: string }[]).map((r) => r.message_id));

  const messages = rows.map((m) => ({
    id: m.id,
    subject: m.subject,
    body: m.body,
    property_name: m.properties?.name ?? 'Property',
    is_direct: m.tenant_id !== null,
    created_at: m.created_at,
    read: readSet.has(m.id),
  }));

  return NextResponse.json({ messages, unread_count: messages.filter((m) => !m.read).length });
}

/**
 * POST /api/tenant/messages/read — mark message ids as read for this tenant.
 */
export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { ids } = await request.json() as { ids?: string[] };
  if (!ids || ids.length === 0) return NextResponse.json({ success: true });

  const admin: Db = createAdminClient();
  await admin
    .from('property_message_reads')
    .upsert(ids.map((id) => ({ message_id: id, tenant_id: tenantId })), { onConflict: 'message_id,tenant_id', ignoreDuplicates: true });

  return NextResponse.json({ success: true });
}
