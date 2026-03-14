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
}

export interface SmsResult {
  sid: string;
  status: string;
}

/**
 * Send an SMS message via Twilio.
 */
export async function sendSms({ to, body }: SendSmsParams): Promise<SmsResult> {
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!from) {
    throw new Error('TWILIO_PHONE_NUMBER not configured');
  }
  const client = getTwilioClient();
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
