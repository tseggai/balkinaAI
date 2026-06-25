/**
 * SMS notifications via Twilio.
 * Used for booking confirmations, reminders, and OTP.
 */
import twilio from 'twilio';

let _client: ReturnType<typeof twilio> | null = null;

function getTwilioClient() {
  if (_client) return _client;
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) {
    throw new Error('Twilio credentials not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN)');
  }
  _client = twilio(sid, token);
  return _client;
}

/** @deprecated Use getTwilioClient() for lazy initialization */
export const twilioClient = null as unknown as ReturnType<typeof twilio>;

export interface SendSmsParams {
  to: string;
  body: string;
  /** Delivery channel. 'whatsapp' routes via Twilio's WhatsApp sender. */
  channel?: 'sms' | 'whatsapp';
}

export interface SmsResult {
  sid: string;
  status: string;
}

/**
 * Send an SMS or WhatsApp message via Twilio.
 *
 * WhatsApp requires a WhatsApp-enabled sender (TWILIO_WHATSAPP_NUMBER, falling
 * back to TWILIO_PHONE_NUMBER) and — for business-initiated messages outside the
 * 24h customer-care window — an approved message template.
 */
export async function sendSms({ to, body, channel = 'sms' }: SendSmsParams): Promise<SmsResult> {
  const client = getTwilioClient();

  if (channel === 'whatsapp') {
    const waFrom = process.env.TWILIO_WHATSAPP_NUMBER || process.env.TWILIO_PHONE_NUMBER;
    if (!waFrom) {
      throw new Error('TWILIO_WHATSAPP_NUMBER not configured');
    }
    const message = await client.messages.create({
      from: waFrom.startsWith('whatsapp:') ? waFrom : `whatsapp:${waFrom}`,
      to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
      body,
    });
    return { sid: message.sid, status: message.status };
  }

  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error('TWILIO_PHONE_NUMBER not configured');
  }
  const message = await client.messages.create({ from, to, body });
  return { sid: message.sid, status: message.status };
}

/**
 * Send a booking confirmation SMS.
 */
export async function sendBookingConfirmationSms(params: {
  customerPhone: string;
  serviceName: string;
  tenantName: string;
  startTime: string;
}): Promise<SmsResult> {
  const { customerPhone, serviceName, tenantName, startTime } = params;
  return sendSms({
    to: customerPhone,
    body: `Confirmed: ${serviceName} at ${tenantName} on ${startTime}. Manage via Balkina AI app.`,
  });
}

/**
 * Send a 24-hour reminder SMS.
 */
export async function sendAppointmentReminderSms(params: {
  customerPhone: string;
  serviceName: string;
  tenantName: string;
  startTime: string;
  appointmentId: string;
}): Promise<SmsResult> {
  const { customerPhone, serviceName, tenantName, startTime, appointmentId } = params;
  return sendSms({
    to: customerPhone,
    body: `Reminder: ${serviceName} at ${tenantName} tomorrow at ${startTime}. ID: ${appointmentId}`,
  });
}

/**
 * Send a one-time password SMS for phone verification.
 */
export async function sendOtpSms(phone: string, otp: string): Promise<SmsResult> {
  return sendSms({
    to: phone,
    body: `Your Balkina AI verification code is: ${otp}. Expires in 10 minutes.`,
  });
}
