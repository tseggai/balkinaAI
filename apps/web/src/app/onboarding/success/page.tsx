'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    // Give the webhook a moment to process, then redirect to dashboard
    const timer = setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

  return (
    <div className="auth-container">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <h1>Welcome to Balkina AI!</h1>
        <p>
          Your subscription is active. Redirecting you to your dashboard...
        </p>
        <div style={{ marginTop: '1rem', color: '#6b7280' }}>
          If you are not redirected,{' '}
          <a href="/dashboard" style={{ color: '#6366f1' }}>
            click here
          </a>
          .
        </div>
      </div>
    </div>
  );
}
