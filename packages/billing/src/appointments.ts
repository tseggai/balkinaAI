/**
 * Customer appointment payment logic via Stripe Connect.
 * Deposit flow: PaymentIntent for deposit_amount only, transferred to tenant
 * stripe_account_id minus Balkina platform commission.
 */
import type Stripe from 'stripe';
import { stripe } from './subscriptions.js';
import { PLATFORM_COMMISSION_RATE } from '@balkina/shared';

export interface CreateDepositPaymentParams {
  appointmentId: string;
  customerId: string;
  tenantStripeAccountId: string;
  depositAmountCents: number; // in cents
  currency?: string;
  description?: string;
}

export interface CreateFullPaymentParams {
  appointmentId: string;
  customerId: string;
  tenantStripeAccountId: string;
  totalAmountCents: number; // in cents
  depositAlreadyPaidCents?: number;
  currency?: string;
  description?: string;
}

/**
 * Create a PaymentIntent for a deposit.
 * Transfers the deposit amount to the tenant's Stripe Connect account
 * minus the platform commission.
 */
export async function createDepositPaymentIntent({
  appointmentId,
  customerId,
  tenantStripeAccountId,
  depositAmountCents,
  currency = 'usd',
  description,
}: CreateDepositPaymentParams): Promise<Stripe.PaymentIntent> {
  const platformFeeCents = Math.round(depositAmountCents * PLATFORM_COMMISSION_RATE);

  return stripe.paymentIntents.create({
    amount: depositAmountCents,
    currency,
    automatic_payment_methods: { enabled: true },
    transfer_data: {
      destination: tenantStripeAccountId,
    },
    application_fee_amount: platformFeeCents,
    metadata: {
      appointment_id: appointmentId,
      customer_id: customerId,
      payment_type: 'deposit',
    },
    description: description ?? `Deposit for appointment ${appointmentId}`,
  });
}

/**
 * Create a PaymentIntent for the remaining balance (full price minus deposit).
 */
export async function createBalancePaymentIntent({
  appointmentId,
  customerId,
  tenantStripeAccountId,
  totalAmountCents,
  depositAlreadyPaidCents = 0,
  currency = 'usd',
  description,
}: CreateFullPaymentParams): Promise<Stripe.PaymentIntent> {
  const balanceCents = totalAmountCents - depositAlreadyPaidCents;
  if (balanceCents <= 0) throw new Error('Balance is already fully paid');

  const platformFeeCents = Math.round(balanceCents * PLATFORM_COMMISSION_RATE);

  return stripe.paymentIntents.create({
    amount: balanceCents,
    currency,
    automatic_payment_methods: { enabled: true },
    transfer_data: {
      destination: tenantStripeAccountId,
    },
    application_fee_amount: platformFeeCents,
    metadata: {
      appointment_id: appointmentId,
      customer_id: customerId,
      payment_type: 'balance',
    },
    description: description ?? `Balance payment for appointment ${appointmentId}`,
  });
}

/**
 * Retrieve a PaymentIntent (for webhook processing and status checks).
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}
