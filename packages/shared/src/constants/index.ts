/**
 * Application-wide constants.
 */

export const APP_NAME = 'Balkina AI';
export const APP_URL = 'https://balkina.ai';
export const SUPPORT_EMAIL = 'support@balkina.ai';

/** Claude model used for all AI interactions. */
export const AI_MODEL = 'claude-sonnet-4-6';

/** Balkina platform commission rate taken from Stripe Connect payments (10%). */
export const PLATFORM_COMMISSION_RATE = 0.1;

export const APPOINTMENT_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  CANCELLED: 'cancelled',
  COMPLETED: 'completed',
  NO_SHOW: 'no_show',
} as const;

export const SUBSCRIPTION_PLANS = {
  STARTER: 'starter',
  PRO: 'pro',
  ENTERPRISE: 'enterprise',
} as const;

export const DEPOSIT_TYPE = {
  FIXED: 'fixed',
  PERCENTAGE: 'percentage',
} as const;

/** Maximum number of AI tool calls per conversation turn. */
export const MAX_TOOL_CALLS = 10;

/** Maximum tokens for Claude API responses. */
export const MAX_RESPONSE_TOKENS = 4096;

/** Default pagination page size. */
export const DEFAULT_PAGE_SIZE = 20;

/** Booking confirmation window: customers can cancel up to this many hours before. */
export const CANCELLATION_WINDOW_HOURS = 24;
