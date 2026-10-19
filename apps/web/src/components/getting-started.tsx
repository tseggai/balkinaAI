'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useBusinessLabels } from '@/lib/useBusinessLabels';

/**
 * "Getting started" walkthrough for new (and claimed) tenants: a card on the
 * dashboard overview with a step-by-step guide behind it. Progress lives in
 * localStorage per tenant so the guide resumes where the owner left off after
 * they visit a page and come back. The empty-tenant wizard (no services yet)
 * still runs first; this guide takes over once there is something to review.
 */

export const APP_STORE_URL = 'https://apps.apple.com/us/app/balkina-ai/id6761651423';
export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.tseggaid.balkinaai';
export const SUPPORT_WHATSAPP = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? '';

export function supportWhatsAppHref(message: string): string | null {
  const digits = SUPPORT_WHATSAPP.replace(/[^\d]/g, '');
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(message)}` : null;
}

interface TenantInfo {
  id: string;
  name: string;
  slug: string | null;
}

interface Progress {
  step: number;
  done: boolean;
  dismissed: boolean;
}

const TOTAL_STEPS = 5;
const key = (tenantId: string) => `balkina_getting_started_${tenantId}`;

function readProgress(tenantId: string): Progress {
  try {
    const raw = localStorage.getItem(key(tenantId));
    if (raw) return { step: 1, done: false, dismissed: false, ...(JSON.parse(raw) as Partial<Progress>) };
  } catch {
    /* storage unavailable */
  }
  return { step: 1, done: false, dismissed: false };
}

function writeProgress(tenantId: string, p: Progress) {
  try {
    localStorage.setItem(key(tenantId), JSON.stringify(p));
  } catch {
    /* storage unavailable */
  }
}

export function GettingStarted() {
  const router = useRouter();
  const { labels } = useBusinessLabels();
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [tenantRes, svcRes] = await Promise.all([fetch('/api/tenant'), fetch('/api/services')]);
        if (cancelled) return;
        const tenantJson = await tenantRes.json();
        const svcJson = await svcRes.json();
        const t = tenantJson.data as TenantInfo | undefined;
        if (!t) return;
        const p = readProgress(t.id);
        setTenant(t);
        setProgress(p);
        // Auto-open once, and only when the empty-tenant wizard is not showing.
        const hasServices = (svcJson.data ?? []).length > 0;
        const seenKey = `${key(t.id)}_seen`;
        if (hasServices && !p.done && !p.dismissed && !localStorage.getItem(seenKey)) {
          localStorage.setItem(seenKey, '1');
          setOpen(true);
        }
      } catch {
        /* never block the dashboard */
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const update = useCallback(
    (patch: Partial<Progress>) => {
      if (!tenant || !progress) return;
      const next = { ...progress, ...patch };
      setProgress(next);
      writeProgress(tenant.id, next);
    },
    [tenant, progress],
  );

  if (!tenant || !progress || progress.dismissed) return null;

  const bookingUrl = tenant.slug ? `https://balkina.ai/b/${tenant.slug}` : null;
  const supportHref = supportWhatsAppHref(`Hi! I'm setting up ${tenant.name} on Balkina and have a question.`);
  const step = Math.min(Math.max(progress.step, 1), TOTAL_STEPS);
  const isHosp = labels.service !== 'Service';

  const copyLink = async () => {
    if (!bookingUrl) return;
    try {
      await navigator.clipboard.writeText(bookingUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };
  const goTo = (href: string) => {
    setOpen(false);
    router.push(href);
  };
  const next = () => {
    if (step >= TOTAL_STEPS) {
      update({ done: true, step: TOTAL_STEPS });
      setOpen(false);
      return;
    }
    update({ step: step + 1 });
  };
  const back = () => update({ step: Math.max(1, step - 1) });

  const steps: { title: string; body: string; action?: { label: string; href: string } }[] = [
    {
      title: `${tenant.name} is live on Balkina`,
      body: bookingUrl
        ? `Customers can already ${labels.book.toLowerCase()} you at ${bookingUrl.replace('https://', '')}. Take five minutes to make the page yours — we'll walk you through it.`
        : "Take five minutes to make the page yours — we'll walk you through it.",
    },
    {
      title: `Check your ${labels.services.toLowerCase()} and prices`,
      body: isHosp
        ? 'We added your experiences from what we found online. Check names, prices and durations, and add anything missing.'
        : 'We added your services from what we found online. Check names, prices and durations, and add anything missing.',
      action: { label: `Open ${labels.services}`, href: '/dashboard/services' },
    },
    {
      title: 'Set your working hours',
      body: `Customers only see free times inside your hours. Open ${labels.staff} and set the days and hours you take ${labels.bookings.toLowerCase()}.`,
      action: { label: 'Set working hours', href: '/dashboard/staff' },
    },
    {
      title: 'Add your logo, phone and address',
      body: 'A logo and a correct address make the page feel like yours and help customers find you. You can also pick your category and language here.',
      action: { label: 'Open Settings', href: '/dashboard/settings' },
    },
    {
      title: 'Share your link and get the app',
      body: 'Put your link in your Instagram bio and Google profile. Install the app to get every new booking as a notification on your phone.',
    },
  ];
  const current = steps[step - 1] ?? { title: '', body: '' };
  const action = current.action;

  return (
    <>
      {/* Card on the overview */}
      <div className="mt-5 rounded-xl border border-brand-200 bg-brand-50 p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Getting started</p>
            <h2 className="mt-1 text-lg font-semibold text-gray-900">
              {progress.done ? 'You are all set' : `Set up ${tenant.name} in ${TOTAL_STEPS} short steps`}
            </h2>
            <p className="mt-1 text-sm text-gray-600">
              {progress.done
                ? 'Need anything? Support is one tap away, and the app keeps you posted on every booking.'
                : `Step ${step} of ${TOTAL_STEPS} · ${current.title}`}
            </p>
            {!progress.done && (
              <div className="mt-3 flex max-w-xs items-center gap-1.5">
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                  <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-brand-600' : 'bg-brand-200'}`} />
                ))}
              </div>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {!progress.done && (
              <button onClick={() => setOpen(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                {step === 1 ? 'Start' : 'Continue'}
              </button>
            )}
            {supportHref && (
              <a href={supportHref} target="_blank" rel="noopener" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                Support
              </a>
            )}
            <a href={APP_STORE_URL} target="_blank" rel="noopener" className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Get the app
            </a>
            <button onClick={() => update({ dismissed: true })} aria-label="Dismiss" className="rounded-lg p-2 text-gray-400 hover:bg-white hover:text-gray-600">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </div>
      </div>

      {/* Step-by-step guide */}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onClick={() => setOpen(false)}>
          <div className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 pt-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Step {step} of {TOTAL_STEPS}</p>
              <button onClick={() => setOpen(false)} aria-label="Close" className="-mr-2 rounded-full p-2 text-gray-400 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="mt-3 flex items-center gap-1.5 px-6">
              {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                <span key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-brand-600' : 'bg-gray-200'}`} />
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 pt-5">
              <h2 className="text-xl font-semibold text-gray-900">{current.title}</h2>
              <p className="mt-2 text-base leading-relaxed text-gray-600">{current.body}</p>

              {step === 1 && bookingUrl && (
                <div className="mt-5 rounded-xl bg-gray-50 px-4 py-3">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">Your booking link</p>
                  <p className="mt-0.5 break-all text-base text-gray-900">{bookingUrl}</p>
                </div>
              )}

              {action && (
                <button onClick={() => goTo(action.href)} className="mt-5 w-full rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 text-base font-semibold text-brand-700 hover:bg-brand-100">
                  {action.label} →
                </button>
              )}

              {step === TOTAL_STEPS && (
                <div className="mt-5 space-y-3">
                  {bookingUrl && (
                    <div className="grid grid-cols-2 gap-2">
                      <a href={bookingUrl} target="_blank" rel="noopener" className="rounded-xl border border-gray-200 px-4 py-3 text-center text-base font-semibold text-gray-900 hover:bg-gray-50">View page</a>
                      <button onClick={copyLink} className="rounded-xl bg-gray-900 px-4 py-3 text-base font-semibold text-white hover:bg-gray-800">{copied ? 'Copied ✓' : 'Copy link'}</button>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-2">
                    <a href={APP_STORE_URL} target="_blank" rel="noopener" className="rounded-xl border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50">App Store</a>
                    <a href={PLAY_STORE_URL} target="_blank" rel="noopener" className="rounded-xl border border-gray-200 px-4 py-3 text-center text-sm font-semibold text-gray-900 hover:bg-gray-50">Google Play</a>
                  </div>
                </div>
              )}

              {supportHref && (
                <a href={supportHref} target="_blank" rel="noopener" className="mt-5 flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 px-4 py-3 text-sm font-medium text-[#128C7E] hover:bg-green-50">
                  Stuck? Message us on WhatsApp
                </a>
              )}
            </div>

            <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-6 py-4">
              <button onClick={back} disabled={step === 1} className="rounded-xl px-4 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 disabled:opacity-30">
                Back
              </button>
              <button onClick={next} className="rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                {step === TOTAL_STEPS ? 'Finish' : 'Next'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** Small "Help" block for the sidebar: support + the app. */
export function HelpLinks({ onNavigate }: { onNavigate?: () => void }) {
  const supportHref = supportWhatsAppHref("Hi! I'm using Balkina and have a question.");
  return (
    <div className="space-y-0.5 px-2 pb-2">
      {supportHref && (
        <a href={supportHref} target="_blank" rel="noopener" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
          <span className="inline-block h-2 w-2 rounded-full bg-[#25D366]" aria-hidden />
          WhatsApp support
        </a>
      )}
      <Link href={APP_STORE_URL} target="_blank" rel="noopener" onClick={onNavigate} className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 0 0 6 3.75v16.5a2.25 2.25 0 0 0 2.25 2.25h7.5A2.25 2.25 0 0 0 18 20.25V3.75a2.25 2.25 0 0 0-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>
        Manage in the app
      </Link>
    </div>
  );
}
