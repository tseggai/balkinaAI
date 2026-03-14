import { createAdminClient } from '@/lib/supabase/server';
import { sendNotification } from '@/lib/notifications/send';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  // Get all active staff with their tenant's timezone
  const { data: allStaff } = await supabase
    .from('staff')
    .select(`
      id, name, tenant_id, notify_push
    `)
    .eq('is_active', true);

  let sent = 0;

  for (const raw of allStaff ?? []) {
    const staffMember = raw as unknown as {
      id: string;
      name: string;
      tenant_id: string;
      notify_push: boolean | null;
    };

    // Get timezone from tenant's location
    const { data: locData } = await supabase
      .from('tenant_locations')
      .select('timezone')
      .eq('tenant_id', staffMember.tenant_id)
      .limit(1)
      .maybeSingle();
    const timezone = (locData as { timezone: string } | null)?.timezone ?? 'UTC';

    // Check if it is currently 7am in this staff member's timezone
    const localHour = parseInt(
      now.toLocaleString('en-US', {
        timeZone: timezone,
        hour: 'numeric',
        hour12: false,
      }),
      10,
    );
    if (localHour !== 7) continue;

    // Get today's date string in their timezone
    const today = now.toLocaleDateString('en-CA', { timeZone: timezone });
    const dayStartUtc = new Date(`${today}T00:00:00Z`);
    const dayEndUtc = new Date(`${today}T23:59:59Z`);

    // Check notification_log — no daily summary sent today for this staff
    const { data: alreadySent } = await supabase
      .from('notification_log')
      .select('id')
      .eq('recipient_id', staffMember.id)
      .eq('notification_type', 'daily_schedule_summary')
      .gte('sent_at', `${today}T00:00:00Z`)
      .limit(1)
      .maybeSingle();

    if (alreadySent) continue;

    // Count today's appointments using start_time range
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffMember.id)
      .gte('start_time', dayStartUtc.toISOString())
      .lte('start_time', dayEndUtc.toISOString())
      .in('status', ['confirmed', 'pending']);

    if (!count || count === 0) continue;

    // Get first appointment time
    const { data: firstAppt } = await supabase
      .from('appointments')
      .select('start_time')
      .eq('staff_id', staffMember.id)
      .gte('start_time', dayStartUtc.toISOString())
      .lte('start_time', dayEndUtc.toISOString())
      .in('status', ['confirmed', 'pending'])
      .order('start_time', { ascending: true })
      .limit(1)
      .single();

    const firstTime = firstAppt
      ? new Date((firstAppt as { start_time: string }).start_time)
          .toLocaleTimeString('en-US', {
            timeZone: timezone,
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
          })
      : '';

    await sendNotification({
      type: 'daily_schedule_summary',
      recipientType: 'staff',
      recipientId: staffMember.id,
      data: {
        staffName: staffMember.name,
        appointmentCount: count,
        firstAppointmentTime: firstTime,
      },
    });

    sent++;
  }

  return Response.json({ sent });
}
