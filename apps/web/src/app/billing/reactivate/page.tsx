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
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1>Account Suspended</h1>
        <p>
          Your subscription has been cancelled or suspended. Reactivate your
          account to continue using Balkina AI.
        </p>

        {error && <p className="error-message">{error}</p>}

        <button
          className="btn btn-primary"
          onClick={handleReactivate}
          disabled={loading}
          style={{ marginTop: '1rem' }}
        >
          {loading ? 'Loading...' : 'Reactivate subscription'}
        </button>

        <div style={{ marginTop: '1rem' }}>
          <button className="btn btn-outline" onClick={handleSignOut}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
