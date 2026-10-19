'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ClaimForm } from './claim-form';
import { ClaimDemo, type DemoService } from './claim-demo';
import { CLAIM_T, CLAIM_LANG_KEY, type ClaimLang } from '@/lib/claim/i18n';
import { trackClaim } from '@/lib/claim/track';

export interface ClaimPageData {
  token: string;
  fullName: string;
  displayName: string;
  ownerFirstName: string | null;
  ownerName: string;
  email: string;
  address: string | null;
  slug: string | null;
  currency: string;
  googleRating: number | null;
  googleReviewCount: number | null;
  claimExpiresAt: string | null;
  supportWhatsApp: string | null;
  services: DemoService[];
}

/**
 * Hierarchy: the business (theirs) → what we did → test it → activate.
 * Activation lives in a sheet opened by the CTA, so the page itself stays
 * short; the booking link is only revealed after activation (share screen).
 */
export function ClaimPage({ data }: { data: ClaimPageData }) {
  const [lang, setLang] = useState<ClaimLang>('sr');
  const [activateOpen, setActivateOpen] = useState(false);

  useEffect(() => {
    let initial: ClaimLang = 'sr';
    try {
      const saved = localStorage.getItem(CLAIM_LANG_KEY);
      if (saved === 'en' || saved === 'sr') initial = saved;
    } catch {
      /* storage unavailable */
    }
    setLang(initial);
    trackClaim(data.token, 'claim_page_view', { lang: initial, mobile: window.innerWidth < 768 });
  }, [data.token]);

  const switchLang = (l: ClaimLang) => {
    setLang(l);
    try {
      localStorage.setItem(CLAIM_LANG_KEY, l);
    } catch {
      /* storage unavailable */
    }
  };
  const t = CLAIM_T[lang];
  const reservedUntil = data.claimExpiresAt
    ? new Date(data.claimExpiresAt).toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'long' })
    : null;
  const whatsappHref = data.supportWhatsApp
    ? `https://wa.me/${data.supportWhatsApp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(t.whatsappMessage(data.displayName))}`
    : null;
  const openActivate = () => {
    trackClaim(data.token, 'claim_activate_opened', { lang });
    setActivateOpen(true);
  };

  return (
    <div className="pb-24">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4">
        <Image src="/assets/Balkina_logo_color.png" alt="Balkina" width={130} height={36} className="h-6 w-auto md:h-7" priority />
        <div className="flex overflow-hidden rounded-full border border-gray-200 text-[11px] font-bold">
          {(['sr', 'en'] as ClaimLang[]).map((l) => (
            <button key={l} onClick={() => switchLang(l)} className={`px-3 py-1.5 uppercase ${lang === l ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}>
              {CLAIM_T[l].langLabel}
            </button>
          ))}
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-8 px-5 pt-2 md:pt-6">
        {/* 1 · The business — theirs, prominent */}
        <section className="rounded-2xl border-2 border-gray-900 bg-white p-5 md:p-6">
          <h1 className="text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">{data.displayName}</h1>
          {data.fullName !== data.displayName && <p className="mt-1 text-xs text-gray-400">{data.fullName}</p>}
          {data.address && <p className="mt-2 text-sm text-gray-600">{data.address}</p>}
          {data.googleRating != null && (
            <p className="mt-2 flex items-center gap-1.5 text-sm">
              <span className="text-amber-500">{'★'.repeat(Math.round(data.googleRating))}</span>
              <span className="font-semibold text-gray-900">{data.googleRating.toFixed(1)}</span>
              {data.googleReviewCount != null && <span className="text-gray-500">· {t.googleReviews(data.googleReviewCount)}</span>}
            </p>
          )}
        </section>

        {/* 2 · What we did */}
        <section>
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{t.welcomeEyebrow}</p>
          <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 md:text-3xl">
            {data.ownerFirstName ? t.welcomeTitle(data.ownerFirstName) : t.welcomeTitleNoName}
          </h2>
          <p className="mt-2 text-base text-gray-600">{t.welcomeLede}</p>
        </section>

        {/* 3 · Test it */}
        <section>
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-brand-600">{t.servicesEyebrow}</p>
          <ClaimDemo
            businessName={data.displayName}
            ownerName={data.ownerName}
            currency={data.currency}
            services={data.services}
            t={t}
            onEvent={(e) => trackClaim(data.token, e === 'opened' ? 'claim_demo_opened' : 'claim_demo_completed', { lang })}
            onActivate={openActivate}
          />
          <button onClick={openActivate} className="mt-4 hidden w-full rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-brand-700 md:block">
            {t.stickyButton}
          </button>
        </section>

        {/* 4 · Disclaimer + help */}
        <section className="space-y-3 text-sm">
          {reservedUntil && <p className="font-medium text-amber-700">⏳ {t.reservedUntil(reservedUntil)}</p>}
          <ul className="space-y-1 text-gray-600">
            {t.benefits.map((b) => (
              <li key={b}>✓ {b}</li>
            ))}
          </ul>
          {whatsappHref && (
            <a href={whatsappHref} target="_blank" rel="noopener" onClick={() => trackClaim(data.token, 'claim_whatsapp_support', { lang })} className="flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-white px-4 py-2.5 font-semibold text-[#128C7E] hover:bg-green-50">
              <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
              {t.whatsappCta}
            </a>
          )}
          <p className="text-xs text-gray-400">
            <span className="font-medium text-gray-500">{t.notYours}</span> {t.notYoursBody}
          </p>
        </section>
      </main>

      {/* Sticky CTA (mobile) */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <button onClick={openActivate} className="w-full rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-700">
          {t.stickyButton}
        </button>
      </div>

      {/* Activation sheet — same presentation as the booking test */}
      {activateOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onClick={() => setActivateOpen(false)}>
          <div className="max-h-[94vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-white shadow-xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 pt-4">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{data.displayName}</p>
              <button onClick={() => setActivateOpen(false)} aria-label="Close" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <ClaimForm token={data.token} businessName={data.displayName} defaultOwnerName={data.ownerName} defaultEmail={data.email} t={t} />
          </div>
        </div>
      )}
    </div>
  );
}
