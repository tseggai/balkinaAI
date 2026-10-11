'use client';

import { useState } from 'react';

const INPUT = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors';

interface Props {
  token: string;
  businessName: string;
  defaultOwnerName: string;
  defaultEmail: string;
}

export function ClaimForm({ token, businessName, defaultOwnerName, defaultEmail }: Props) {
  const [ownerName, setOwnerName] = useState(defaultOwnerName === businessName ? '' : defaultOwnerName);
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState<{ login_url: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      const res = await fetch('/api/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, owner_name: ownerName, email, password }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? 'Something went wrong'); setBusy(false); return; }
      setDone({ login_url: json.login_url });
    } catch {
      setError('Network error. Please try again.');
    }
    setBusy(false);
  };

  if (done) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
        <h2 className="text-lg font-semibold text-gray-900">You're in 🎉</h2>
        <p className="mt-2 text-sm text-gray-600">
          {businessName} is now live on Balkina. Log in with the email and password you just chose to review your services, set your hours and copy your booking link.
        </p>
        <a href={done.login_url} className="mt-5 inline-block w-full rounded-xl bg-brand-600 px-5 py-3 text-center text-sm font-semibold text-white hover:bg-brand-700">
          Go to your dashboard
        </a>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-gray-900">Claim this page</h2>
      <p className="mt-1 text-sm text-gray-500">Takes a minute. No card required.</p>

      <label className="mt-5 block text-xs font-medium text-gray-600">
        Your name
        <input required value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Ana Petrović" className={`mt-1 ${INPUT}`} />
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-600">
        Email (this becomes your login)
        <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@business.com" className={`mt-1 ${INPUT}`} />
      </label>
      <label className="mt-3 block text-xs font-medium text-gray-600">
        Choose a password
        <input required type="password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={`mt-1 ${INPUT}`} />
      </label>

      {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}

      <button type="submit" disabled={busy} className="mt-5 w-full rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
        {busy ? 'Claiming…' : businessName.length > 28 ? 'Claim this page' : `Claim ${businessName}`}
      </button>
      <p className="mt-3 text-center text-[11px] text-gray-400">
        By claiming you agree to our <a href="/terms" className="underline">Terms</a> and <a href="/privacy" className="underline">Privacy Policy</a>.
      </p>
    </form>
  );
}
