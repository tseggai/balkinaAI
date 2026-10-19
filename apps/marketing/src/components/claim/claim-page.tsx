'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ClaimForm } from './claim-form';
import { ClaimDemo, type DemoService } from './claim-demo';
import { Sheet } from './sheet';
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
 * The page stays short: services only appear inside the booking sheet, and
 * activation lives in its own sheet opened by the CTA. The booking link is
 * revealed after activation (share screen).
 */
export function ClaimPage({ data }: { data: ClaimPageData }) {
  const [lang, setLang] = useState<ClaimLang>('sr');
  const [activateOpen, setActivateOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);

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
  const openDemo = () => {
    trackClaim(data.token, 'claim_demo_opened', { lang });
    setDemoOpen(true);
  };

  return (
    <div className="overflow-x-hidden pb-28">
      <header className="mx-auto flex max-w-2xl items-center justify-between px-6 py-5">
        <Image src="/assets/Balkina_logo_color.png" alt="Balkina" width={130} height={36} className="h-6 w-auto md:h-7" priority />
        <div className="flex items-center gap-2">
          {whatsappHref && (
            <a
              href={whatsappHref}
              target="_blank"
              rel="noopener"
              aria-label={t.whatsappCta}
              title={t.whatsappCta}
              onClick={() => trackClaim(data.token, 'claim_whatsapp_support', { lang })}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-[#25D366] text-white hover:brightness-95"
            >
              <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
            </a>
          )}
          <div className="flex overflow-hidden rounded-full border border-gray-200/80 text-[11px] font-semibold">
            {(['sr', 'en'] as ClaimLang[]).map((l) => (
              <button key={l} onClick={() => switchLang(l)} className={`px-3 py-1.5 uppercase ${lang === l ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}>
                {CLAIM_T[l].langLabel}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-6 pt-1 md:pt-6">
        {/* 1 · The business — theirs, prominent */}
        <section className="rounded-2xl bg-brand-50 px-6 py-7 md:px-8 md:py-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 md:text-3xl">{data.displayName}</h1>
          {data.fullName !== data.displayName && <p className="mt-1.5 text-sm text-gray-500">{data.fullName}</p>}
          {data.address && <p className="mt-3 text-base text-gray-600">{data.address}</p>}
          {data.googleRating != null && (
            <p className="mt-3 flex items-center gap-2 text-base">
              <span className="text-amber-500">{'★'.repeat(Math.round(data.googleRating))}</span>
              <span className="font-medium text-gray-900">{data.googleRating.toFixed(1)}</span>
              {data.googleReviewCount != null && <span className="text-gray-500">· {t.googleReviews(data.googleReviewCount)}</span>}
            </p>
          )}
        </section>

        {/* 2 · What we did — a short message, not a headline */}
        <section>
          <p className="text-lg leading-relaxed text-gray-900">
            {data.ownerFirstName ? (
              <>
                {data.ownerFirstName},
                <br />
                {t.welcomeMessage}
              </>
            ) : (
              t.welcomeMessageNoName
            )}
          </p>
        </section>

        {/* 3 · Test it */}
        <section>
          <button onClick={openDemo} className="flex w-full items-center justify-between gap-4 rounded-2xl bg-brand-600 px-6 py-5 text-left text-white shadow-sm hover:bg-brand-700">
            <span className="min-w-0">
              <span className="block text-lg font-semibold">{t.testButton}</span>
              <span className="mt-1 block text-sm text-brand-100">{t.testHint(data.services.length)}</span>
            </span>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-brand-600">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </span>
          </button>
          <button onClick={openActivate} className="mt-3 hidden w-full rounded-2xl border-2 border-brand-600 px-5 py-4 text-base font-semibold text-brand-700 hover:bg-brand-50 md:block">
            {t.stickyButton}
          </button>
        </section>

        {/* 4 · Offer + benefits */}
        <section className="space-y-2.5 text-base leading-snug">
          {reservedUntil && <p className="text-amber-700">⏳ {t.reservedUntil(reservedUntil)}</p>}
          <ul className="space-y-1 text-gray-600">
            {t.benefits.map((b) => (
              <li key={b}>✓ {b}</li>
            ))}
          </ul>
        </section>
      </main>

      {/* Sticky CTA (mobile) — the page is short, so it is always in reach */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-100 bg-white/95 px-6 py-3 backdrop-blur md:hidden">
        <button onClick={openActivate} className="w-full rounded-2xl bg-brand-600 px-5 py-4 text-base font-semibold text-white shadow-lg hover:bg-brand-700">
          {t.stickyButton}
        </button>
      </div>

      <ClaimDemo
        open={demoOpen}
        onClose={() => setDemoOpen(false)}
        businessName={data.displayName}
        ownerName={data.ownerName}
        currency={data.currency}
        services={data.services}
        t={t}
        onEvent={() => trackClaim(data.token, 'claim_demo_completed', { lang })}
        onActivate={openActivate}
      />

      <Sheet open={activateOpen} onClose={() => setActivateOpen(false)} eyebrow={data.displayName}>
        <ClaimForm token={data.token} businessName={data.displayName} defaultOwnerName={data.ownerName} defaultEmail={data.email} bookingUrlPreview={data.slug ? `https://balkina.ai/b/${data.slug}` : null} t={t} />
      </Sheet>
    </div>
  );
}
