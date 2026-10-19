'use client';

import { useEffect, useMemo, useState } from 'react';
import type { ClaimCopy } from '@/lib/claim/i18n';
import { Sheet } from './sheet';

/**
 * Simulated booking flow for an unclaimed page: the business owner walks
 * through service → date → time → details → confirmation exactly as a
 * customer would, but nothing is written anywhere. Ends with what the
 * customer sees, what the business sees, and a nudge to claim.
 */

export interface DemoService {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  hide_price: boolean | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  businessName: string;
  ownerName: string;
  currency: string;
  services: DemoService[];
  t: ClaimCopy;
  onEvent?: (type: 'completed') => void;
  onActivate?: () => void;
}

const OPEN_HOUR = 9;
const CLOSE_HOUR = 17;
const SLOT_MINUTES = 30;
// 16px text keeps iOS from zooming the page when an input is focused.
const INPUT = 'w-full rounded-2xl border border-gray-200/80 bg-white px-4 py-3.5 text-base text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors';
const PRIMARY = 'w-full rounded-2xl bg-brand-600 px-4 py-3.5 text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-40';
const SECONDARY = 'rounded-2xl border border-gray-200/80 px-5 py-3.5 text-base font-medium text-gray-700 hover:bg-gray-50';
const LABEL = 'text-[11px] font-semibold uppercase tracking-wider text-gray-400';

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

