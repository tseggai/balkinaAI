'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { ClaimForm } from './claim-form';
import { ClaimDemo, type DemoService } from './claim-demo';
import { CLAIM_T, CLAIM_LANG_KEY, type ClaimLang } from '@/lib/claim/i18n';

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

export function ClaimPage({ data }: { data: ClaimPageData }) {
  const [lang, setLang] = useState<ClaimLang>('sr');
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CLAIM_LANG_KEY);
      if (saved === 'en' || saved === 'sr') setLang(saved);
    } catch {
      /* storage unavailable */
    }
  }, []);
  const switchLang = (l: ClaimLang) => {
    setLang(l);
    try {
      localStorage.setItem(CLAIM_LANG_KEY, l);
    } catch {
      /* storage unavailable */
    }
  };
  const t = CLAIM_T[lang];
  const bookingUrl = data.slug ? `balkina.ai/b/${data.slug}` : null;
  const reservedUntil = data.claimExpiresAt
    ? new Date(data.claimExpiresAt).toLocaleDateString(t.dateLocale, { day: 'numeric', month: 'long' })
    : null;
  const scrollToClaim = () => document.getElementById('claim-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const whatsappHref = data.supportWhatsApp
    ? `https://wa.me/${data.supportWhatsApp.replace(/[^\d]/g, '')}?text=${encodeURIComponent(t.whatsappMessage(data.displayName))}`
    : null;

  return (
    <div className="pb-24 md:pb-0">
      {/* Minimal header: logo + language only — no competing CTAs */}
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Image src="/assets/Balkina_logo_color.png" alt="Balkina" width={130} height={36} className="h-6 w-auto md:h-7" priority />
        <div className="flex overflow-hidden rounded-full border border-gray-200 text-[11px] font-bold">
          {(['sr', 'en'] as ClaimLang[]).map((l) => (
            <button key={l} onClick={() => switchLang(l)} className={`px-3 py-1.5 uppercase ${lang === l ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}>
              {CLAIM_T[l].langLabel}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-4 md:py-12">
        <div className="grid gap-6 md:grid-cols-5 md:gap-x-10">
          <div className="min-w-0 md:col-span-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{t.eyebrow}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 md:text-4xl">
              {data.ownerFirstName ? t.greeting(data.ownerFirstName) : t.greetingNoName}
            </h1>
            <p className="mt-1.5 text-sm text-gray-600 md:text-base">{t.lede}</p>

            {/* Business identity + proof */}
            <div className="mt-4 min-w-0 rounded-2xl border border-gray-200 bg-white p-4">
              <p className="text-lg font-semibold text-gray-900">{data.displayName}</p>
              {data.fullName !== data.displayName && <p className="mt-0.5 text-xs text-gray-400">{data.fullName}</p>}
              {data.address && <p className="mt-1 text-sm text-gray-500">{data.address}</p>}
              {data.googleRating != null && (
                <p className="mt-2 flex items-center gap-1.5 text-sm">
                  <span className="text-amber-500">{'★'.repeat(Math.round(data.googleRating))}</span>
                  <span className="font-semibold text-gray-900">{data.googleRating.toFixed(1)}</span>
                  {data.googleReviewCount != null && <span className="text-gray-500">· {t.googleReviews(data.googleReviewCount)}</span>}
                </p>
              )}
              {bookingUrl && (
                <div className="mt-3 min-w-0 rounded-xl bg-brand-50 px-3 py-2">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{t.yourLink}</p>
                  <p className="break-all font-mono text-[13px] leading-snug text-brand-900">{bookingUrl}</p>
                  <p className="text-[11px] text-brand-700">{t.yourLinkHint}</p>
                </div>
              )}
            </div>

          </div>

          {/* Claim card: directly under the identity card on mobile, right column on desktop */}
          <div className="min-w-0 md:col-span-2 md:col-start-4 md:row-span-2 md:row-start-1">
            <ClaimForm token={data.token} businessName={data.displayName} defaultOwnerName={data.ownerName} defaultEmail={data.email} t={t} />
            {reservedUntil && <p className="mt-2 text-xs font-medium text-amber-700">⏳ {t.reservedUntil(reservedUntil)}</p>}
            <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
              {t.benefits.map((b) => (
                <li key={b}>✓ {b}</li>
              ))}
            </ul>
            {whatsappHref && (
              <a href={whatsappHref} target="_blank" rel="noopener" className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-[#25D366]/40 bg-white px-4 py-2.5 text-sm font-semibold text-[#128C7E] hover:bg-green-50">
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z"/></svg>
                {t.whatsappCta}
              </a>
            )}
            <p className="mt-3 text-xs text-gray-400">
              <span className="font-medium text-gray-500">{t.notYours}</span> {t.notYoursBody}
            </p>
          </div>

          <div className="min-w-0 md:col-span-3">
            <ClaimDemo businessName={data.displayName} ownerName={data.ownerName} currency={data.currency} services={data.services} t={t} />
          </div>
        </div>
      </div>

      {/* Sticky mobile CTA — visible from the first screen */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-gray-200 bg-white/95 p-3 backdrop-blur md:hidden">
        <button onClick={scrollToClaim} className="w-full rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white shadow-lg hover:bg-brand-700">
          {t.stickyButton}
        </button>
      </div>
    </div>
  );
}
