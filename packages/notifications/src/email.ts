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
  /**
   * Optional display name for the sender. The address always stays on the
   * verified RESEND_FROM_EMAIL domain, but the name can be branded per-property
   * (e.g. "Portonovi") so white-label invites feel first-party.
   */
  fromName?: string;
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
  fromName,
}: SendEmailParams): Promise<EmailResult> {
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!fromEmail) throw new Error('RESEND_FROM_EMAIL not configured');
  // If a display name is provided, brand the sender while keeping the verified
  // address. fromEmail may already be "Name <addr>" or a bare address.
  const bareAddress = fromEmail.includes('<') ? fromEmail.slice(fromEmail.indexOf('<') + 1, fromEmail.indexOf('>')) : fromEmail;
  const from = fromName ? `${fromName} <${bareAddress}>` : fromEmail;
  const client = getResend();
  const { data, error } = await client.emails.send({
    from,
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
 * Send tenant login credentials email — used after waitlist onboarding.
 * Replaces Supabase's default password reset email so tenants get a branded
 * "Welcome to Balkina AI" message containing their actual temporary password.
 */
export async function sendTenantLoginEmail(params: {
  email: string;
  ownerName: string;
  businessName: string;
  tempPassword: string;
  loginUrl: string;
}): Promise<EmailResult> {
  const { email, ownerName, businessName, tempPassword, loginUrl } = params;

  return sendEmail({
    to: email,
    subject: `Welcome to Balkina AI`,
    html: `
      <!-- Hidden preview text shown in email list view -->
      <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">Your business ${businessName} is now set up on Balkina AI. Sign in with your credentials below.</div>
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
        <h2 style="color:#111;margin-top:0;">Welcome to Balkina AI, ${ownerName}!</h2>
        <p>Your business <strong>${businessName}</strong> is now set up on Balkina AI.</p>
        <p>You can sign in to your tenant dashboard with the credentials below:</p>
        <div style="background:#f4f4f5;border:1px solid #e4e4e7;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px 0;"><strong>Email:</strong> ${email}</p>
          <p style="margin:0;"><strong>Temporary password:</strong> <code style="background:#fff;padding:2px 6px;border-radius:4px;border:1px solid #e4e4e7;">${tempPassword}</code></p>
        </div>
        <p style="margin:24px 0;">
          <a href="${loginUrl}" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Sign in to Balkina AI</a>
        </p>
        <div style="background:#f0f4ff;border:1px solid #c7d2fe;border-radius:8px;padding:16px;margin:16px 0;">
          <p style="margin:0 0 8px 0;font-weight:600;color:#111;">Manage bookings on the go</p>
          <p style="margin:0;font-size:14px;color:#52525b;">
            Download the Balkina AI app to manage appointments, approve or decline booking requests, and communicate with customers directly from your phone.
          </p>
          <p style="margin:12px 0 0 0;">
            <a href="https://apps.apple.com/us/app/balkina-ai/id6761651423" style="color:#2563eb;font-weight:600;font-size:14px;text-decoration:none;">Download for iOS →</a>
          </p>
          <p style="margin:4px 0 0 0;font-size:13px;color:#6b7280;">
            Sign in as a staff member using the same email and password above.
          </p>
        </div>
        <p style="color:#52525b;font-size:14px;">
          For your security, please change your password after your first sign-in from the
          dashboard's <em>Settings → Account</em> page.
        </p>
        <p style="color:#52525b;font-size:14px;">
          If you didn't expect this email or need help, reply to this message or contact us at
          <a href="mailto:support@balkina.ai">support@balkina.ai</a>.
        </p>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
        <p style="color:#a1a1aa;font-size:12px;margin:0;">Balkina AI · AI-powered appointment booking</p>
      </div>
    `,
    text: `Welcome to Balkina AI, ${ownerName}!

Your business ${businessName} is now set up on Balkina AI.

Sign in with the credentials below:
Email: ${email}
Temporary password: ${tempPassword}

Sign in: ${loginUrl}

MANAGE BOOKINGS ON THE GO
Download the Balkina AI app to manage appointments from your phone.
iOS: https://apps.apple.com/us/app/balkina-ai/id6761651423
Sign in as a staff member using the same email and password above.

For your security, please change your password after your first sign-in from Settings → Account.

If you need help, reply to this email or contact support@balkina.ai.

— Balkina AI`,
  });
}

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
 * Send a white-label property invite to a prospective business. The email is
 * branded with the property's name (sender display name + reply-to) so it reads
 * as coming from the property, and links to the same /join signup form guests
 * use, pre-tagged with the property's invite code.
 */
export async function sendPropertyInviteEmail(params: {
  email: string;
  propertyName: string;
  propertyEmail?: string | null;
  signupUrl: string;
}): Promise<EmailResult> {
  const { email, propertyName, propertyEmail, signupUrl } = params;

  return sendEmail({
    to: email,
    fromName: `${propertyName} (via Balkina AI)`,
    replyTo: propertyEmail || undefined,
    subject: `${propertyName} invites you to join their booking platform`,
    html: `
      <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${propertyName} would like to add your business to their Balkina AI booking platform.</div>
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
        <h2 style="color:#111;margin-top:0;">You're invited to join ${propertyName}</h2>
        <p><strong>${propertyName}</strong> uses Balkina AI to let guests discover and book local businesses, and they'd like to add yours.</p>
        <p>Tell us a little about your business and ${propertyName} will review and approve your listing. It only takes a couple of minutes.</p>
        <p style="margin:24px 0;">
          <a href="${signupUrl}" style="display:inline-block;background:#6B7FC4;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Set up your business</a>
        </p>
        <p style="color:#52525b;font-size:14px;">Or paste this link into your browser:<br/><a href="${signupUrl}" style="color:#6B7FC4;">${signupUrl}</a></p>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
        <p style="color:#a1a1aa;font-size:12px;margin:0;">Sent by ${propertyName} via Balkina AI · AI-powered appointment booking</p>
      </div>
    `,
    text: `You're invited to join ${propertyName}

${propertyName} uses Balkina AI to let guests discover and book local businesses, and they'd like to add yours.

Set up your business: ${signupUrl}

${propertyName} will review and approve your listing.

— Sent by ${propertyName} via Balkina AI`,
  });
}

/**
 * Send a message/announcement from a property to one of its tenants. Branded
 * with the property's name (sender display name + reply-to) so it reads as
 * coming directly from the property.
 */
export async function sendPropertyMessageEmail(params: {
  to: string;
  propertyName: string;
  propertyEmail?: string | null;
  subject: string;
  body: string;
  recipientName?: string | null;
}): Promise<EmailResult> {
  const { to, propertyName, propertyEmail, subject, body, recipientName } = params;
  const safeBody = body.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br />');

  return sendEmail({
    to,
    fromName: `${propertyName} (via Balkina AI)`,
    replyTo: propertyEmail || undefined,
    subject,
    html: `
      <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${propertyName}: ${subject}</div>
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px; color: #111;">
        <p style="margin:0 0 4px 0;font-size:12px;font-weight:600;color:#6B7FC4;text-transform:uppercase;letter-spacing:.04em;">${propertyName}</p>
        <h2 style="color:#111;margin:0 0 16px 0;">${subject}</h2>
        ${recipientName ? `<p style="margin:0 0 12px 0;">Hi ${recipientName},</p>` : ''}
        <div style="font-size:14px;line-height:1.6;color:#333;">${safeBody}</div>
        <hr style="border:none;border-top:1px solid #e4e4e7;margin:24px 0;" />
        <p style="color:#a1a1aa;font-size:12px;margin:0;">Sent by ${propertyName} via Balkina AI${propertyEmail ? ` · Reply to reach them at ${propertyEmail}` : ''}</p>
      </div>
    `,
    text: `${propertyName}\n\n${subject}\n\n${recipientName ? `Hi ${recipientName},\n\n` : ''}${body}\n\n— Sent by ${propertyName} via Balkina AI`,
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
