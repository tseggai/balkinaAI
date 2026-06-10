/**
 * Vocabulary / labels keyed by tenant business_type (Migrations 049 / 050).
 * Single source of truth for hospitality (and future vertical) terminology.
 * The data model stays canonical (services, staff, appointments) — only the
 * words shown to humans and injected into the AI prompt change.
 *
 * The two buckets are 'service' (appointments / bookings) and 'hospitality'
 * (reservations & events). Legacy values 'standard'/'restaurant' (Migration
 * 049) are normalized in getLabels for safety.
 */
export type BusinessType = 'service' | 'hospitality';

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
  service: {
    service: 'Service',
    services: 'Services',
    staff: 'Staff',
    book: 'Book',
    booking: 'Appointment',
    bookings: 'Appointments',
    customer: 'Customer',
  },
  hospitality: {
    service: 'Experience',
    services: 'Experiences',
    staff: 'Host',
    book: 'Reserve',
    booking: 'Reservation',
    bookings: 'Reservations',
    customer: 'Guest',
  },
};

/** Normalize legacy (Migration 049) values to the current buckets. */
export function normalizeBusinessType(businessType?: string | null): BusinessType {
  if (businessType === 'hospitality' || businessType === 'restaurant') return 'hospitality';
  return 'service';
}

export function getLabels(businessType?: string | null): LabelSet {
  return LABELS[normalizeBusinessType(businessType)] ?? LABELS.service!;
}
