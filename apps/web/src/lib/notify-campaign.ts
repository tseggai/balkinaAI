import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Push-notify a property's customers (anyone who has booked at one of its
 * businesses) about a new or updated campaign. Best-effort; never throws.
 */
export async function notifyCampaign(
  admin: SupabaseClient,
  propertyId: string,
  propertySlug: string,
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

    // Only this property's app tokens — never the base Balkina app.
    const { data: toks } = await admin
      .from('customer_push_tokens')
      .select('token')
      .in('customer_id', customerIds)
      .eq('property_slug', propertySlug);
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

/** Confirm a customer's RSVP/sign-up via push (property app) + email. Best-effort. */
export async function notifyRsvpConfirmation(
  admin: SupabaseClient,
  campaignId: string,
  entryId: string,
  data: Record<string, unknown>,
  customerId: string | null,
): Promise<void> {
  try {
    const { data: camp } = await admin
      .from('property_campaigns')
      .select('title, property_id')
      .eq('id', campaignId)
      .maybeSingle();
    const c = camp as { title: string; property_id: string } | null;
    if (!c) return;
    const { data: prop } = await admin.from('properties').select('name, slug').eq('id', c.property_id).maybeSingle();
    const property = prop as { name: string; slug: string } | null;

    // Push to this customer's property-app token.
    if (customerId && property) {
      const { data: toks } = await admin
        .from('customer_push_tokens')
        .select('token')
        .eq('customer_id', customerId)
        .eq('property_slug', property.slug);
      const tokens = Array.from(new Set(((toks ?? []) as { token: string }[]).map((t) => t.token)));
      if (tokens.length > 0) {
        const { sendPushNotification } = await import('@balkina/notifications');
        await sendPushNotification(tokens.map((token) => ({
          pushToken: token,
          title: `You're in — ${c.title}`,
          body: 'Your QR is in the app. Show it at the door to check in.',
          data: { type: 'campaign', campaignId },
        })));
      }
    }

    // Email confirmation to the RSVPer (with their primary QR). Each guest's
    // own QR is shared from the confirmation sheet / My Bookings, so we only
    // email the person who booked.
    const email = (data.email as string) || '';
    if (email && property) {
      const qr = `https://api.qrserver.com/v1/create-qr-code/?size=320x320&margin=8&data=${entryId}.0`;
      const { sendEmail } = await import('@balkina/notifications');
      await sendEmail({
        to: email,
        fromName: property.name,
        subject: `You're confirmed — ${c.title}`,
        html: `<div style="font-family:system-ui,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="margin:0 0 8px">You're in! 🎉</h2>
          <p style="color:#555">Your spot for <strong>${c.title}</strong> at ${property.name} is confirmed.</p>
          <p style="color:#555">Show this QR at the door to check in:</p>
          <img src="${qr}" width="200" height="200" alt="Your check-in QR" style="display:block;margin:16px 0"/>
          <p style="color:#999;font-size:13px">Bringing guests? Each has their own QR in the app to share.</p>
        </div>`,
        text: `You're confirmed for ${c.title} at ${property.name}. Show your QR in the app to check in.`,
      });
    }
  } catch (err) {
    console.error('[notifyRsvpConfirmation] failed:', err);
  }
}
