// Booking state types for the chat flow

export interface BookingState {
  tenantId: string | null;
  tenantName: string | null;
  locationId: string | null;
  serviceId: string | null;
  serviceName: string | null;
  servicePrice: number | null;
  serviceDuration: number | null;
  depositEnabled: boolean;
  depositAmount: number | null;
  depositType: 'fixed' | 'percentage' | null;
  date: string | null; // YYYY-MM-DD
  staffId: string | null;
  staffName: string | null;
  timeSlot: string | null; // display time like "10:00 AM"
  timeSlotIso: string | null; // ISO string
  selectedPackage: string | null;
  selectedExtras: string[];
  extrasTotal: number;
  packagePrice: number;
  address: string | null;
}

export const INITIAL_BOOKING_STATE: BookingState = {
  tenantId: null,
  tenantName: null,
  locationId: null,
  serviceId: null,
  serviceName: null,
  servicePrice: null,
  serviceDuration: null,
  depositEnabled: false,
  depositAmount: null,
  depositType: null,
  date: null,
  staffId: null,
  staffName: null,
  timeSlot: null,
  timeSlotIso: null,
  selectedPackage: null,
  selectedExtras: [],
  extrasTotal: 0,
  packagePrice: 0,
  address: null,
};
