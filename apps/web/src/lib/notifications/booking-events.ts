import { createAdminClient } from '@/lib/supabase/server';
import { sendNotification } from './send';

interface AppointmentContext {
  id: string;
  start_time: string;
  end_time: string;
  total_price: number;
  customers: { id: string; display_name: string | null; phone: string | null };
  services: { id: string; name: string; duration_minutes: number };
  staff: {
    id: string;
    name: string;
    phone: string | null;
    requires_approval: boolean;
    staff_location_assignments: Array<{
      tenant_locations: { timezone: string } | null;
    }>;
  } | null;
  tenants: { id: string; name: string };
  tenant_locations: { address: string; timezone: string } | null;
}

async function getAppointmentContext(appointmentId: string): Promise<AppointmentContext | null> {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('appointments')
    .select(`
      id, start_time, end_time, total_price,
      customers(id, display_name, phone),
      services(id, name, duration_minutes),
      staff(id, name, phone, requires_approval,
        staff_location_assignments(
          tenant_locations(timezone)
        )
      ),
      tenants(id, name),
      tenant_locations(address, timezone)
    `)
    .eq('id', appointmentId)
    .single();
  return data as unknown as AppointmentContext | null;
}

function formatDate(iso: string, timezone: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: timezone,
    weekday: 'short', month: 'short', day: 'numeric',
  });
}

function formatTime(iso: string, timezone: string): string {
  return new Date(iso).toLocaleTimeString('en-US', {
    timeZone: timezone,
    hour: 'numeric', minute: '2-digit', hour12: true,
  });
}

export async function notifyBookingConfirmed(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) return;
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  await sendNotification({
    type: 'booking_confirmed',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      businessName: ctx.tenants.name,
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
}

export async function notifyStaffNewBooking(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx || !ctx.staff) return;
  const tz = ctx.staff.staff_location_assignments?.[0]
    ?.tenant_locations?.timezone ?? 'UTC';
  await sendNotification({
    type: 'new_booking_assigned',
    appointmentId,
    recipientType: 'staff',
    recipientId: ctx.staff.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
      requiresApproval: ctx.staff.requires_approval ? 1 : 0,
    },
  });
}

export async function notifyBookingApproved(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) return;
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  await sendNotification({
    type: 'booking_approved',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      businessName: ctx.tenants.name,
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
}

export async function notifyBookingDeclined(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) return;
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  await sendNotification({
    type: 'booking_declined',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      businessName: ctx.tenants.name,
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
}

export async function notifyBookingCancelledByCustomer(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) return;
  const tz = ctx.staff?.staff_location_assignments?.[0]
    ?.tenant_locations?.timezone ?? ctx.tenant_locations?.timezone ?? 'UTC';
  // Notify customer (confirmation)
  await sendNotification({
    type: 'booking_cancelled_by_customer',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
  // Notify staff
  if (ctx.staff) {
    await sendNotification({
      type: 'booking_cancelled_staff_notify',
      appointmentId,
      recipientType: 'staff',
      recipientId: ctx.staff.id,
      data: {
        customerName: ctx.customers.display_name ?? '',
        serviceName: ctx.services.name,
        date: formatDate(ctx.start_time, tz),
        time: formatTime(ctx.start_time, tz),
      },
    });
  }
}

export async function notifyBookingCancelledByTenant(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) return;
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  await sendNotification({
    type: 'booking_cancelled_by_tenant',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      businessName: ctx.tenants.name,
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
}
