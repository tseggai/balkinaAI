import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();

  // Fetch all completed appointments with the fields we need
  const { data: appointments, error } = await supabase
    .from('appointments')
    .select('customer_id, tenant_id, service_id, start_time')
    .eq('status', 'completed')
    .order('start_time', { ascending: true });

  if (error) {
    console.error('[behavior-analysis] Failed to fetch appointments:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Group appointments by (customer_id, tenant_id, service_id)
  const groups = new Map<string, { customer_id: string; tenant_id: string; service_id: string; times: Date[] }>();

  for (const raw of appointments ?? []) {
    const appt = raw as { customer_id: string; tenant_id: string; service_id: string; start_time: string };
    const key = `${appt.customer_id}:${appt.tenant_id}:${appt.service_id}`;
    if (!groups.has(key)) {
      groups.set(key, {
        customer_id: appt.customer_id,
        tenant_id: appt.tenant_id,
        service_id: appt.service_id,
        times: [],
      });
    }
    groups.get(key)!.times.push(new Date(appt.start_time));
  }

  let updatedCount = 0;

  for (const group of groups.values()) {
    // Need at least 2 appointments to calculate an interval
    if (group.times.length < 2) continue;

    // Times are already sorted ascending from the query
    const intervals: number[] = [];
    for (let i = 1; i < group.times.length; i++) {
      const diffMs = group.times[i]!.getTime() - group.times[i - 1]!.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      intervals.push(diffDays);
    }

    const avgIntervalDays = Math.round(
      intervals.reduce((sum, d) => sum + d, 0) / intervals.length
    );

    const lastBookingDate = group.times[group.times.length - 1]!;
    const predictedNextDate = new Date(
      lastBookingDate.getTime() + avgIntervalDays * 24 * 60 * 60 * 1000
    );

    // Upsert into customer_behavior_profiles
    const { error: upsertError } = await supabase
      .from('customer_behavior_profiles')
      .upsert(
        {
          customer_id: group.customer_id,
          tenant_id: group.tenant_id,
          service_id: group.service_id,
          avg_interval_days: avgIntervalDays,
          last_booking_date: lastBookingDate.toISOString().split('T')[0],
          predicted_next_date: predictedNextDate.toISOString().split('T')[0],
        } as never,
        { onConflict: 'customer_id,tenant_id,service_id' }
      );

    if (upsertError) {
      console.error(
        `[behavior-analysis] Upsert failed for ${group.customer_id}/${group.tenant_id}/${group.service_id}:`,
        upsertError.message
      );
      continue;
    }

    updatedCount++;
  }

  console.log(`[behavior-analysis] Updated ${updatedCount} behavior profiles`);
  return Response.json({ profilesUpdated: updatedCount });
}
