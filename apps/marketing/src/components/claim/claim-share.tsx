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
 * View (their live page) and Share (copy / WhatsApp / native share), then
 * the dashboard.
 */
export function ClaimShare({ token, businessName, bookingUrl, loginUrl, t }: Props) {
  const [copied, setCopied] = useState(false);
  const [opening, setOpening] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
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
  const share = () => {
    // On phones the OS share sheet already offers copy + WhatsApp + everything.
    if (canNativeShare) {
      void nativeShare();
      return;
    }
    setShareOpen((v) => !v);
  };

  return (
    <div className="pt-1">
      <div className="flex items-center gap-2.5">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-sm text-white">✓</span>
        <h2 className="text-xl font-semibold text-gray-900">{t.doneTitle}</h2>
      </div>
      <p className="mt-2 text-base text-gray-600">{t.shareIntro}</p>

      {url && (
        <>
          <div className="mt-5 rounded-2xl bg-gray-50 px-4 py-3.5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{t.yourLink}</p>
            <input
              readOnly
              value={url}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="mt-1 w-full min-w-0 bg-transparent text-base text-gray-900 outline-none"
            />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2.5">
            <a
              href={url}
              target="_blank"
              rel="noopener"
              onClick={() => trackClaim(token, 'claim_share_view')}
              className="rounded-2xl border border-gray-200/80 bg-white px-4 py-3.5 text-center text-base font-semibold text-gray-900 hover:bg-gray-50"
            >
              {t.viewPage}
            </a>
            <button onClick={share} className="rounded-2xl bg-gray-900 px-4 py-3.5 text-base font-semibold text-white hover:bg-gray-800">
              {t.share}
            </button>
          </div>
          {shareOpen && (
            <div className="mt-2.5 overflow-hidden rounded-2xl border border-gray-200/80 bg-white">
              <button onClick={copy} className="flex w-full items-center gap-3 px-4 py-3.5 text-left text-base text-gray-800 hover:bg-gray-50">
                <span className="text-gray-400">⎘</span> {copied ? t.copied : t.copyLink}
              </button>
              <a
                href={`https://wa.me/?text=${encodeURIComponent(message)}`}
                target="_blank"
                rel="noopener"
                onClick={() => trackClaim(token, 'claim_share_whatsapp')}
                className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-3.5 text-left text-base text-gray-800 hover:bg-gray-50"
              >
                <span className="text-[#25D366]">●</span> {t.shareWhatsApp}
              </a>
            </div>
          )}
          <p className="mt-3 text-sm text-gray-500">{t.shareInstagramHint}</p>
        </>
      )}

      <button onClick={openDashboard} disabled={opening} className="mt-6 w-full rounded-2xl bg-brand-600 px-5 py-4 text-center text-base font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
        {opening ? t.opening : t.doneButton}
      </button>
      <p className="mt-2.5 text-sm text-gray-500">{t.doneNote}</p>
    </div>
  );
}
