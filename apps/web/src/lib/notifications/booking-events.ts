import { createAdminClient } from '@/lib/supabase/server';
import { sendNotification } from './send';

interface AppointmentContext {
  id: string;
  start_time: string;
  end_time: string;
  total_price: number;
  customer_id: string | null;
  customers: { id: string; display_name: string | null; phone: string | null } | null;
  services: { id: string; name: string; duration_minutes: number };
  staff: {
    id: string;
    name: string;
    phone: string | null;
    requires_approval: boolean;
  } | null;
  tenants: { id: string; name: string };
  tenant_locations: { address: string; timezone: string } | null;
}

async function getAppointmentContext(appointmentId: string): Promise<AppointmentContext | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('appointments')
    .select(`
      id, start_time, end_time, total_price, customer_id,
      customers(id, display_name, phone),
      services(id, name, duration_minutes),
      staff(id, name, phone, requires_approval),
      tenants(id, name),
      tenant_locations(address, timezone)
    `)
    .eq('id', appointmentId)
    .single();
  if (error) {
    console.error('[notifications] getAppointmentContext error:', error.message);
    return null;
  }
  const ctx = data as unknown as AppointmentContext | null;
  if (ctx && !ctx.customers && ctx.customer_id) {
    console.error(`[notifications] getAppointmentContext: customer join returned null for appointment ${appointmentId}, customer_id=${ctx.customer_id}. Attempting direct lookup.`);
    // Fallback: try direct customer lookup if the join failed
    const { data: customer } = await supabase
      .from('customers')
      .select('id, display_name, phone')
      .eq('id', ctx.customer_id)
      .single();
    if (customer) {
      ctx.customers = customer as { id: string; display_name: string | null; phone: string | null };
    } else {
      console.error(`[notifications] getAppointmentContext: direct customer lookup also failed for customer_id=${ctx.customer_id}`);
    }
  }
  return ctx;
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

/** Customer notification when booking is auto-confirmed (no approval needed) */
export async function notifyBookingConfirmed(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) { console.error('[notifications] notifyBookingConfirmed: no context for', appointmentId); return; }
  if (!ctx.customers) { console.error('[notifications] notifyBookingConfirmed: no customer data for', appointmentId); return; }
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
      staffName: ctx.staff?.name ?? '',
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
}

/** Customer notification when booking requires approval (submitted, pending) */
export async function notifyBookingSubmitted(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) { console.error('[notifications] notifyBookingSubmitted: no context for', appointmentId); return; }
  if (!ctx.customers) { console.error('[notifications] notifyBookingSubmitted: no customer data for', appointmentId); return; }
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  await sendNotification({
    type: 'booking_submitted',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      businessName: ctx.tenants.name,
      staffName: ctx.staff?.name ?? '',
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
}

/** Staff notification when a new booking is assigned to them */
export async function notifyStaffNewBooking(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx || !ctx.staff) return;
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  await sendNotification({
    type: 'new_booking_assigned',
    appointmentId,
    recipientType: 'staff',
    recipientId: ctx.staff.id,
    data: {
      customerName: ctx.customers?.display_name ?? '',
      serviceName: ctx.services.name,
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
      requiresApproval: ctx.staff.requires_approval ? 1 : 0,
    },
  });
}

/** Customer notification when staff approves a pending booking */
export async function notifyBookingApproved(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) { console.error('[notifications] notifyBookingApproved: no context for', appointmentId); return; }
  if (!ctx.customers) { console.error('[notifications] notifyBookingApproved: no customer data for', appointmentId); return; }
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
      staffName: ctx.staff?.name ?? '',
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
}

/** Customer notification when staff declines a pending booking */
export async function notifyBookingDeclined(appointmentId: string, suggestedTime?: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) { console.error('[notifications] notifyBookingDeclined: no context for', appointmentId); return; }
  if (!ctx.customers) { console.error('[notifications] notifyBookingDeclined: no customer data for', appointmentId); return; }
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
      staffName: ctx.staff?.name ?? '',
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
      suggestedDate: suggestedTime ? formatDate(suggestedTime, tz) : '',
      suggestedTime: suggestedTime ? formatTime(suggestedTime, tz) : '',
      suggestedTimeIso: suggestedTime ?? '',
    },
  });
}

/** Customer notification when marked as no-show */
export async function notifyBookingNoShow(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) { console.error('[notifications] notifyBookingNoShow: no context for', appointmentId); return; }
  if (!ctx.customers) { console.error('[notifications] notifyBookingNoShow: no customer data for', appointmentId); return; }
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  await sendNotification({
    type: 'booking_no_show',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      businessName: ctx.tenants.name,
      staffName: ctx.staff?.name ?? '',
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
}

/** Customer notification when appointment is marked as completed */
export async function notifyBookingCompleted(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) { console.error('[notifications] notifyBookingCompleted: no context for', appointmentId); return; }
  if (!ctx.customers) { console.error('[notifications] notifyBookingCompleted: no customer data for', appointmentId); return; }
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  const staffFirstName = (ctx.staff?.name ?? '').split(' ')[0] || 'your stylist';
  await sendNotification({
    type: 'booking_completed',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      businessName: ctx.tenants.name,
      staffName: ctx.staff?.name ?? '',
      staffFirstName,
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
}

export async function notifyBookingCancelledByCustomer(appointmentId: string) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) { console.error('[notifications] notifyBookingCancelledByCustomer: no context for', appointmentId); return; }
  if (!ctx.customers) { console.error('[notifications] notifyBookingCancelledByCustomer: no customer data for', appointmentId); return; }
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
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
  if (!ctx) { console.error('[notifications] notifyBookingCancelledByTenant: no context for', appointmentId); return; }
  if (!ctx.customers) { console.error('[notifications] notifyBookingCancelledByTenant: no customer data for', appointmentId); return; }
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  // Notify customer
  await sendNotification({
    type: 'booking_cancelled_by_tenant',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      businessName: ctx.tenants.name,
      staffName: ctx.staff?.name ?? '',
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
    },
  });
  // Notify assigned staff that appointment was cancelled by tenant admin
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

/** Customer notification when booking is approved and deposit payment is needed */
export async function notifyDepositPaymentRequired(appointmentId: string, depositAmount: number) {
  const ctx = await getAppointmentContext(appointmentId);
  if (!ctx) { console.error('[notifications] notifyDepositPaymentRequired: no context for', appointmentId); return; }
  if (!ctx.customers) { console.error('[notifications] notifyDepositPaymentRequired: no customer data for', appointmentId); return; }
  const tz = ctx.tenant_locations?.timezone ?? 'UTC';
  await sendNotification({
    type: 'deposit_payment_required',
    appointmentId,
    recipientType: 'customer',
    recipientId: ctx.customers.id,
    data: {
      customerName: ctx.customers.display_name ?? '',
      serviceName: ctx.services.name,
      businessName: ctx.tenants.name,
      staffName: ctx.staff?.name ?? '',
      date: formatDate(ctx.start_time, tz),
      time: formatTime(ctx.start_time, tz),
      depositAmount: depositAmount.toFixed(2),
    },
  });
}
