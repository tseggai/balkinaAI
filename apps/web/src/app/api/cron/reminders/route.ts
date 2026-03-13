import { createAdminClient } from '@/lib/supabase/server';
import { sendNotification } from '@/lib/notifications/send';

export const runtime = 'nodejs';

function formatTime(time: string, timezone: string): string {
  const [h, m] = time.split(':');
  const d = new Date();
  d.setHours(parseInt(h!, 10), parseInt(m!, 10));
  return d.toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const supabase = createAdminClient();
  const now = new Date();

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, appointment_date, start_time,
      customers(id, name, phone),
      services(name),
      staff(
        id,
        staff_location_assignments(
          tenant_locations(timezone)
        )
      ),
      tenants(name),
      tenant_locations(address, timezone)
    `)
    .in('status', ['confirmed'])
    .gte('appointment_date', now.toISOString().split('T')[0]);

  let sent24hr = 0;
  let sent2hr = 0;

  for (const raw of appointments ?? []) {
    const appt = raw as unknown as {
      id: string;
      appointment_date: string;
      start_time: string;
      customers: { id: string; name: string; phone: string | null };
      services: { name: string };
      staff: { id: string; staff_location_assignments: Array<{ tenant_locations: { timezone: string } | null }> } | null;
      tenants: { name: string };
      tenant_locations: { address: string; timezone: string } | null;
    };
    const tz = appt.staff?.staff_location_assignments?.[0]
      ?.tenant_locations?.timezone
      ?? appt.tenant_locations?.timezone
      ?? 'UTC';

    // Build appointment datetime in UTC
    const [h, m] = appt.start_time.split(':').map(Number);
    const apptDate = new Date(`${appt.appointment_date}T00:00:00`);
    apptDate.setHours(h!, m!, 0, 0);

    const diffMs = apptDate.getTime() - now.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);

    // Check 24hr window (23.5 to 24.5 hours away)
    if (diffHrs >= 23.5 && diffHrs < 24.5) {
      const { data: alreadySent } = await supabase
        .from('appointment_reminders')
        .select('id')
        .eq('appointment_id', appt.id)
        .eq('reminder_type', '24hr')
        .maybeSingle();

      if (!alreadySent) {
        await sendNotification({
          type: 'booking_reminder_24hr',
          appointmentId: appt.id,
          recipientType: 'customer',
          recipientId: appt.customers.id,
          data: {
            customerName: appt.customers.name ?? '',
            serviceName: appt.services.name,
            businessName: appt.tenants.name,
            date: new Date(appt.appointment_date).toLocaleDateString('en-US', {
              timeZone: tz, weekday: 'short', month: 'short', day: 'numeric',
            }),
            time: formatTime(appt.start_time, tz),
            address: appt.tenant_locations?.address ?? '',
          },
        });
        await supabase.from('appointment_reminders').insert({
          appointment_id: appt.id,
          reminder_type: '24hr',
        } as never);
        sent24hr++;
      }
    }

    // Check 2hr window (1.5 to 2.5 hours away)
    if (diffHrs >= 1.5 && diffHrs < 2.5) {
      const { data: alreadySent } = await supabase
        .from('appointment_reminders')
        .select('id')
        .eq('appointment_id', appt.id)
        .eq('reminder_type', '2hr')
        .maybeSingle();

      if (!alreadySent) {
        await sendNotification({
          type: 'booking_reminder_2hr',
          appointmentId: appt.id,
          recipientType: 'customer',
          recipientId: appt.customers.id,
          data: {
            customerName: appt.customers.name ?? '',
            serviceName: appt.services.name,
            businessName: appt.tenants.name,
            time: formatTime(appt.start_time, tz),
            address: appt.tenant_locations?.address ?? '',
          },
        });
        await supabase.from('appointment_reminders').insert({
          appointment_id: appt.id,
          reminder_type: '2hr',
        } as never);
        sent2hr++;
      }
    }
  }

  return Response.json({ sent24hr, sent2hr });
}
