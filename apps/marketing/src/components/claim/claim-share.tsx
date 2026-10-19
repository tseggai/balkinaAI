'use client';

import { useState } from 'react';
import type { ClaimCopy } from '@/lib/claim/i18n';
import { trackClaim } from '@/lib/claim/track';

interface Props {
  token: string;
  businessName: string;
  bookingUrl: string | null;
  loginUrl: string;
  t: ClaimCopy;
}

/**
 * Shown right after a successful claim, while the owner is still excited:
 * their link with one-tap copy / WhatsApp / native share, then the dashboard.
 */
export function ClaimShare({ token, businessName, bookingUrl, loginUrl, t }: Props) {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const url = bookingUrl ?? '';
  const message = t.shareMessage(businessName, url);
  const canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    trackClaim(token, 'claim_share_copy');
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable — the field below is selectable */
    }
  };
  // Each sign-in link is single-use, so mint a fresh one when the button is
  // pressed; fall back to the one issued at claim time if minting fails.
  const openDashboard = async () => {
    trackClaim(token, 'claim_dashboard_opened');
    setOpening(true);
    let target = loginUrl;
    try {
      const res = await fetch('/api/claim/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.login_url) target = json.login_url;
    } catch {
      /* use the original link */
    }
    window.location.href = target;
  };
  const nativeShare = async () => {
    trackClaim(token, 'claim_share_native');
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
              onClick={() => trackClaim(token, 'claim_share_whatsapp')}
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

      <button onClick={openDashboard} disabled={opening} className="mt-5 w-full rounded-xl bg-brand-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        {opening ? t.opening : t.doneButton}
      </button>
      <p className="mt-2 text-xs text-gray-500">{t.doneNote}</p>
    </div>
  );
}
