/**
 * Zod-validated environment variables.
 * The app FAILS FAST on startup if any required variable is missing or malformed.
 * Import `env` in server-side code. Import `clientEnv` for client-side (NEXT_PUBLIC_*) vars only.
 * NEVER import `serverEnv` or `env` in client-side bundles.
 */
import { z } from 'zod';

// ─── Server-side environment schema ───────────────────────────────────────────

const serverEnvSchema = z.object({
  // Supabase
  SUPABASE_ANON_KEY: z.string().min(1, 'SUPABASE_ANON_KEY is required'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1, 'SUPABASE_SERVICE_ROLE_KEY is required'),
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),

  // Stripe
  STRIPE_SECRET_KEY: z
    .string()
    .min(1, 'STRIPE_SECRET_KEY is required')
    .refine((v) => v.startsWith('sk_'), 'STRIPE_SECRET_KEY must start with sk_'),
  STRIPE_PUBLISHABLE_KEY: z
    .string()
    .min(1, 'STRIPE_PUBLISHABLE_KEY is required')
    .refine((v) => v.startsWith('pk_'), 'STRIPE_PUBLISHABLE_KEY must start with pk_'),
  STRIPE_WEBHOOK_SECRET: z
    .string()
    .min(1, 'STRIPE_WEBHOOK_SECRET is required')
    .refine((v) => v.startsWith('whsec_'), 'STRIPE_WEBHOOK_SECRET must start with whsec_'),
  STRIPE_PRICE_ID_STARTER: z.string().min(1, 'STRIPE_PRICE_ID_STARTER is required'),
  STRIPE_PRICE_ID_PRO: z.string().min(1, 'STRIPE_PRICE_ID_PRO is required'),
  STRIPE_PRICE_ID_ENTERPRISE: z.string().min(1, 'STRIPE_PRICE_ID_ENTERPRISE is required'),
  STRIPE_CONNECT_CLIENT_ID: z.string().min(1, 'STRIPE_CONNECT_CLIENT_ID is required'),

  // Resend (email)
  RESEND_API_KEY: z.string().min(1, 'RESEND_API_KEY is required'),
  RESEND_FROM_EMAIL: z.string().min(1, 'RESEND_FROM_EMAIL is required'),

  // Twilio (SMS)
  TWILIO_ACCOUNT_SID: z
    .string()
    .min(1, 'TWILIO_ACCOUNT_SID is required')
    .refine((v) => v.startsWith('AC'), 'TWILIO_ACCOUNT_SID must start with AC'),
  TWILIO_AUTH_TOKEN: z.string().min(1, 'TWILIO_AUTH_TOKEN is required'),
  TWILIO_PHONE_NUMBER: z.string().min(1, 'TWILIO_PHONE_NUMBER is required'),

  // Google Maps
  GOOGLE_MAPS_API_KEY: z.string().min(1, 'GOOGLE_MAPS_API_KEY is required'),

  // Expo
  EXPO_PROJECT_ID: z.string().min(1, 'EXPO_PROJECT_ID is required'),

  // Anthropic
  ANTHROPIC_API_KEY: z.string().min(1, 'ANTHROPIC_API_KEY is required'),

  // Auth
  NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters'),
  NEXTAUTH_URL: z.string().url('NEXTAUTH_URL must be a valid URL'),
});

// ─── Client-side environment schema (NEXT_PUBLIC_* only) ──────────────────────

const clientEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url('NEXT_PUBLIC_SUPABASE_URL must be a valid URL'),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, 'NEXT_PUBLIC_SUPABASE_ANON_KEY is required'),
  NEXT_PUBLIC_GOOGLE_MAPS_API_KEY: z
    .string()
    .min(1, 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY is required'),
});

// ─── Validation & fail-fast ───────────────────────────────────────────────────

function validateEnv<T extends z.ZodTypeAny>(
  schema: T,
  label: string
): z.infer<T> {
  const result = schema.safeParse(process.env);
  if (!result.success) {
    const errors = result.error.flatten().fieldErrors;
    const messages = Object.entries(errors)
      .map(([key, msgs]) => `  • ${key}: ${(msgs ?? []).join(', ')}`)
      .join('\n');
    console.error(`\n❌ Invalid ${label} environment variables:\n${messages}\n`);
    throw new Error(`Missing or invalid ${label} environment variables. App cannot start.`);
  }
  return result.data as z.infer<T>;
}

export const serverEnv = validateEnv(serverEnvSchema, 'server');
export const clientEnv = validateEnv(clientEnvSchema, 'client');

/** Combined env — only use in server-side contexts. */
export const env = { ...serverEnv, ...clientEnv };

export type ServerEnv = typeof serverEnv;
export type ClientEnv = typeof clientEnv;
export type Env = typeof env;
