'use client';

import { useState } from 'react';
import type { ClaimCopy } from '@/lib/claim/i18n';
import { ClaimShare } from './claim-share';
import { trackClaim } from '@/lib/claim/track';

const INPUT = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors';

interface Props {
  token: string;
  businessName: string;
  defaultOwnerName: string;
  defaultEmail: string;
  t: ClaimCopy;
}

/**
 * One-tap claim: the only required input is an email (pre-filled when we have
 * one). The API creates the login without a password and returns a single-use
 * sign-in URL, so the owner lands in their dashboard immediately. Name and
 * password are optional extras behind a disclosure.
 */
export function ClaimForm({ token, businessName, defaultOwnerName, defaultEmail, t }: Props) {
  const [email, setEmail] = useState(defaultEmail);
  const [editingEmail, setEditingEmail] = useState(!defaultEmail);
  const [more, setMore] = useState(false);
  const [ownerName, setOwnerName] = useState(defaultOwnerName);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ login_url: string; booking_url: string | null } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    trackClaim(token, 'claim_clicked', { with_password: more && !!password });
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          email,
          owner_name: ownerName.trim() || undefined,
          password: more && password ? password : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? t.errorGeneric);
        setBusy(false);
        return;
      }
      setDone({ login_url: json.login_url, booking_url: json.booking_url ?? null });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setError(t.errorNetwork);
    }
    setBusy(false);
  };

  if (done) {
    return <div className="p-5 pt-3 md:p-6 md:pt-3"><ClaimShare token={token} businessName={businessName} bookingUrl={done.booking_url} loginUrl={done.login_url} t={t} /></div>;
  }

  return (
    <form onSubmit={submit} className="p-5 pt-3 md:p-6 md:pt-3">
      <h2 className="text-lg font-semibold text-gray-900">{t.claimTitle}</h2>
      <p className="mt-1 text-sm text-gray-500">{t.claimSubtitle}</p>

      {editingEmail ? (
        <label className="mt-5 block text-xs font-medium text-gray-600">
          {t.emailLabel}
          <input
            required
            type="email"
            autoComplete="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t.emailPlaceholder}
            className={`mt-1 ${INPUT}`}
          />
        </label>
      ) : (
        <p className="mt-5 text-sm text-gray-600">
          {t.emailLocked} <span className="font-medium text-gray-900">{email}</span>{' '}
          <button type="button" onClick={() => setEditingEmail(true)} className="text-brand-600 hover:underline">
            ({t.changeEmail})
          </button>
        </p>
      )}

      <button type="submit" disabled={busy} className="mt-4 w-full rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {busy ? t.claiming : t.claimButton}
      </button>

      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <button type="button" onClick={() => setMore(!more)} className="mt-4 text-xs text-gray-500 hover:text-gray-700">
        {more ? '−' : '+'} {t.morePrefs}
      </button>
      {more && (
        <div className="mt-2 space-y-3">
          <label className="block text-xs font-medium text-gray-600">
            {t.nameLabel}
            <input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} className={`mt-1 ${INPUT}`} />
          </label>
          <label className="block text-xs font-medium text-gray-600">
            {t.passwordLabel}
            <input type="password" minLength={8} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={`mt-1 ${INPUT}`} />
          </label>
        </div>
      )}

      <p className="mt-4 text-center text-[11px] text-gray-400" dangerouslySetInnerHTML={{ __html: t.terms('/terms', '/privacy') }} />
    </form>
  );
}
