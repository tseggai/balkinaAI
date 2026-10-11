'use client';

import { useMemo, useState } from 'react';

/**
 * Simulated booking flow for an unclaimed page: the business owner taps a
 * service and walks through date → time → details → confirmation exactly as a
 * customer would, but nothing is written anywhere. Ends with a "this is how it
 * will look" card that sends them to the claim form.
 */

export interface DemoService {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  hide_price: boolean | null;
}

interface Props {
  businessName: string;
  ownerName: string;
  currency: string;
  services: DemoService[];
}

const OPEN_HOUR = 9;
const CLOSE_HOUR = 17;
const SLOT_MINUTES = 30;
const INPUT = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors';

function nextDays(count: number): Date[] {
  const out: Date[] = [];
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  for (let i = 1; i <= count; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    out.push(day);
  }
  return out;
}

/** Deterministic pseudo-random so the same day always shows the same "taken" slots. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

function slotsFor(day: Date, durationMinutes: number): { label: string; taken: boolean }[] {
  const out: { label: string; taken: boolean }[] = [];
  const key = day.toDateString();
  for (let m = OPEN_HOUR * 60; m + durationMinutes <= CLOSE_HOUR * 60; m += SLOT_MINUTES) {
    const h = Math.floor(m / 60);
    const mm = m % 60;
    const label = `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    out.push({ label, taken: hash(`${key}-${label}`) < 0.3 });
  }
  return out;
}

function fmtDay(d: Date, opts: Intl.DateTimeFormatOptions): string {
  return d.toLocaleDateString('en-GB', opts);
}

export function ClaimDemo({ businessName, ownerName, currency, services }: Props) {
  const [open, setOpen] = useState(false);
  const [service, setService] = useState<DemoService | null>(null);
  const [step, setStep] = useState(1);
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: '', phone: '' });

  const days = useMemo(() => nextDays(7), []);
  const slots = useMemo(() => (day && service ? slotsFor(day, service.duration_minutes) : []), [day, service]);

  const start = (s: DemoService) => {
    setService(s);
    setStep(1);
    setDay(null);
    setTime(null);
    setOpen(true);
  };
  const close = () => setOpen(false);
  const goToClaim = () => {
    close();
    document.getElementById('claim-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const custName = customer.name.trim() || 'Ana';
  const staffName = ownerName && ownerName !== businessName ? ownerName : businessName;
  const priceLabel = (s: DemoService) => (!s.hide_price && s.price > 0 ? ` · ${s.price} ${currency}` : '');

  return (
    <>
      {/* Services list (tappable) */}
      <div className="rounded-2xl border border-gray-200 bg-gray-50 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">Services we found</h2>
            <p className="mt-0.5 text-xs text-gray-500">Tap one to see how a customer books it. You can edit, add or remove any of these after claiming.</p>
          </div>
          {services.length > 0 && (
            <button onClick={() => start(services[0] as DemoService)} className="shrink-0 rounded-full bg-white px-3 py-1 text-xs font-semibold text-brand-700 shadow-sm ring-1 ring-brand-100 hover:bg-brand-50">
              Try a booking
            </button>
          )}
        </div>
        <ul className="mt-3 divide-y divide-gray-200">
          {services.length === 0 && <li className="py-2 text-sm text-gray-400">No services yet. Add them in your dashboard.</li>}
          {services.map((s) => (
            <li key={s.id}>
              <button onClick={() => start(s)} className="flex w-full items-center justify-between py-2.5 text-left text-sm hover:text-brand-700">
                <span className="text-gray-900">{s.name}</span>
                <span className="flex items-center gap-2 text-gray-500">
                  {s.duration_minutes} min{priceLabel(s)}
                  <span aria-hidden className="text-gray-300">›</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Simulated booking */}
      {open && service && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={close}>
          <div className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">Preview · nothing is booked</p>
                <h3 className="text-base font-semibold text-gray-900">{businessName}</h3>
              </div>
              <button onClick={close} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>

            {step < 5 && (
              <div className="mt-3 flex items-center gap-1.5">
                {[1, 2, 3, 4].map((n) => (
                  <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? 'bg-brand-600' : 'bg-gray-200'}`} />
                ))}
                <span className="ml-2 text-[11px] text-gray-400">Step {step} of 4</span>
              </div>
            )}

            {/* Step 1: service */}
            {step === 1 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900">Choose a service</h4>
                <ul className="mt-2 space-y-1.5">
                  {services.map((s) => (
                    <li key={s.id}>
                      <button
                        onClick={() => setService(s)}
                        className={`flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm ${s.id === service.id ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-gray-200 text-gray-800 hover:bg-gray-50'}`}
                      >
                        <span>{s.name}</span>
                        <span className="text-xs text-gray-500">{s.duration_minutes} min{priceLabel(s)}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <button onClick={() => setStep(2)} className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">Continue</button>
              </div>
            )}

            {/* Step 2: date */}
            {step === 2 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900">Pick a day</h4>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {days.map((d) => {
                    const closed = d.getDay() === 0;
                    const on = day?.toDateString() === d.toDateString();
                    return (
                      <button
                        key={d.toISOString()}
                        disabled={closed}
                        onClick={() => { setDay(d); setTime(null); }}
                        className={`rounded-xl border px-2 py-2 text-center text-xs ${closed ? 'border-gray-100 text-gray-300' : on ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-gray-200 text-gray-800 hover:bg-gray-50'}`}
                      >
                        <div className="font-semibold">{fmtDay(d, { weekday: 'short' })}</div>
                        <div>{fmtDay(d, { day: 'numeric', month: 'short' })}</div>
                        {closed && <div className="text-[10px]">closed</div>}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setStep(1)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
                  <button disabled={!day} onClick={() => setStep(3)} className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">Continue</button>
                </div>
              </div>
            )}

            {/* Step 3: time */}
            {step === 3 && day && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900">Pick a time · {fmtDay(day, { weekday: 'long', day: 'numeric', month: 'long' })}</h4>
                <p className="mt-0.5 text-xs text-gray-500">Greyed-out times are already taken. Real availability comes from your working hours.</p>
                <div className="mt-2 grid grid-cols-4 gap-1.5">
                  {slots.map((s) => (
                    <button
                      key={s.label}
                      disabled={s.taken}
                      onClick={() => setTime(s.label)}
                      className={`rounded-xl border px-2 py-2 text-sm ${s.taken ? 'border-gray-100 text-gray-300 line-through' : time === s.label ? 'border-brand-500 bg-brand-50 text-brand-900' : 'border-gray-200 text-gray-800 hover:bg-gray-50'}`}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setStep(2)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
                  <button disabled={!time} onClick={() => setStep(4)} className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-40">Continue</button>
                </div>
              </div>
            )}

            {/* Step 4: details */}
            {step === 4 && (
              <div className="mt-4">
                <h4 className="text-sm font-semibold text-gray-900">Customer details</h4>
                <p className="mt-0.5 text-xs text-gray-500">In the real flow customers sign in once; after that Balkina remembers them.</p>
                <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder="Name (e.g. Ana)" className={`mt-3 ${INPUT}`} />
                <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder="Phone (e.g. +381 60 123 4567)" className={`mt-2 ${INPUT}`} />
                <div className="mt-3 rounded-xl bg-gray-50 p-3 text-xs text-gray-600">
                  <div className="flex justify-between"><span>{service.name}</span><span>{service.duration_minutes} min{priceLabel(service)}</span></div>
                  <div className="mt-1 flex justify-between"><span>{day && fmtDay(day, { weekday: 'short', day: 'numeric', month: 'short' })} · {time}</span><span>with {staffName}</span></div>
                </div>
                <div className="mt-4 flex gap-2">
                  <button onClick={() => setStep(3)} className="rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Back</button>
                  <button onClick={() => setStep(5)} className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">Confirm booking</button>
                </div>
              </div>
            )}

            {/* Step 5: confirmation preview */}
            {step === 5 && day && (
              <div className="mt-4">
                <div className="rounded-2xl border border-green-200 bg-green-50 p-4">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white">✓</span>
                    <h4 className="text-base font-semibold text-gray-900">Booking confirmed</h4>
                  </div>
                  <dl className="mt-3 space-y-1 text-sm text-gray-700">
                    <div className="flex justify-between"><dt className="text-gray-500">Service</dt><dd>{service.name}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">When</dt><dd>{fmtDay(day, { weekday: 'short', day: 'numeric', month: 'short' })} at {time}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">With</dt><dd>{staffName}</dd></div>
                    <div className="flex justify-between"><dt className="text-gray-500">Customer</dt><dd>{custName}</dd></div>
                  </dl>
                </div>

                <div className="mt-3 rounded-2xl border border-gray-200 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">What {custName} receives</p>
                  <div className="mt-2 rounded-2xl rounded-tl-sm bg-gray-100 px-3 py-2 text-sm text-gray-800">
                    Hi {custName}, you&apos;re booked at {businessName}: {service.name}, {fmtDay(day, { weekday: 'long', day: 'numeric', month: 'long' })} at {time}. Reply here if you need to move it.
                  </div>
                  <p className="mt-2 text-xs text-gray-500">Plus an SMS reminder the day before, and a nudge when it&apos;s time to rebook.</p>
                </div>

                <div className="mt-3 rounded-2xl border border-gray-200 p-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">What you see</p>
                  <p className="mt-1 text-sm text-gray-700">The appointment lands in your calendar with {custName}&apos;s details. You can approve, move or message in one tap, from your phone.</p>
                </div>

                <div className="mt-4 rounded-2xl bg-brand-50 p-4 text-sm text-brand-900">
                  <p className="font-semibold">This is how booking will look for your customers.</p>
                  <p className="mt-1 text-brand-800">Nothing was booked just now. Claim the page and the same flow goes live under your name in about a minute.</p>
                  <button onClick={goToClaim} className="mt-3 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">Claim this page</button>
                  <button onClick={() => { setStep(1); setDay(null); setTime(null); }} className="mt-2 w-full text-xs text-brand-700 hover:underline">Try another booking</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
