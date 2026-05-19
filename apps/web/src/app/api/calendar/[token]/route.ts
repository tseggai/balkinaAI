import { createAdminClient } from '@/lib/supabase/server';
import { createEvents, type EventAttributes } from 'ics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token)) {
    return new Response('Invalid token', { status: 400 });
  }

  const supabase = createAdminClient();

  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, tenant_id')
    .eq('ical_feed_token', token)
    .single();

  if (!staff) {
    return new Response('Calendar not found', { status: 404 });
  }

  const s = staff as { id: string; name: string; tenant_id: string };

  const { data: tenant } = await supabase
    .from('tenants')
    .select('name')
    .eq('id', s.tenant_id)
    .single();

  const tenantName = (tenant as { name: string } | null)?.name ?? 'Balkina AI';

  const now = new Date();
  const pastDate = new Date(now);
  pastDate.setDate(pastDate.getDate() - 30);
  const futureDate = new Date(now);
  futureDate.setDate(futureDate.getDate() + 90);

  const { data: appointments } = await supabase
    .from('appointments')
    .select('id, start_time, end_time, status, services(name), customers(display_name)')
    .eq('staff_id', s.id)
    .in('status', ['confirmed', 'approved', 'pending', 'completed'])
    .gte('start_time', pastDate.toISOString())
    .lte('start_time', futureDate.toISOString())
    .order('start_time');

  const events: EventAttributes[] = ((appointments ?? []) as {
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    services: { name: string } | { name: string }[] | null;
    customers: { display_name: string } | { display_name: string }[] | null;
  }[]).map((appt) => {
    const svc = Array.isArray(appt.services) ? appt.services[0] : appt.services;
    const cust = Array.isArray(appt.customers) ? appt.customers[0] : appt.customers;
    const start = new Date(appt.start_time);
    const end = new Date(appt.end_time);

    return {
      uid: `${appt.id}@balkina.ai`,
      start: [start.getUTCFullYear(), start.getUTCMonth() + 1, start.getUTCDate(), start.getUTCHours(), start.getUTCMinutes()] as [number, number, number, number, number],
      end: [end.getUTCFullYear(), end.getUTCMonth() + 1, end.getUTCDate(), end.getUTCHours(), end.getUTCMinutes()] as [number, number, number, number, number],
      startOutputType: 'utc' as const,
      endOutputType: 'utc' as const,
      title: svc?.name ?? 'Appointment',
      description: cust?.display_name ? `Client: ${cust.display_name}` : undefined,
      status: appt.status === 'confirmed' || appt.status === 'approved' ? 'CONFIRMED' as const : 'TENTATIVE' as const,
      productId: 'balkina-ai/ical',
      calName: `${s.name} — ${tenantName}`,
    };
  });

  const { error, value } = createEvents(events);

  if (error || !value) {
    return new Response('Error generating calendar', { status: 500 });
  }

  return new Response(value, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${s.name.replace(/[^a-zA-Z0-9]/g, '_')}.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
