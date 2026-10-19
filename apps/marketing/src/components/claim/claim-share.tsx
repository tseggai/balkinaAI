'use client';

import { useState } from 'react';
import type { ClaimCopy } from '@/lib/claim/i18n';

interface Props {
  businessName: string;
  bookingUrl: string | null;
  loginUrl: string;
  t: ClaimCopy;
}

/**
 * Shown right after a successful claim, while the owner is still excited:
 * their link with one-tap copy / WhatsApp / native share, then the dashboard.
 */
export function ClaimShare({ businessName, bookingUrl, loginUrl, t }: Props) {
  const [copied, setCopied] = useState(false);
  const url = bookingUrl ?? '';
  const message = t.shareMessage(businessName, url);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the field below is selectable */
    }
  };
  const nativeShare = async () => {
    try {
      await navigator.share({ title: businessName, text: message, url });
    } catch {
      /* user cancelled */
    }
  };

  return (
    <div className="rounded-2xl border border-green-200 bg-green-50 p-5 md:p-6">
      <h2 className="text-lg font-semibold text-gray-900">{t.doneTitle}</h2>
      <p className="mt-1 text-sm text-gray-600">{t.shareIntro}</p>

      {url && (
        <>
          <div className="mt-4 rounded-xl border border-green-200 bg-white px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{t.yourLink}</p>
            <input
              readOnly
              value={url}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="mt-0.5 w-full bg-transparent font-mono text-[13px] text-gray-900 outline-none"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={copy} className="rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white hover:bg-gray-800">
              {copied ? t.copied : t.copyLink}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(message)}`}
              target="_blank"
              rel="noopener"
              className="rounded-xl bg-[#25D366] px-4 py-3 text-center text-sm font-semibold text-white hover:brightness-95"
            >
              {t.shareWhatsApp}
            </a>
            {canNativeShare && (
              <button onClick={nativeShare} className="col-span-2 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-800 hover:bg-gray-50">
                {t.shareMore}
              </button>
            )}
          </div>
          <p className="mt-2 text-xs text-gray-500">{t.shareInstagramHint}</p>
        </>
      )}

      <a href={loginUrl} className="mt-5 inline-block w-full rounded-xl bg-brand-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700">
        {t.doneButton}
      </a>
      <p className="mt-2 text-xs text-gray-500">{t.doneNote}</p>
    </div>
  );
}
