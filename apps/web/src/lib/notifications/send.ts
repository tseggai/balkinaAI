import { createAdminClient } from '@/lib/supabase/server';

/** Normalize phone to E.164 format for Twilio. */
function normalizePhone(raw: string): string {
  // Strip all non-digit characters except leading +
  const cleaned = raw.replace(/[^\d+]/g, '');
  // If it starts with +, keep it as-is (already E.164)
  if (cleaned.startsWith('+')) return cleaned;
  // If it's 10 digits (US), prepend +1
  if (cleaned.length === 10) return `+1${cleaned}`;
  // If it's 11 digits starting with 1 (US with country code), prepend +
  if (cleaned.length === 11 && cleaned.startsWith('1')) return `+${cleaned}`;
  // Otherwise prepend + and hope for the best
  return `+${cleaned}`;
}

export type NotificationType =
  | 'booking_confirmed'
  | 'booking_submitted'
  | 'booking_cancelled_by_customer'
  | 'booking_cancelled_by_tenant'
  | 'booking_reminder_24hr'
  | 'booking_reminder_2hr'
  | 'booking_approved'
  | 'booking_declined'
  | 'booking_no_show'
  | 'new_booking_assigned'
  | 'booking_completed'
  | 'booking_cancelled_staff_notify'
  | 'daily_schedule_summary'
  | 'deposit_payment_required';

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
    sms: (d) => `Hi ${d.customerName}, your ${d.serviceName} appointment at ${d.businessName} with ${d.staffName} for ${d.date} at ${d.time} is confirmed. See you then!`,
    push: {
      title: () => 'Booking Confirmed',
      body: (d) => `Your ${d.serviceName} appointment at ${d.businessName} with ${d.staffName} for ${d.date} at ${d.time} is confirmed.`,
    },
  },
  booking_submitted: {
    sms: (d) => `Your appointment request for a ${d.serviceName} at ${d.businessName} with ${d.staffName} for ${d.date} at ${d.time} has been submitted.`,
    push: {
      title: () => 'Appointment Request Submitted',
      body: (d) => `Your appointment request for a ${d.serviceName} at ${d.businessName} with ${d.staffName} for ${d.date} at ${d.time} has been submitted.`,
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
    sms: (d) => `Appointment Approved: ${d.staffName} has approved your appointment request for a ${d.serviceName} at ${d.businessName} for ${d.date} at ${d.time}.`,
    push: {
      title: () => 'Appointment Approved',
      body: (d) => `${d.staffName} has approved your appointment request for a ${d.serviceName} at ${d.businessName} for ${d.date} at ${d.time}.`,
    },
  },
  booking_declined: {
    sms: (d) => d.suggestedTime
      ? `Appointment Reschedule: ${d.staffName} at ${d.businessName} can accommodate your ${d.serviceName} appointment for ${d.suggestedDate} at ${d.suggestedTime} instead of your requested ${d.date} at ${d.time}.`
      : `Appointment Update: ${d.staffName} at ${d.businessName} was unable to accommodate your ${d.serviceName} appointment for ${d.date} at ${d.time}. Please try another time.`,
    push: {
      title: (d) => d.suggestedTime ? 'Appointment Reschedule' : 'Appointment Update',
      body: (d) => d.suggestedTime
        ? `${d.staffName} at ${d.businessName} can accommodate your ${d.serviceName} appointment for ${d.suggestedDate} at ${d.suggestedTime} instead of your requested ${d.date} at ${d.time}.`
        : `${d.staffName} at ${d.businessName} was unable to accommodate your ${d.serviceName} appointment for ${d.date} at ${d.time}.`,
    },
  },
  booking_no_show: {
    sms: (d) => `You didn't make it to your ${d.serviceName} appointment with ${d.staffName} at ${d.businessName} for ${d.date} at ${d.time}. Would you like to book a new one?`,
    push: {
      title: () => 'Missed Appointment',
      body: (d) => `You didn't make it to your ${d.serviceName} appointment with ${d.staffName} at ${d.businessName} for ${d.date} at ${d.time}.`,
    },
  },
  booking_completed: {
    sms: (d) => `Appointment Completed: Your ${d.serviceName} appointment with ${d.staffName} at ${d.businessName} is complete. Show ${d.staffFirstName} your appreciation by rating your experience on the Balkina app.`,
    push: {
      title: () => 'Appointment Completed',
      body: (d) => `Show ${d.staffFirstName} your appreciation by rating your ${d.serviceName} experience at ${d.businessName}.`,
    },
  },
  new_booking_assigned: {
    sms: (d) => `New Appointment: ${d.customerName} requested to book a ${d.serviceName} appointment for ${d.date} at ${d.time}.${d.requiresApproval ? ' Tap to approve or decline.' : ''}`,
    push: {
      title: () => 'New Appointment',
      body: (d) => `${d.customerName} requested to book a ${d.serviceName} appointment for ${d.date} at ${d.time}.`,
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
  deposit_payment_required: {
    sms: (d) => `Your ${d.serviceName} at ${d.businessName} for ${d.date} at ${d.time} has been approved! Please pay the $${d.depositAmount} deposit to complete your booking.`,
    push: {
      title: () => 'Deposit Payment Required',
      body: (d) => `Your ${d.serviceName} at ${d.businessName} for ${d.date} at ${d.time} is approved! Tap to pay the $${d.depositAmount} deposit.`,
    },
  },
};

export async function sendNotification(payload: NotificationPayload): Promise<void> {
  const supabase = createAdminClient();
  const tag = `[notifications:${payload.type}]`;

  let phone: string | null = null;
  let pushTokens: string[] = [];
  let notifySms = true;
  let notifyPush = true;

  if (payload.recipientType === 'customer') {
    const { data: customer, error: custErr } = await supabase
      .from('customers')
      .select('phone, notify_sms, notify_push')
      .eq('id', payload.recipientId)
      .single();
    if (custErr || !customer) {
      console.error(`${tag} customer lookup failed for ${payload.recipientId}:`, custErr?.message ?? 'not found');
      return;
    }
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
    const { data: staffMember, error: staffErr } = await supabase
      .from('staff')
      .select('phone, notify_sms, notify_push')
      .eq('id', payload.recipientId)
      .single();
    if (staffErr || !staffMember) {
      console.error(`${tag} staff lookup failed for ${payload.recipientId}:`, staffErr?.message ?? 'not found');
      return;
    }
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

  console.log(`${tag} recipient=${payload.recipientType}:${payload.recipientId} phone=${phone ? 'yes' : 'no'} pushTokens=${pushTokens.length} smsEnabled=${notifySms} pushEnabled=${notifyPush}`);

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

  // Send SMS
  const smsBody = template.sms(payload.data);
  if (notifySms && phone && smsBody.length > 0) {
    try {
      const normalized = normalizePhone(phone);
      console.log(`${tag} SMS sending to raw="${phone}" normalized="${normalized}" body="${smsBody.slice(0, 80)}..."`);
      const { sendSms } = await import('@balkina/notifications');
      await sendSms({ to: normalized, body: smsBody });
      console.log(`${tag} SMS sent successfully to ${normalized}`);
      await logEntry('sms', 'sent');
    } catch (err) {
      console.error(`${tag} SMS failed:`, err);
      await logEntry('sms', 'failed', String(err));
    }
  } else {
    const reason = !notifySms ? 'sms disabled' : !phone ? 'no phone number' : 'empty sms body';
    console.log(`${tag} SMS skipped: ${reason}`);
  }

  // Send Push
  if (notifyPush && pushTokens.length > 0) {
    try {
      const { sendPushNotification } = await import('@balkina/notifications');
      for (const token of pushTokens) {
        try {
          const pushData: Record<string, unknown> = { appointmentId: payload.appointmentId, type: payload.type };
          // Pass extra data for actionable notifications
          if (payload.data.suggestedTime) pushData.suggestedTime = payload.data.suggestedTime;
          if (payload.data.suggestedDate) pushData.suggestedDate = payload.data.suggestedDate;
          if (payload.data.suggestedTimeIso) pushData.suggestedTimeIso = payload.data.suggestedTimeIso;
          await sendPushNotification([{
            pushToken: token,
            title: template.push.title(payload.data),
            body: template.push.body(payload.data),
            data: pushData,
          }]);
          console.log(`${tag} push sent to token ${token.slice(0, 20)}...`);
          await logEntry('push', 'sent');
        } catch (err) {
          console.error(`${tag} push failed for token ${token.slice(0, 20)}...:`, err);
          await logEntry('push', 'failed', String(err));
        }
      }
    } catch (err) {
      console.error(`${tag} push import/init failed:`, err);
      await logEntry('push', 'failed', String(err));
    }
  } else {
    const reason = !notifyPush ? 'push disabled' : 'no push tokens registered';
    console.log(`${tag} push skipped: ${reason}`);
  }
}
