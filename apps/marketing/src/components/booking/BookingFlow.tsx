'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  fetchStaffAvailability,
  createBooking,
  type AvailabilityResponse,
  type Seating,
} from './booking-api';
import {
  formatPrice,
  formatPriceWithType,
  formatDuration,
  formatHumanDate,
  formatOpenHours,
  getDateButtons,
  bookingTotal,
} from './booking-utils';

interface ServiceData {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  image_url: string | null;
  pricing_type: string | null;
  /** 'standard' | 'table' | 'event' (hospitality) */
  service_type?: string | null;
  capacity?: number | null;
  description?: string | null;
}

interface LocationData {
  id: string;
  name: string;
  address: string | null;
  currency?: string;
}

interface Props {
  tenantId: string;
  tenantName: string;
  services: ServiceData[];
  locations: LocationData[];
  currency: string;
  serviceLocationMap: Record<string, string[]>;
  /** 'service' (appointments) | 'hospitality' (reservations & events) */
  businessType?: string | null;
}

type Step = 'services' | 'datetime' | 'summary' | 'confirmed';

interface BookingResult {
  appointmentId: string;
  status: string;
  serviceName: string;
  staffName: string;
  date: string;
  time: string;
  address: string;
  total: number;
  depositAmount?: number;
  paymentRequired?: boolean;
  paymentUrl?: string;
  /** Hospitality */
  reservation?: boolean;
  guests?: number;
}

const MAX_PARTY = 20;

export default function BookingFlow({ tenantId, tenantName, services, locations, currency, serviceLocationMap, businessType }: Props) {
  const [step, setStep] = useState<Step>('services');
  const [service, setService] = useState<ServiceData | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);
  const [staffName, setStaffName] = useState<string>('Anyone');
  const [date, setDate] = useState('');
  const [timeSlot, setTimeSlot] = useState('');
  const [timeSlotIso, setTimeSlotIso] = useState('');
  const [partySize, setPartySize] = useState(2);
  const [locationId, setLocationId] = useState(locations[0]?.id ?? '');
  const [result, setResult] = useState<BookingResult | null>(null);

  const hospitality = businessType === 'hospitality';
  const hasMultipleLocations = locations.length > 1;
  const selectedLocation = locations.find((l) => l.id === locationId) ?? locations[0];
  const locationCurrency = selectedLocation?.currency ?? currency;

  const filteredServices = hasMultipleLocations
    ? services.filter((s) => {
        const locs = serviceLocationMap[s.id];
        return !locs || locs.length === 0 || locs.includes(locationId);
      })
    : services;

  const selectService = (s: ServiceData) => {
    setService(s);
    setStaffId(null);
    setStaffName('Anyone');
    setDate('');
    setTimeSlot('');
    setTimeSlotIso('');
    setPartySize(2);
    setStep('datetime');
  };

  const selectTime = (sid: string | null, sname: string, slot: string, iso: string, onDate?: string) => {
    setStaffId(sid);
    setStaffName(sname);
    setTimeSlot(slot);
    setTimeSlotIso(iso);
    if (onDate) setDate(onDate);
    setStep('summary');
  };

  const goBack = () => {
    if (step === 'datetime') setStep('services');
    else if (step === 'summary') setStep('datetime');
  };

  const reset = () => {
    setStep('services');
    setService(null);
    setResult(null);
  };

  return (
    <div className="mt-8">
      {/* Location context — always visible when multiple locations */}
      {hasMultipleLocations && step !== 'confirmed' && (
        step === 'services' ? (
          <LocationSelector
            locations={locations}
            selectedId={locationId}
            onSelect={(id) => { setLocationId(id); setService(null); }}
          />
        ) : (
          <div className="mb-4 flex items-center gap-2 rounded-lg bg-gray-50 px-3 py-2">
            <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
            </svg>
            <span className="flex-1 text-sm font-medium text-gray-700">{selectedLocation?.name}</span>
            <button onClick={() => { setStep('services'); setService(null); }} className="text-xs text-brand-600 hover:underline">Change</button>
          </div>
        )
      )}

      {step !== 'services' && step !== 'confirmed' && (
        <button onClick={goBack} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" /></svg>
          Back
        </button>
      )}

      {step === 'services' && (
        <ServiceList services={filteredServices} currency={locationCurrency} hospitality={hospitality} onSelect={selectService} />
      )}
      {step === 'datetime' && service && (
        <DateTimePicker
          tenantId={tenantId}
          service={service}
          locationId={locationId}
          currency={locationCurrency}
          date={date}
          partySize={partySize}
          onPartySizeChange={setPartySize}
          onDateChange={setDate}
          onSelectTime={selectTime}
        />
      )}
      {step === 'summary' && service && (
        <Summary
          tenantId={tenantId}
          tenantName={tenantName}
          service={service}
          staffId={staffId}
          staffName={staffName}
          date={date}
          timeSlot={timeSlot}
          timeSlotIso={timeSlotIso}
          partySize={partySize}
          locationId={locationId}
          currency={locationCurrency}
          address={selectedLocation?.address ?? ''}
          onConfirmed={(r) => { setResult(r); setStep('confirmed'); }}
          onConflict={() => setStep('datetime')}
        />
      )}
      {step === 'confirmed' && result && (
        <Confirmation result={result} currency={locationCurrency} hospitality={hospitality} onBookAnother={reset} />
      )}
    </div>
  );
}

