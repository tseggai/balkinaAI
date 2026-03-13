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

  const { data: allStaff } = await supabase
    .from('staff')
    .select(`
      id, name, notify_push,
      staff_location_assignments(
        tenant_locations(timezone)
      )
    `)
    .eq('is_active', true);

  let sent = 0;

  for (const raw of allStaff ?? []) {
    const staffMember = raw as unknown as {
      id: string;
      name: string;
      notify_push: boolean | null;
      staff_location_assignments: Array<{ tenant_locations: { timezone: string } | null }>;
    };
    const timezone = staffMember.staff_location_assignments?.[0]
      ?.tenant_locations?.timezone ?? 'UTC';

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

    // Count today's appointments
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('staff_id', staffMember.id)
      .eq('appointment_date', today)
      .in('status', ['confirmed', 'pending']);

    if (!count || count === 0) continue;

    // Get first appointment time
    const { data: firstAppt } = await supabase
      .from('appointments')
      .select('start_time')
      .eq('staff_id', staffMember.id)
      .eq('appointment_date', today)
      .in('status', ['confirmed', 'pending'])
      .order('start_time', { ascending: true })
      .limit(1)
      .single();

    const firstTime = firstAppt
      ? new Date(`1970-01-01T${(firstAppt as { start_time: string }).start_time}`)
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
