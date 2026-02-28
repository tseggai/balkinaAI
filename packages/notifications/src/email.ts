/**
 * Email notifications via Resend.
 * Templates live in /packages/email-templates (future package).
 */
import { Resend } from 'resend';
import { serverEnv } from '@balkina/config';

export const resend = new Resend(serverEnv.RESEND_API_KEY);

export interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  replyTo?: string;
}

export interface EmailResult {
  id: string;
}

/**
 * Send a transactional email via Resend.
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
  replyTo,
}: SendEmailParams): Promise<EmailResult> {
  const { data, error } = await resend.emails.send({
    from: serverEnv.RESEND_FROM_EMAIL,
    to: Array.isArray(to) ? to : [to],
    subject,
    html,
    text,
    reply_to: replyTo,
  });

  if (error || !data) {
    throw new Error(`Failed to send email: ${error?.message ?? 'Unknown error'}`);
  }

  return { id: data.id };
}

/**
 * Send appointment confirmation email to customer.
 */
export async function sendBookingConfirmationEmail(params: {
  customerEmail: string;
  customerName: string;
  serviceName: string;
  tenantName: string;
  startTime: string;
  locationAddress: string;
  appointmentId: string;
}): Promise<EmailResult> {
  const { customerEmail, customerName, serviceName, tenantName, startTime, locationAddress, appointmentId } = params;

  return sendEmail({
    to: customerEmail,
    subject: `Booking confirmed: ${serviceName} at ${tenantName}`,
    html: `
      <h2>Your appointment is confirmed!</h2>
      <p>Hi ${customerName},</p>
      <p>Your <strong>${serviceName}</strong> appointment at <strong>${tenantName}</strong> is confirmed.</p>
      <ul>
        <li><strong>When:</strong> ${startTime}</li>
        <li><strong>Where:</strong> ${locationAddress}</li>
        <li><strong>Booking ID:</strong> ${appointmentId}</li>
      </ul>
      <p>You can manage your booking through the Balkina AI app.</p>
    `,
  });
}
