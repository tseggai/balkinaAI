/**
 * Vocabulary / labels keyed by tenant business_type (Migration 049).
 * Single source of truth for restaurant (and future vertical) terminology.
 * The data model stays canonical (services, staff, appointments) — only the
 * words shown to humans and injected into the AI prompt change.
 */
export type BusinessType = 'standard' | 'restaurant';

export interface LabelSet {
  service: string;
  services: string;
  staff: string;
  book: string;
  booking: string;
  bookings: string;
  customer: string;
}

export const LABELS: Record<string, LabelSet> = {
  standard: {
    service: 'Service',
    services: 'Services',
    staff: 'Staff',
    book: 'Book',
    booking: 'Appointment',
    bookings: 'Appointments',
    customer: 'Customer',
  },
  restaurant: {
    service: 'Experience',
    services: 'Menu',
    staff: 'Host',
    book: 'Reserve',
    booking: 'Reservation',
    bookings: 'Reservations',
    customer: 'Guest',
  },
};

export function getLabels(businessType?: string | null): LabelSet {
  return LABELS[businessType ?? 'standard'] ?? LABELS.standard!;
}
