'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

export default function ReactivatePage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleReactivate() {
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: 'starter' }),
      });

      const result = await res.json();

      if (!res.ok || !result.data?.url) {
        setError(result.error?.message ?? 'Failed to start checkout');
        setLoading(false);
        return;
      }

      window.location.href = result.data.url;
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(false);
    }
  }

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = '/auth/login';
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
          <svg className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Account Suspended</h1>
        <p className="mt-2 text-sm text-gray-500">
          Your subscription has been cancelled or suspended. Reactivate your
          account to continue using Balkina AI.
        </p>

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <button onClick={handleReactivate} disabled={loading}
          className="mt-6 w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {loading ? 'Loading...' : 'Reactivate subscription'}
        </button>

        <button onClick={handleSignOut}
          className="mt-3 w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50">
          Sign out
        </button>
      </div>
    </div>
  );
}
