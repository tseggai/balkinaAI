export interface OctoProduct {
  id: string;
  internalName: string;
  reference: string | null;
  locale: string;
  timeZone: string;
  allowFreesale: boolean;
  instantConfirmation: boolean;
  instantDelivery: boolean;
  availabilityRequired: boolean;
  availabilityType: string;
  deliveryFormats: string[];
  deliveryMethods: string[];
  redemptionMethod: string;
  options: OctoOption[];
}

export interface OctoOption {
  id: string;
  default: boolean;
  internalName: string;
  reference: string | null;
  availabilityLocalStartTimes: string[];
  cancellationCutoff: string;
  cancellationCutoffAmount: number;
  cancellationCutoffUnit: string;
  requiredContactFields: string[];
  units: OctoUnit[];
}

export interface OctoUnit {
  id: string;
  internalName: string;
  reference: string | null;
  type: string;
  requiredContactFields: string[];
  pricingFrom: OctoPricing[] | null;
}

export interface OctoPricing {
  original: number;
  retail: number;
  net: number | null;
  currency: string;
}

export interface OctoAvailability {
  id: string;
  localDateTimeStart: string;
  localDateTimeEnd: string;
  allDay: boolean;
  available: boolean;
  status: string;
  vacancies: number | null;
  capacity: number | null;
  maxUnits: number | null;
  utcCutoffAt: string;
  openingHours: unknown[];
}

export interface OctoBooking {
  id: string;
  uuid: string;
  testMode: boolean;
  resellerReference: string | null;
  supplierReference: string | null;
  status: string;
  utcCreatedAt: string;
  utcUpdatedAt: string;
  utcExpiresAt: string | null;
  utcRedeemedAt: string | null;
  utcConfirmedAt: string | null;
  productId: string;
  optionId: string;
  cancellable: boolean;
  cancellation: unknown | null;
  freesale: boolean;
  availabilityId: string;
  availability: { id: string; localDateTimeStart: string; localDateTimeEnd: string; allDay: boolean; openingHours: unknown[] };
  contact: Record<string, unknown>;
  notes: string | null;
  deliveryMethods: string[];
  voucher: unknown | null;
  unitItems: unknown[];
}

export function serviceToOctoProduct(
  service: { id: string; name: string; duration_minutes: number; price: number; pricing_type: string },
  octoProductId: string,
  timezone: string,
  currency: string,
  startTimes: string[],
): OctoProduct {
  return {
    id: octoProductId,
    internalName: service.name,
    reference: service.id,
    locale: 'en',
    timeZone: timezone,
    allowFreesale: false,
    instantConfirmation: true,
    instantDelivery: true,
    availabilityRequired: true,
    availabilityType: 'START_TIME',
    deliveryFormats: ['QRCODE'],
    deliveryMethods: ['VOUCHER'],
    redemptionMethod: 'DIGITAL',
    options: [{
      id: 'DEFAULT',
      default: true,
      internalName: service.name,
      reference: null,
      availabilityLocalStartTimes: startTimes,
      cancellationCutoff: 'P0D',
      cancellationCutoffAmount: 0,
      cancellationCutoffUnit: 'day',
      requiredContactFields: ['fullName', 'emailAddress', 'phoneNumber'],
      units: [{
        id: `adult_${service.id}`,
        internalName: 'Adult',
        reference: null,
        type: 'ADULT',
        requiredContactFields: [],
        pricingFrom: [{
          original: Math.round(service.price * 100),
          retail: Math.round(service.price * 100),
          net: null,
          currency,
        }],
      }],
    }],
  };
}

export function slotToOctoAvailability(
  slot: { time: string; iso: string; available: boolean },
  octoProductId: string,
  durationMinutes: number,
): OctoAvailability {
  const start = new Date(slot.iso);
  const end = new Date(start.getTime() + durationMinutes * 60000);
  const cutoff = new Date(start.getTime() - 15 * 60000);

  return {
    id: `${start.toISOString()}:${octoProductId}`,
    localDateTimeStart: start.toISOString(),
    localDateTimeEnd: end.toISOString(),
    allDay: false,
    available: slot.available,
    status: slot.available ? 'AVAILABLE' : 'SOLD_OUT',
    vacancies: slot.available ? 1 : 0,
    capacity: 1,
    maxUnits: 1,
    utcCutoffAt: cutoff.toISOString(),
    openingHours: [],
  };
}

export function parseAvailabilityId(availabilityId: string): { isoStart: string; octoProductId: string } | null {
  const idx = availabilityId.lastIndexOf(':');
  if (idx < 0) return null;
  return {
    isoStart: availabilityId.slice(0, idx),
    octoProductId: availabilityId.slice(idx + 1),
  };
}