export function ClaimDemo({ open, onClose, businessName, ownerName, currency, services, t, onEvent, onActivate }: Props) {
  const fd = (d: Date, opts: Intl.DateTimeFormatOptions) => d.toLocaleDateString(t.dateLocale, opts);
  const [service, setService] = useState<DemoService | null>(null);
  const [step, setStep] = useState(1);
  const [day, setDay] = useState<Date | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [customer, setCustomer] = useState({ name: '', phone: '' });

  const days = useMemo(() => nextDays(7), []);
  const slots = useMemo(() => (day && service ? slotsFor(day, service.duration_minutes) : []), [day, service]);

  // Every open starts a fresh booking.
  useEffect(() => {
    if (open) {
      setService(null);
      setStep(1);
      setDay(null);
      setTime(null);
    }
  }, [open]);

  const goToClaim = () => {
    onClose();
    onActivate?.();
  };

  const custName = customer.name.trim() || 'Ana';
  const custPhone = customer.phone.trim() || '+382 67 123 456';
  const staffName = ownerName && ownerName !== businessName ? ownerName : businessName;
  const priceLabel = (s: DemoService) => (!s.hide_price && s.price > 0 ? ` · ${s.price} ${currency}` : '');
  const priceValue = (s: DemoService) => (!s.hide_price && s.price > 0 ? `${s.price} ${currency}` : '—');
  const whenShort = day ? `${fd(day, { weekday: 'short', day: 'numeric', month: 'short' })} ${t.demoAt} ${time}` : '';

  return (
    <Sheet open={open} onClose={onClose} eyebrow={t.demoPreview} scrollKey={step}>
      {step < 5 && (
        <div className="flex items-center gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <span key={n} className={`h-1 flex-1 rounded-full ${n <= step ? 'bg-brand-500' : 'bg-gray-100'}`} />
          ))}
          <span className="ml-2 text-[11px] text-gray-400">{t.demoStep(step)}</span>
        </div>
      )}

      {/* Step 1: service */}
      {step === 1 && (
        <div className="mt-5">
          <h4 className="text-lg font-semibold text-gray-900">{t.demoChooseService}</h4>
          {services.length === 0 && <p className="mt-3 text-base text-gray-400">{t.noServices}</p>}
          <ul className="mt-3 space-y-2">
            {services.map((s) => {
              const on = s.id === service?.id;
              return (
                <li key={s.id}>
                  <button
                    onClick={() => setService(s)}
                    className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-4 text-left ${on ? 'border-brand-400 bg-brand-50 text-brand-900' : 'border-gray-200/80 text-gray-800 hover:bg-gray-50'}`}
                  >
                    <span className="min-w-0 truncate text-base font-medium">{s.name}</span>
                    <span className="shrink-0 text-sm text-gray-500">{s.duration_minutes} min{priceLabel(s)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-gray-400">{t.editLater}</p>
          <button disabled={!service} onClick={() => setStep(2)} className={`mt-5 ${PRIMARY}`}>{t.demoContinue}</button>
        </div>
      )}

      {/* Step 2: date */}
      {step === 2 && service && (
        <div className="mt-5">
          <h4 className="text-lg font-semibold text-gray-900">{t.demoPickDay}</h4>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {days.map((d) => {
              const closed = d.getDay() === 0;
              const on = day?.toDateString() === d.toDateString();
              return (
                <button
                  key={d.toISOString()}
                  disabled={closed}
                  onClick={() => { setDay(d); setTime(null); }}
                  className={`rounded-2xl border px-2 py-3 text-center text-sm ${closed ? 'border-gray-100 text-gray-300' : on ? 'border-brand-400 bg-brand-50 text-brand-900' : 'border-gray-200/80 text-gray-800 hover:bg-gray-50'}`}
                >
                  <div className="font-semibold">{fd(d, { weekday: 'short' })}</div>
                  <div className="text-xs">{fd(d, { day: 'numeric', month: 'short' })}</div>
                  {closed && <div className="text-[10px]">{t.demoClosed}</div>}
                </button>
              );
            })}
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setStep(1)} className={SECONDARY}>{t.demoBack}</button>
            <button disabled={!day} onClick={() => setStep(3)} className={`flex-1 ${PRIMARY}`}>{t.demoContinue}</button>
          </div>
        </div>
      )}

      {/* Step 3: time */}
      {step === 3 && service && day && (
        <div className="mt-5">
          <h4 className="text-lg font-semibold text-gray-900">{t.demoPickTime}</h4>
          <p className="mt-1 text-sm text-gray-500">{fd(day, { weekday: 'long', day: 'numeric', month: 'long' })} · {t.demoTimeHint}</p>
          <div className="mt-3 grid grid-cols-4 gap-2">
            {slots.map((s) => (
              <button
                key={s.label}
                disabled={s.taken}
                onClick={() => setTime(s.label)}
                className={`rounded-2xl border px-2 py-3 text-base ${s.taken ? 'border-gray-100 text-gray-300 line-through' : time === s.label ? 'border-brand-400 bg-brand-50 text-brand-900' : 'border-gray-200/80 text-gray-800 hover:bg-gray-50'}`}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setStep(2)} className={SECONDARY}>{t.demoBack}</button>
            <button disabled={!time} onClick={() => setStep(4)} className={`flex-1 ${PRIMARY}`}>{t.demoContinue}</button>
          </div>
        </div>
      )}

      {/* Step 4: details */}
      {step === 4 && service && (
        <div className="mt-5">
          <h4 className="text-lg font-semibold text-gray-900">{t.demoDetails}</h4>
          <p className="mt-1 text-sm text-gray-500">{t.demoDetailsHint}</p>
          <input value={customer.name} onChange={(e) => setCustomer({ ...customer, name: e.target.value })} placeholder={t.demoNamePh} className={`mt-4 ${INPUT}`} />
          <input value={customer.phone} onChange={(e) => setCustomer({ ...customer, phone: e.target.value })} placeholder={t.demoPhonePh} inputMode="tel" className={`mt-2.5 ${INPUT}`} />
          <div className="mt-4 rounded-2xl bg-gray-50 px-4 py-3.5 text-sm text-gray-600">
            <div className="flex justify-between gap-3"><span className="min-w-0 truncate">{service.name}</span><span className="shrink-0">{service.duration_minutes} min{priceLabel(service)}</span></div>
            <div className="mt-1.5 flex justify-between gap-3"><span>{whenShort}</span><span className="shrink-0">{t.demoWith} {staffName}</span></div>
          </div>
          <div className="mt-5 flex gap-2">
            <button onClick={() => setStep(3)} className={SECONDARY}>{t.demoBack}</button>
            <button onClick={() => { onEvent?.('completed'); setStep(5); }} className={`flex-1 ${PRIMARY}`}>{t.demoConfirm}</button>
          </div>
        </div>
      )}

      {/* Step 5: confirmation — what the customer sees, then what the business sees */}
      {step === 5 && service && day && (
        <div className="mt-3 space-y-6">
          <section>
            <p className={LABEL}>{t.demoCustomerSees}</p>
            <div className="mt-2 rounded-2xl bg-green-50 p-5">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-sm text-white">✓</span>
                <h4 className="text-lg font-semibold text-gray-900">{t.demoConfirmed}</h4>
              </div>
              <dl className="mt-4 space-y-2 text-base text-gray-800">
                <Row k={t.demoService} v={service.name} />
                <Row k={t.demoWhen} v={whenShort} />
                <Row k={t.demoWithLabel} v={staffName} />
                <Row k={t.demoPrice} v={priceValue(service)} />
              </dl>
              <p className="mt-4 text-sm text-gray-500">{t.demoReminderBody}</p>
            </div>
          </section>

          <section>
            <p className={LABEL}>{t.demoBusinessSees}</p>
            {/* The owner's phone: a push notification exactly as Balkina sends it */}
            <div className="mt-2 flex items-start gap-3 rounded-2xl bg-gray-900 px-4 py-3 text-white shadow-lg">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold">b</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[13px] font-semibold">{t.demoPushTitle}</span>
                  <span className="text-[11px] text-gray-400">{t.demoNow}</span>
                </div>
                <p className="truncate text-[13px] text-gray-200">{t.demoPushBody(custName, service.name, whenShort)}</p>
              </div>
            </div>
            {/* The appointment as it appears in the dashboard / app */}
            <div className="mt-2 rounded-2xl bg-gray-50 p-5">
              <div className="flex items-center justify-between gap-3">
                <p className="text-base font-semibold text-gray-900">{custName}</p>
                <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">{t.demoStatusConfirmed}</span>
              </div>
              <dl className="mt-3 space-y-2 text-base text-gray-800">
                <Row k={t.demoPhone} v={custPhone} />
                <Row k={t.demoService} v={`${service.name} · ${service.duration_minutes} min`} />
                <Row k={t.demoWhen} v={whenShort} />
                <Row k={t.demoWithLabel} v={staffName} />
                <Row k={t.demoPrice} v={priceValue(service)} />
              </dl>
              <div className="mt-4 flex gap-2">
                {t.demoActions.map((a) => (
                  <span key={a} className="flex-1 rounded-xl border border-gray-200/80 bg-white py-2 text-center text-sm font-medium text-gray-700">{a}</span>
                ))}
              </div>
              <p className="mt-3 text-sm text-gray-500">{t.demoBusinessSeesBody}</p>
            </div>
          </section>

          <section className="rounded-2xl bg-brand-50 p-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{t.demoDisclaimerEyebrow}</p>
            <p className="mt-2 text-base text-brand-900">{t.demoDisclaimerBody}</p>
            <button onClick={goToClaim} className={`mt-4 ${PRIMARY}`}>{t.demoClaim}</button>
            <button onClick={() => { setStep(1); setService(null); setDay(null); setTime(null); }} className="mt-3 w-full text-sm text-brand-700 hover:underline">{t.demoAgain}</button>
          </section>
        </div>
      )}
    </Sheet>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="shrink-0 text-gray-500">{k}</dt>
      <dd className="min-w-0 truncate text-right">{v}</dd>
    </div>
  );
}
