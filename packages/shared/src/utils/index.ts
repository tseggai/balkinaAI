/**
 * Shared utility functions used across all apps and packages.
 */

/**
 * Formats a price in cents to a display string.
 * @example formatPrice(1999, 'USD') → '$19.99'
 */
export function formatPrice(amountCents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(amountCents / 100);
}

/**
 * Calculates the deposit amount for an appointment.
 */
export function calculateDeposit(
  price: number,
  depositType: 'fixed' | 'percentage',
  depositAmount: number
): number {
  if (depositType === 'fixed') return depositAmount;
  return Math.round(price * (depositAmount / 100) * 100) / 100;
}

/**
 * Generates a slug from a string.
 * @example toSlug('Hair & Beauty') → 'hair-beauty'
 */
export function toSlug(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Returns true if a value is a non-empty string.
 */
export function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Adds minutes to a Date and returns a new Date.
 */
export function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60_000);
}

/**
 * Type-safe object keys.
 */
export function objectKeys<T extends object>(obj: T): (keyof T)[] {
  return Object.keys(obj) as (keyof T)[];
}
