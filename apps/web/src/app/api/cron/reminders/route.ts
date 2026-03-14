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

  // Fetch confirmed appointments in the next 25 hours
  const horizon = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

  const { data: appointments } = await supabase
    .from('appointments')
    .select(`
      id, start_time,
      customers(id, display_name, phone),
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
    .gte('start_time', now.toISOString())
    .lte('start_time', horizon);

  let sent24hr = 0;
  let sent2hr = 0;

  for (const raw of appointments ?? []) {
    const appt = raw as unknown as {
      id: string;
      start_time: string;
      customers: { id: string; display_name: string | null; phone: string | null };
      services: { name: string };
      staff: { id: string; staff_location_assignments: Array<{ tenant_locations: { timezone: string } | null }> } | null;
      tenants: { name: string };
      tenant_locations: { address: string; timezone: string } | null;
    };
    const tz = appt.staff?.staff_location_assignments?.[0]
      ?.tenant_locations?.timezone
      ?? appt.tenant_locations?.timezone
      ?? 'UTC';

    const apptTime = new Date(appt.start_time);
    const diffMs = apptTime.getTime() - now.getTime();
    const diffHrs = diffMs / (1000 * 60 * 60);

    const formattedDate = apptTime.toLocaleDateString('en-US', {
      timeZone: tz, weekday: 'short', month: 'short', day: 'numeric',
    });
    const formattedTime = apptTime.toLocaleTimeString('en-US', {
      timeZone: tz, hour: 'numeric', minute: '2-digit', hour12: true,
    });

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
            customerName: appt.customers.display_name ?? '',
            serviceName: appt.services.name,
            businessName: appt.tenants.name,
            date: formattedDate,
            time: formattedTime,
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
            customerName: appt.customers.display_name ?? '',
            serviceName: appt.services.name,
            businessName: appt.tenants.name,
            time: formattedTime,
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