// ─── Location Selector ─────────────────────────────────────────────────────────

function LocationSelector({ locations, selectedId, onSelect }: {
  locations: LocationData[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="mb-5">
      <h2 className="text-lg font-semibold text-gray-900">Select a location</h2>
      <div className="mt-3 space-y-2">
        {locations.map((loc) => (
          <button
            key={loc.id}
            onClick={() => onSelect(loc.id)}
            className={`flex w-full items-start gap-3 rounded-xl border-2 px-4 py-3 text-left transition-colors ${
              selectedId === loc.id
                ? 'border-brand-500 bg-brand-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <svg className={`mt-0.5 h-5 w-5 flex-shrink-0 ${selectedId === loc.id ? 'text-brand-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
            </svg>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{loc.name}</p>
              {loc.address && <p className="text-xs text-gray-500 truncate">{loc.address}</p>}
            </div>
            {selectedId === loc.id && (
              <svg className="h-5 w-5 flex-shrink-0 text-brand-500" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
              </svg>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Step 1: Service List ──────────────────────────────────────────────────────

/** Second line of a service row: duration for standard services, kind + turn time / seating length for hospitality. */
function serviceSubtitle(svc: ServiceData): string {
  if (svc.service_type === 'table') return `Table reservation · ${formatDuration(svc.duration_minutes)} per table`;
  if (svc.service_type === 'event') return `Event · ${formatDuration(svc.duration_minutes)}${svc.capacity ? ` · ${svc.capacity} seats` : ''}`;
  return formatDuration(svc.duration_minutes, svc.pricing_type);
}

function servicePriceLabel(svc: ServiceData, currency: string): string {
  if (svc.service_type === 'table' && svc.price === 0) return 'Free';
  return formatPriceWithType(svc.price, svc.pricing_type, currency);
}

function ServiceList({ services, currency, hospitality, onSelect }: {
  services: ServiceData[];
  currency: string;
  hospitality: boolean;
  onSelect: (s: ServiceData) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">{hospitality ? 'What would you like to reserve?' : 'Select a service'}</h2>
      <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
        {services.map((svc) => (
          <button
            key={svc.id}
            onClick={() => onSelect(svc)}
            className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-gray-50 active:bg-gray-100"
          >
            {svc.image_url ? (
              <img src={svc.image_url} alt={svc.name} className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
            ) : (
              <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">
                <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{svc.name}</p>
              <p className="text-xs text-gray-500">{serviceSubtitle(svc)}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-brand-600">{servicePriceLabel(svc, currency)}</span>
              <svg className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" /></svg>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Party size (hospitality) ──────────────────────────────────────────────────

function PartySizePicker({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  return (
    <div className="mt-5">
      <h3 className="text-sm font-semibold text-gray-700">How many guests?</h3>
      <div className="mt-2 inline-flex items-center rounded-xl border border-gray-200 bg-white">
        <button
          type="button"
          aria-label="Fewer guests"
          disabled={value <= 1}
          onClick={() => onChange(Math.max(1, value - 1))}
          className="px-4 py-2.5 text-lg font-semibold text-gray-600 disabled:text-gray-300"
        >−</button>
        <span className="min-w-[5.5rem] text-center text-sm font-semibold text-gray-900">{value} {value === 1 ? 'guest' : 'guests'}</span>
        <button
          type="button"
          aria-label="More guests"
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className="px-4 py-2.5 text-lg font-semibold text-gray-600 disabled:text-gray-300"
        >+</button>
      </div>
    </div>
  );
}

// ─── Step 2: Date/Time Picker ──────────────────────────────────────────────────

function DateTimePicker({ tenantId, service, locationId, currency, date, partySize, onPartySizeChange, onDateChange, onSelectTime }: {
  tenantId: string;
  service: ServiceData;
  locationId: string;
  currency: string;
  date: string;
  partySize: number;
  onPartySizeChange: (n: number) => void;
  onDateChange: (d: string) => void;
  onSelectTime: (staffId: string | null, staffName: string, slot: string, iso: string, onDate?: string) => void;
}) {
  const isTable = service.service_type === 'table';
  const isEvent = service.service_type === 'event';
  const reservation = isTable || isEvent;
  const [dates] = useState(() => getDateButtons(14));
  const [selectedDate, setSelectedDate] = useState(date || dates[0]?.value || '');
  const [availability, setAvailability] = useState<AvailabilityResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedStaff, setSelectedStaff] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const dateScrollRef = useRef<HTMLDivElement>(null);

  const loadAvailability = useCallback(async (d: string) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLoading(true);
    setError('');
    const res = await fetchStaffAvailability({ tenantId, serviceId: service.id, date: d, locationId });
    if (controller.signal.aborted) return;
    if ('error' in res) {
      setError(res.error);
      setAvailability(null);
    } else {
      setAvailability(res);
      setSelectedStaff(null);
    }
    setLoading(false);
  }, [tenantId, service.id, locationId]);

  useEffect(() => {
    if (selectedDate) {
      onDateChange(selectedDate);
      loadAvailability(selectedDate);
    }
  }, [selectedDate, loadAvailability, onDateChange]);

  const activeSlots = selectedStaff
    ? availability?.staff.find((s) => s.id === selectedStaff)?.all_slots
      ?? availability?.staff.find((s) => s.id === selectedStaff)?.slots.map((s) => ({ ...s, available: true }))
      ?? []
    : availability?.anyone_slots ?? [];

  const activeStaffName = selectedStaff
    ? availability?.staff.find((s) => s.id === selectedStaff)?.name ?? 'Staff'
    : 'Anyone';

  const isDayOrWeek = service.pricing_type === 'per_day' || service.pricing_type === 'per_week';
  const maxParty = isEvent && service.capacity ? Math.max(1, Math.min(MAX_PARTY, service.capacity)) : MAX_PARTY;
  const seatings: Seating[] = availability?.seatings ?? [];

  return (
    <div>
      {/* Service summary */}
      <div className="flex items-center gap-3 rounded-xl bg-brand-50 px-4 py-3">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">{service.name}</p>
          <p className="text-xs text-gray-500">{serviceSubtitle(service)} &middot; {servicePriceLabel(service, currency)}</p>
          {service.description && <p className="mt-1 text-xs text-gray-600">{service.description}</p>}
        </div>
      </div>

      {reservation && <PartySizePicker value={partySize} max={maxParty} onChange={onPartySizeChange} />}

      {/* Events: pick a seating (date + time with seats left) — no date strip. */}
      {isEvent ? (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-gray-700">Pick a seating</h3>
          {loading ? (
            <div className="mt-3 space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          ) : error ? (
            <p className="mt-3 text-sm text-red-500">{error}</p>
          ) : seatings.length === 0 ? (
            <p className="mt-3 text-sm text-gray-400">No upcoming seatings for this event.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {seatings.map((s) => {
                const soldOut = s.seats_left <= 0;
                const tooFew = !soldOut && s.seats_left < partySize;
                const disabled = soldOut || tooFew;
                return (
                  <button
                    key={s.iso}
                    disabled={disabled}
                    onClick={() => onSelectTime(null, '', s.time, s.iso, s.date)}
                    className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition-colors ${
                      disabled
                        ? 'border-gray-100 bg-gray-50 text-gray-400 cursor-not-allowed'
                        : 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200'
                    }`}
                  >
                    <span>
                      <span className="block text-sm font-semibold">{formatHumanDate(s.date)}</span>
                      <span className="block text-xs">{s.time}</span>
                    </span>
                    <span className="text-xs font-medium">
                      {soldOut ? 'Sold out' : tooFew ? `Only ${s.seats_left} left` : `${s.seats_left} seats left`}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      ) : (
      <>
      {/* Date picker */}
      <div className="mt-5">
        <h3 className="text-sm font-semibold text-gray-700">Select a date</h3>
        <div ref={dateScrollRef} className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
          {dates.map((d) => (
            <button
              key={d.value}
              onClick={() => setSelectedDate(d.value)}
              className={`flex flex-col items-center rounded-xl px-3 py-2 text-xs font-medium transition-colors flex-shrink-0 min-w-[52px] ${
                selectedDate === d.value
                  ? 'bg-brand-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{d.label}</span>
              <span className="mt-0.5 text-base font-bold">{d.sublabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Staff selection */}
      {!loading && availability && availability.staff_selection_enabled && availability.staff.length > 0 && (
        <div className="mt-5">
          <h3 className="text-sm font-semibold text-gray-700">Select a staff member</h3>
          <div className="mt-2 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <StaffButton
              name="Anyone"
              imageUrl={null}
              slotCount={availability.anyone_slots.filter((s) => s.available).length}
              selected={selectedStaff === null}
              onClick={() => setSelectedStaff(null)}
            />
            {availability.staff.map((s) => (
              <StaffButton
                key={s.id}
                name={s.name}
                imageUrl={s.image_url}
                slotCount={s.available_slots_count}
                selected={selectedStaff === s.id}
                onClick={() => setSelectedStaff(s.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Time slots or day/week booking */}
      <div className="mt-5">
        {isDayOrWeek ? (
          <>
            <h3 className="text-sm font-semibold text-gray-700">
              {service.pricing_type === 'per_day' ? 'Book this day' : 'Book this week'}
            </h3>
            {loading ? (
              <div className="mt-3 h-12 w-40 animate-pulse rounded-lg bg-gray-100" />
            ) : error ? (
              <p className="mt-3 text-sm text-red-500">{error}</p>
            ) : activeSlots.length === 0 || !activeSlots.some((s) => 'available' in s ? s.available : true) ? (
              <p className="mt-3 text-sm text-gray-400">Not available for this date.</p>
            ) : (
              <button
                onClick={() => {
                  const slot = activeSlots.find((s) => 'available' in s ? s.available : true);
                  if (slot) onSelectTime(selectedStaff, activeStaffName, formatHumanDate(selectedDate), slot.iso);
                }}
                className="mt-3 rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
              >
                {service.pricing_type === 'per_day'
                  ? `Book ${formatHumanDate(selectedDate)}`
                  : `Book week of ${formatHumanDate(selectedDate)}`}
              </button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-baseline justify-between">
              <h3 className="text-sm font-semibold text-gray-700">{isTable ? 'Pick a reservation time' : 'Pick a time'}</h3>
              {isTable && !loading && availability?.open_hours && (
                <span className="text-xs text-gray-500">{formatOpenHours(availability.open_hours)}</span>
              )}
            </div>
        {loading ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {Array.from({ length: 9 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-lg bg-gray-100" />
            ))}
          </div>
        ) : error ? (
          <p className="mt-3 text-sm text-red-500">{error}</p>
        ) : activeSlots.length === 0 ? (
          <p className="mt-3 text-sm text-gray-400">{isTable ? (availability?.message || 'No reservation times left on this date.') : 'No available slots for this date.'}</p>
        ) : (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
            {activeSlots.map((slot) => {
              const available = 'available' in slot ? slot.available : true;
              return (
                <button
                  key={slot.iso}
                  disabled={!available}
                  onClick={() => onSelectTime(isTable ? null : selectedStaff, isTable ? '' : activeStaffName, slot.time, slot.iso)}
                  className={`rounded-lg border px-2 py-2.5 text-sm font-medium transition-colors ${
                    available
                      ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 active:bg-brand-200'
                      : 'border-gray-100 bg-gray-50 text-gray-300 cursor-not-allowed'
                  }`}
                >
                  {slot.time}
                </button>
              );
            })}
          </div>
        )}
        {isTable && !loading && !error && activeSlots.length > 0 && (
          <p className="mt-3 text-xs text-gray-500">The venue confirms your request. You&apos;ll be notified once it&apos;s accepted.</p>
        )}
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
}

function StaffButton({ name, imageUrl, slotCount, selected, onClick }: {
  name: string;
  imageUrl: string | null;
  slotCount: number;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center rounded-xl border-2 px-3 py-2 transition-colors flex-shrink-0 min-w-[80px] ${
        selected ? 'border-brand-500 bg-brand-50' : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      {imageUrl ? (
        <img src={imageUrl} alt={name} className="h-10 w-10 rounded-full object-cover" />
      ) : (
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-200 text-sm font-bold text-gray-500">
          {name === 'Anyone' ? '?' : name.charAt(0)}
        </div>
      )}
      <span className="mt-1 text-xs font-medium text-gray-800 truncate max-w-[72px]">{name}</span>
      <span className="text-[10px] text-gray-400">{slotCount} slots</span>
    </button>
  );
}

// ─── Step 3: Summary + Customer Form ───────────────────────────────────────────

function Summary({ tenantId, tenantName, service, staffId, staffName, date, timeSlot, timeSlotIso, partySize, locationId, currency, address, onConfirmed, onConflict }: {
  tenantId: string;
  tenantName: string;
  service: ServiceData;
  staffId: string | null;
  staffName: string;
  date: string;
  timeSlot: string;
  timeSlotIso: string;
  partySize: number;
  locationId: string;
  currency: string;
  address: string;
  onConfirmed: (r: BookingResult) => void;
  onConflict: () => void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const isTable = service.service_type === 'table';
  const isEvent = service.service_type === 'event';
  const reservation = isTable || isEvent;
  const total = bookingTotal(service.price, service.pricing_type, reservation ? partySize : 1);
  const valid = name.trim().length > 0 && phone.trim().length >= 7;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError('');

    const res = await createBooking({
      tenantId,
      serviceId: service.id,
      staffId: staffId || undefined,
      date,
      timeSlot,
      timeSlotIso,
      locationId,
      customerName: name.trim(),
      customerPhone: phone.trim(),
      customerEmail: email.trim() || undefined,
      partySize: reservation ? partySize : undefined,
      bookingType: isTable ? 'table' : isEvent ? 'event' : undefined,
    });

    if (!res.success) {
      const msg = (res.error ?? '').toLowerCase();
      if (!reservation && (msg.includes('slot') || msg.includes('conflict'))) {
        setError('This time slot was just booked. Please choose another.');
        setTimeout(onConflict, 2000);
      } else if (isEvent && (msg.includes('seat') || msg.includes('capacity') || msg.includes('sold out'))) {
        setError('Not enough seats left at this seating. Please pick another seating or fewer guests.');
        setTimeout(onConflict, 2500);
      } else {
        setError(res.error || (reservation ? 'Reservation failed. Please try again.' : 'Booking failed. Please try again.'));
      }
      setSubmitting(false);
      return;
    }

    onConfirmed({
      appointmentId: res.appointment_id ?? '',
      status: res.status || (isTable ? 'pending' : 'confirmed'),
      serviceName: res.service_name || service.name,
      staffName: res.staff_name || staffName,
      date: res.date || formatHumanDate(date),
      time: res.time || timeSlot,
      address: res.address || address,
      total: res.total ?? total,
      depositAmount: res.deposit_amount,
      paymentRequired: res.payment_required,
      paymentUrl: res.payment_url,
      reservation,
      guests: reservation ? partySize : undefined,
    });
  };

  const submitLabel = isTable ? 'Request Reservation' : isEvent ? 'Reserve Seats' : 'Confirm Booking';
  const submittingLabel = isTable ? 'Sending request...' : isEvent ? 'Reserving...' : 'Confirming...';

  return (
    <div>
      <h2 className="text-lg font-semibold text-gray-900">{reservation ? 'Reservation Summary' : 'Booking Summary'}</h2>

      {/* Details card */}
      <div className="mt-3 rounded-xl border border-gray-200 bg-white p-4 space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">{reservation ? 'Venue' : 'Business'}</span>
          <span className="text-sm font-medium text-gray-900">{tenantName}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">{isEvent ? 'Event' : isTable ? 'Reservation' : 'Service'}</span>
          <span className="text-sm font-medium text-gray-900">{service.name}</span>
        </div>
        {reservation ? (
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Guests</span>
            <span className="text-sm font-medium text-gray-900">{partySize}</span>
          </div>
        ) : (
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Staff</span>
            <span className="text-sm font-medium text-gray-900">{staffName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Date</span>
          <span className="text-sm font-medium text-gray-900">{formatHumanDate(date)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Time</span>
          <span className="text-sm font-medium text-gray-900">{timeSlot}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Duration</span>
          <span className="text-sm font-medium text-gray-900">{formatDuration(service.duration_minutes, service.pricing_type)}</span>
        </div>
        {address && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Address</span>
            <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{address}</span>
          </div>
        )}
        <div className="border-t border-gray-100 pt-2 flex justify-between">
          <span className="text-sm font-semibold text-gray-900">Total</span>
          <span className="text-sm font-bold text-brand-600">
            {isTable && total === 0
              ? 'No charge'
              : service.pricing_type === 'per_person'
                ? `${formatPrice(total, currency)} (${formatPrice(service.price, currency)} × ${partySize})`
                : formatPriceWithType(service.price, service.pricing_type, currency)}
          </span>
        </div>
      </div>

      {/* Customer form */}
      <form onSubmit={handleSubmit} className="mt-5 space-y-3">
        <h3 className="text-sm font-semibold text-gray-700">Your details</h3>
        <input
          type="text"
          placeholder="Full name *"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <input
          type="tel"
          placeholder="Phone number *"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          required
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={!valid || submitting}
          className="w-full rounded-xl bg-brand-500 py-3.5 text-center text-base font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              {submittingLabel}
            </span>
          ) : submitLabel}
        </button>
        {isTable && (
          <p className="text-center text-xs text-gray-500">The venue reviews every request. You&apos;ll be notified once it&apos;s confirmed.</p>
        )}
      </form>
    </div>
  );
}

// ─── Step 4: Confirmation ──────────────────────────────────────────────────────

function Confirmation({ result, currency, hospitality, onBookAnother }: {
  result: BookingResult;
  currency: string;
  hospitality: boolean;
  onBookAnother: () => void;
}) {
  const isPending = result.status === 'pending' || result.status === 'pending_approval';
  const reservation = !!result.reservation;
  const appStoreUrl = 'https://apps.apple.com/us/app/balkina-ai/id6761651423';

  const title = reservation
    ? (isPending ? 'Reservation Requested' : 'Reservation Confirmed!')
    : (isPending ? 'Booking Requested' : 'Booking Confirmed!');
  const subtitle = reservation
    ? (isPending
        ? 'Your reservation request has been sent to the venue. You\'ll be notified once it\'s confirmed.'
        : 'Your seats are reserved. See you there!')
    : (isPending
        ? 'Your booking request has been sent. You\'ll be notified once approved.'
        : 'Your appointment has been confirmed.');

  return (
    <div className="text-center">
      {/* Success icon */}
      <div className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${isPending ? 'bg-yellow-100' : 'bg-green-100'}`}>
        {isPending ? (
          <svg className="h-8 w-8 text-yellow-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        ) : (
          <svg className="h-8 w-8 text-green-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
        )}
      </div>

      <h2 className="mt-4 text-xl font-bold text-gray-900">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{subtitle}</p>

      {/* Details */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-4 text-left space-y-2">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">{reservation ? 'Reservation' : 'Service'}</span>
          <span className="text-sm font-medium text-gray-900">{result.serviceName}</span>
        </div>
        {reservation ? (
          result.guests ? (
            <div className="flex justify-between">
              <span className="text-sm text-gray-500">Guests</span>
              <span className="text-sm font-medium text-gray-900">{result.guests}</span>
            </div>
          ) : null
        ) : (
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Staff</span>
            <span className="text-sm font-medium text-gray-900">{result.staffName}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Date</span>
          <span className="text-sm font-medium text-gray-900">{result.date}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Time</span>
          <span className="text-sm font-medium text-gray-900">{result.time}</span>
        </div>
        {result.address && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Address</span>
            <span className="text-sm font-medium text-gray-900 text-right max-w-[60%]">{result.address}</span>
          </div>
        )}
        <div className="border-t border-gray-100 pt-2 flex justify-between">
          <span className="text-sm font-semibold text-gray-900">Total</span>
          <span className="text-sm font-bold text-brand-600">{reservation && result.total === 0 ? 'No charge' : formatPrice(result.total, currency)}</span>
        </div>
        {result.depositAmount && result.depositAmount > 0 && (
          <div className="flex justify-between">
            <span className="text-sm text-gray-500">Deposit required</span>
            <span className="text-sm font-semibold text-orange-600">{formatPrice(result.depositAmount, currency)}</span>
          </div>
        )}
      </div>

      {/* Deposit payment link */}
      {result.paymentRequired && result.paymentUrl && (
        <a
          href={result.paymentUrl}
          className="mt-4 block w-full rounded-xl bg-orange-500 py-3 text-center text-base font-semibold text-white shadow-sm hover:bg-orange-600 transition-colors"
        >
          Pay Deposit
        </a>
      )}

      {/* App download CTA */}
      <div className="mt-6 rounded-xl border border-brand-200 bg-brand-50 p-4">
        <p className="text-sm font-semibold text-gray-900">Get the Balkina AI app</p>
        <p className="mt-1 text-xs text-gray-500">{hospitality ? 'Manage your reservations, get reminders, and discover more places.' : 'Manage your bookings, get reminders, and discover more services.'}</p>
        <a
          href={appStoreUrl}
          className="mt-3 inline-block rounded-lg bg-brand-500 px-6 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
        >
          Download on the App Store
        </a>
      </div>

      {/* Book another */}
      <button onClick={onBookAnother} className="mt-4 text-sm font-medium text-brand-600 hover:underline">
        {hospitality ? 'Make another reservation' : 'Book another service'}
      </button>
    </div>
  );
}
