/**
 * Email notifications via Resend.
 * Templates live in /packages/email-templates (future package).
 */
import { Resend } from 'resend';

let _resend: Resend | null = null;

function getResend(): Resend {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  _resend = new Resend(key);
  return _resend;
}

/** @deprecated Use getResend() for lazy initialization */
export const resend = null as unknown as Resend;

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
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) throw new Error('RESEND_FROM_EMAIL not configured');
  const client = getResend();
  const { data, error } = await client.emails.send({
    from: fromEmail,
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

// ─── Tenant lifecycle emails ──────────────────────────────────────────────────

/**
 * Send welcome email to newly registered tenant.
 */
export async function sendTenantWelcomeEmail(params: {
  email: string;
  ownerName: string;
  businessName: string;
}): Promise<EmailResult> {
  const { email, ownerName, businessName } = params;

  return sendEmail({
    to: email,
    subject: `Welcome to Balkina AI, ${businessName}!`,
    html: `
      <h2>Welcome to Balkina AI!</h2>
      <p>Hi ${ownerName},</p>
      <p>Thank you for registering <strong>${businessName}</strong> on Balkina AI.</p>
      <p>To get started, choose a subscription plan that fits your business:</p>
      <ul>
        <li><strong>Starter</strong> — $49/mo, up to 3 staff, 1 location</li>
        <li><strong>Pro</strong> — $99/mo, up to 10 staff, 3 locations, SMS &amp; analytics</li>
        <li><strong>Enterprise</strong> — $199/mo, up to 50 staff, 10 locations, white-label</li>
      </ul>
      <p><a href="https://balkina.ai/onboarding/select-plan">Select your plan &rarr;</a></p>
      <p>If you have any questions, reply to this email or contact us at support@balkina.ai.</p>
    `,
  });
}

/**
 * Send subscription activation confirmation email.
 */
export async function sendSubscriptionActivatedEmail(params: {
  email: string;
  ownerName: string;
  businessName: string;
  planName: string;
}): Promise<EmailResult> {
  const { email, ownerName, businessName, planName } = params;

  return sendEmail({
    to: email,
    subject: `${businessName} — Subscription Activated!`,
    html: `
      <h2>Your subscription is active!</h2>
      <p>Hi ${ownerName},</p>
      <p>Your <strong>${planName}</strong> plan for <strong>${businessName}</strong> is now active.</p>
      <p>Here's what you can do next:</p>
      <ol>
        <li>Add your services and pricing</li>
        <li>Set up your staff members and their availability</li>
        <li>Add your business location(s)</li>
        <li>Start accepting AI-powered bookings from customers</li>
      </ol>
      <p><a href="https://balkina.ai/dashboard">Go to your dashboard &rarr;</a></p>
    `,
  });
}

/**
 * Send payment failure notification email.
 */
export async function sendPaymentFailedEmail(params: {
  email: string;
  ownerName: string;
  businessName: string;
}): Promise<EmailResult> {
  const { email, ownerName, businessName } = params;

  return sendEmail({
    to: email,
    subject: `${businessName} — Payment Failed`,
    html: `
      <h2>Payment failed</h2>
      <p>Hi ${ownerName},</p>
      <p>We were unable to process your subscription payment for <strong>${businessName}</strong>.</p>
      <p>To avoid any interruption to your service, please update your payment method as soon as possible.</p>
      <p><a href="https://balkina.ai/billing/reactivate">Update payment method &rarr;</a></p>
      <p>If you believe this is an error, please contact us at support@balkina.ai.</p>
    `,
  });
}
