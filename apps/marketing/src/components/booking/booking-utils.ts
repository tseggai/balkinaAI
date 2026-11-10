const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', CHF: 'CHF', JPY: '¥', RSD: 'RSD',
};

export function currencySymbol(code?: string): string {
  return CURRENCY_SYMBOLS[code ?? 'USD'] ?? '$';
}

export function formatPrice(price: number, currency?: string): string {
  const sym = currencySymbol(currency);
  return `${sym}${price % 1 === 0 ? price : price.toFixed(2)}`;
}

export function formatPriceWithType(price: number, pricingType: string | null, currency?: string): string {
  const suffix = pricingType === 'per_day' ? '/day' : pricingType === 'per_week' ? '/week' : pricingType === 'per_person' ? '/person' : '';
  return `${formatPrice(price, currency)}${suffix}`;
}

export const isReservationService = (serviceType?: string | null): boolean => serviceType === 'table' || serviceType === 'event';

/** Total for a booking: per-person services multiply by the party size. */
export function bookingTotal(price: number, pricingType: string | null | undefined, guests: number): number {
  return pricingType === 'per_person' ? price * Math.max(1, guests) : price;
}

/** "Open 9:00 AM – 10:00 PM" from a 24h "HH:MM" pair. */
export function formatOpenHours(open?: { start: string; end: string } | null): string {
  if (!open) return '';
  const fmt = (t: string) => {
    const h = Number(t.slice(0, 2)), m = t.slice(3, 5);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const hh = h % 12 === 0 ? 12 : h % 12;
    return `${hh}:${m} ${ampm}`;
  };
  return `Open ${fmt(open.start)} – ${fmt(open.end)}`;
}

export function formatDuration(minutes: number, pricingType?: string | null): string {
  if (pricingType === 'per_day') return 'Full day';
  if (pricingType === 'per_week') return 'Full week';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes} min`;
}

export function getDateButtons(count = 14): { label: string; sublabel: string; value: string }[] {
  const today = new Date();
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: { label: string; sublabel: string; value: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    result.push({
      label: i === 0 ? 'Today' : (days[d.getDay()] ?? ''),
      sublabel: `${d.getDate()}`,
      value: `${yyyy}-${mm}-${dd}`,
    });
  }
  return result;
}

export function formatHumanDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}
