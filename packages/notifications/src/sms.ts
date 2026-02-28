/**
 * SMS notifications via Twilio.
 * Used for booking confirmations, reminders, and OTP.
 */
import twilio from 'twilio';
import { serverEnv } from '@balkina/config';

export const twilioClient = twilio(
  serverEnv.TWILIO_ACCOUNT_SID,
  serverEnv.TWILIO_AUTH_TOKEN
);

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
  const message = await twilioClient.messages.create({
    from: serverEnv.TWILIO_PHONE_NUMBER,
    to,
    body,
  });

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
    body: `✅ Confirmed: ${serviceName} at ${tenantName} on ${startTime}. Manage via Balkina AI app.`,
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
    body: `⏰ Reminder: ${serviceName} at ${tenantName} tomorrow at ${startTime}. ID: ${appointmentId}`,
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
