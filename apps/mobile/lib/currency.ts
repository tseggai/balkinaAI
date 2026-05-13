const CURRENCY_MAP: Record<string, { symbol: string; code: string }> = {
  USD: { symbol: '$', code: 'USD' },
  EUR: { symbol: '€', code: 'EUR' },
  GBP: { symbol: '£', code: 'GBP' },
  CAD: { symbol: 'CA$', code: 'CAD' },
  AUD: { symbol: 'A$', code: 'AUD' },
  CHF: { symbol: 'CHF', code: 'CHF' },
  JPY: { symbol: '¥', code: 'JPY' },
  RSD: { symbol: 'RSD', code: 'RSD' },
};

export const SUPPORTED_CURRENCIES = Object.keys(CURRENCY_MAP);

export function currencySymbol(code?: string | null): string {
  return CURRENCY_MAP[code ?? 'USD']?.symbol ?? '$';
}

export function formatPrice(amount: number, currencyCode?: string | null): string {
  const sym = currencySymbol(currencyCode);
  const formatted = amount % 1 === 0 ? amount.toString() : amount.toFixed(2);
  return `${sym}${formatted}`;
}

export function stripeCurrency(code?: string | null): string {
  return (code ?? 'USD').toLowerCase();
}
