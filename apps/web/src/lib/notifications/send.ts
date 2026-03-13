import { createAdminClient } from '@/lib/supabase/server';

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_cancelled_by_customer'
  | 'booking_cancelled_by_tenant'
  | 'booking_reminder_24hr'
  | 'booking_reminder_2hr'
  | 'booking_approved'
  | 'booking_declined'
  | 'new_booking_assigned'
  | 'booking_cancelled_staff_notify'
  | 'daily_schedule_summary';

interface NotificationPayload {
  type: NotificationType;
  appointmentId?: string;
  recipientType: 'customer' | 'staff';
  recipientId: string;
  data: Record<string, string | number>;
}

const TEMPLATES: Record<NotificationType, {
  sms: (d: Record<string, string | number>) => string;
  push: { title: (d: Record<string, string | number>) => string; body: (d: Record<string, string | number>) => string };
}> = {
  booking_confirmed: {
    sms: (d) => `Hi ${d.customerName}, your ${d.serviceName} at ${d.businessName} is confirmed for ${d.date} at ${d.time}. See you then!`,
    push: {
      title: () => 'Booking Confirmed',
      body: (d) => `${d.serviceName} at ${d.businessName} on ${d.date} at ${d.time}`,
    },
  },
  booking_cancelled_by_customer: {
    sms: (d) => `Hi ${d.customerName}, your ${d.serviceName} on ${d.date} at ${d.time} has been cancelled.`,
    push: {
      title: () => 'Booking Cancelled',
      body: (d) => `Your ${d.serviceName} on ${d.date} has been cancelled.`,
    },
  },
  booking_cancelled_by_tenant: {
    sms: (d) => `Hi ${d.customerName}, unfortunately ${d.businessName} has cancelled your ${d.serviceName} on ${d.date} at ${d.time}. Please rebook at your convenience.`,
    push: {
      title: () => 'Appointment Cancelled',
      body: (d) => `${d.businessName} cancelled your ${d.serviceName} on ${d.date}.`,
    },
  },
  booking_reminder_24hr: {
    sms: (d) => `Reminder: ${d.serviceName} at ${d.businessName} tomorrow at ${d.time}. Address: ${d.address}`,
    push: {
      title: () => 'Appointment Tomorrow',
      body: (d) => `${d.serviceName} at ${d.time} — ${d.businessName}`,
    },
  },
  booking_reminder_2hr: {
    sms: () => '',
    push: {
      title: () => 'Appointment in 2 Hours',
      body: (d) => `${d.serviceName} at ${d.time} — ${d.businessName}, ${d.address}`,
    },
  },
  booking_approved: {
    sms: (d) => `Great news! Your ${d.serviceName} at ${d.businessName} on ${d.date} at ${d.time} has been approved.`,
    push: {
      title: () => 'Booking Approved',
      body: (d) => `${d.serviceName} at ${d.businessName} on ${d.date} at ${d.time}`,
    },
  },
  booking_declined: {
    sms: (d) => `Sorry, your ${d.serviceName} request at ${d.businessName} on ${d.date} was not available. Please try another time.`,
    push: {
      title: () => 'Booking Not Available',
      body: (d) => `Your ${d.serviceName} request at ${d.businessName} was declined.`,
    },
  },
  new_booking_assigned: {
    sms: (d) => `New booking: ${d.customerName} — ${d.serviceName} on ${d.date} at ${d.time}.${d.requiresApproval ? ' Tap to approve.' : ''}`,
    push: {
      title: () => 'New Appointment',
      body: (d) => `${d.customerName} booked ${d.serviceName} on ${d.date} at ${d.time}`,
    },
  },
  booking_cancelled_staff_notify: {
    sms: (d) => `Heads up: ${d.customerName} cancelled their ${d.serviceName} on ${d.date} at ${d.time}.`,
    push: {
      title: () => 'Appointment Cancelled',
      body: (d) => `${d.customerName} cancelled ${d.serviceName} on ${d.date} at ${d.time}`,
    },
  },
  daily_schedule_summary: {
    sms: () => '',
    push: {
      title: (d) => `Good morning ${d.staffName}`,
      body: (d) => `You have ${d.appointmentCount} appointment${Number(d.appointmentCount) !== 1 ? 's' : ''} today. First at ${d.firstAppointmentTime}.`,
    },
  },
};

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const supabase = createAdminClient();

  let phone: string | null = null;
  let pushTokens: string[] = [];
  let notifySms = true;
  let notifyPush = true;

  if (payload.recipientType === 'customer') {
    const { data: customer } = await supabase
      .from('customers')
      .select('phone, notify_sms, notify_push')
      .eq('id', payload.recipientId)
      .single();
    if (!customer) return;
    const c = customer as { phone: string | null; notify_sms: boolean | null; notify_push: boolean | null };
    phone = c.phone;
    notifySms = c.notify_sms ?? true;
    notifyPush = c.notify_push ?? true;
    const { data: tokens } = await supabase
      .from('customer_push_tokens')
      .select('token')
      .eq('customer_id', payload.recipientId);
    pushTokens = (tokens as { token: string }[] | null)?.map(t => t.token) ?? [];
  } else {
    const { data: staffMember } = await supabase
      .from('staff')
      .select('phone, notify_sms, notify_push')
      .eq('id', payload.recipientId)
      .single();
    if (!staffMember) return;
    const s = staffMember as { phone: string | null; notify_sms: boolean | null; notify_push: boolean | null };
    phone = s.phone;
    notifySms = s.notify_sms ?? true;
    notifyPush = s.notify_push ?? true;
    const { data: tokens } = await supabase
      .from('staff_push_tokens')
      .select('token')
      .eq('staff_id', payload.recipientId);
    pushTokens = (tokens as { token: string }[] | null)?.map(t => t.token) ?? [];
  }

  const template = TEMPLATES[payload.type];

  const logEntry = (channel: string, status: string, error?: string) =>
    supabase.from('notification_log').insert({
      recipient_type: payload.recipientType,
      recipient_id: payload.recipientId,
      appointment_id: payload.appointmentId ?? null,
      notification_type: payload.type,
      channel,
      status,
      error_text: error ?? null,
    } as never);

  // Send SMS (dynamic import to avoid eager env validation at build time)
  const smsBody = template.sms(payload.data);
  if (notifySms && phone && smsBody.length > 0) {
    try {
      const { sendSms } = await import('@balkina/notifications');
      await sendSms({ to: phone, body: smsBody });
      await logEntry('sms', 'sent');
    } catch (err) {
      await logEntry('sms', 'failed', String(err));
    }
  }

  // Send Push (dynamic import to avoid eager env validation at build time)
  if (notifyPush && pushTokens.length > 0) {
    try {
      const { sendPushNotification } = await import('@balkina/notifications');
      for (const token of pushTokens) {
        try {
          await sendPushNotification([{
            pushToken: token,
            title: template.push.title(payload.data),
            body: template.push.body(payload.data),
            data: { appointmentId: payload.appointmentId, type: payload.type },
          }]);
          await logEntry('push', 'sent');
        } catch (err) {
          await logEntry('push', 'failed', String(err));
        }
      }
    } catch (err) {
      await logEntry('push', 'failed', String(err));
    }
  }
}
