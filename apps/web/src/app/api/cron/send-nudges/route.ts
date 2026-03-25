import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .split('T')[0];

  // Find profiles where predicted_next_date is within the window [today-3, today]
  const { data: profiles, error } = await supabase
    .from('customer_behavior_profiles')
    .select('id, customer_id, tenant_id, service_id, predicted_next_date')
    .lte('predicted_next_date', today)
    .gte('predicted_next_date', threeDaysAgo);

  if (error) {
    console.error('[send-nudges] Failed to fetch profiles:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  let nudgesSent = 0;

  for (const raw of profiles ?? []) {
    const profile = raw as {
      id: string;
      customer_id: string;
      tenant_id: string;
      service_id: string;
      predicted_next_date: string;
    };

    // Check for duplicate nudge in the last 7 days
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: existingNudge } = await supabase
      .from('ai_nudge_log')
      .select('id')
      .eq('customer_id', profile.customer_id)
      .eq('tenant_id', profile.tenant_id)
      .eq('trigger_type', 'predicted_rebooking')
      .gte('sent_at', sevenDaysAgo)
      .maybeSingle();

    if (existingNudge) {
      console.log(
        `[send-nudges] Skipping duplicate nudge for customer ${profile.customer_id} / tenant ${profile.tenant_id}`
      );
      continue;
    }

    // Fetch customer push tokens
    const { data: tokens } = await supabase
      .from('customer_push_tokens')
      .select('token')
      .eq('customer_id', profile.customer_id);

    const pushTokens = (tokens as { token: string }[] | null)?.map((t) => t.token) ?? [];

    if (pushTokens.length === 0) {
      console.log(
        `[send-nudges] No push tokens for customer ${profile.customer_id}, skipping`
      );
      continue;
    }

    // Fetch service name
    const { data: service } = await supabase
      .from('services')
      .select('name')
      .eq('id', profile.service_id)
      .single();

    // Fetch tenant name
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name')
      .eq('id', profile.tenant_id)
      .single();

    const serviceName = (service as { name: string } | null)?.name ?? 'your service';
    const tenantName = (tenant as { name: string } | null)?.name ?? 'your provider';

    // Send push notification using the same pattern as reminders
    try {
      const { sendPushNotification } = await import('@balkina/notifications');
      for (const token of pushTokens) {
        await sendPushNotification([
          {
            pushToken: token,
            title: 'Time to rebook?',
            body: `It might be time to book your next ${serviceName} at ${tenantName}.`,
            data: {
              type: 'predicted_rebooking',
              tenantId: profile.tenant_id,
              serviceId: profile.service_id,
            },
          },
        ]);
      }
    } catch (err) {
      console.error(
        `[send-nudges] Push notification failed for customer ${profile.customer_id}:`,
        err
      );
      continue;
    }

    // Log to ai_nudge_log
    const { error: logError } = await supabase.from('ai_nudge_log').insert({
      customer_id: profile.customer_id,
      tenant_id: profile.tenant_id,
      trigger_type: 'predicted_rebooking',
      sent_at: now.toISOString(),
    } as never);

    if (logError) {
      console.error(
        `[send-nudges] Failed to log nudge for customer ${profile.customer_id}:`,
        logError.message
      );
    }

    nudgesSent++;
    console.log(
      `[send-nudges] Sent rebooking nudge to customer ${profile.customer_id} for ${serviceName} at ${tenantName}`
    );
  }

  console.log(`[send-nudges] Total nudges sent: ${nudgesSent}`);
  return Response.json({ nudgesSent });
}
