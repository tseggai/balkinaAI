import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Push-notify a property's customers (anyone who has booked at one of its
 * businesses) about a new or updated campaign. Best-effort; never throws.
 */
export async function notifyCampaign(
  admin: SupabaseClient,
  propertyId: string,
  campaign: { id: string; title: string; blurb: string | null },
): Promise<void> {
  try {
    const { data: pts } = await admin.from('property_tenants').select('tenant_id').eq('property_id', propertyId);
    const tenantIds = ((pts ?? []) as { tenant_id: string }[]).map((r) => r.tenant_id);
    if (tenantIds.length === 0) return;

    const { data: appts } = await admin
      .from('appointments')
      .select('customer_id')
      .in('tenant_id', tenantIds)
      .not('customer_id', 'is', null)
      .limit(5000);
    const customerIds = Array.from(new Set(((appts ?? []) as { customer_id: string }[]).map((a) => a.customer_id)));
    if (customerIds.length === 0) return;

    const { data: toks } = await admin
      .from('customer_push_tokens')
      .select('token')
      .in('customer_id', customerIds);
    const tokens = Array.from(new Set(((toks ?? []) as { token: string }[]).map((t) => t.token)));
    if (tokens.length === 0) return;

    const { sendPushNotification } = await import('@balkina/notifications');
    await sendPushNotification(
      tokens.map((token) => ({
        pushToken: token,
        title: campaign.title,
        body: campaign.blurb || 'A new happening at the property — tap to see details.',
        data: { type: 'campaign', campaignId: campaign.id },
      })),
    );
  } catch (err) {
    console.error('[notifyCampaign] failed:', err);
  }
}
