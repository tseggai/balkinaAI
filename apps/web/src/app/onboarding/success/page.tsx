'use client';

import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

export default function OnboardingSuccessPage() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [status, setStatus] = useState<'verifying' | 'active' | 'error'>('verifying');

  const verifyCheckout = useCallback(async () => {
    if (!sessionId) {
      // No session ID — fall back to redirect after delay
      setStatus('active');
      return;
    }

    try {
      const res = await fetch('/api/checkout/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      const json = (await res.json()) as {
        data: { status: string } | null;
        error: { message: string } | null;
      };

      if (json.data?.status === 'active') {
        setStatus('active');
      }
      // If still pending, polling will retry
    } catch {
      // Network error — polling will retry
    }
  }, [sessionId]);

  // Poll verification endpoint until tenant is active
  useEffect(() => {
    if (status !== 'verifying') return;

    // Verify immediately
    verifyCheckout();

    // Then poll every 2 seconds
    const interval = setInterval(verifyCheckout, 2000);

    // Give up after 30 seconds and redirect anyway
    const timeout = setTimeout(() => {
      clearInterval(interval);
      setStatus('active');
    }, 30000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [status, verifyCheckout]);

  // Redirect to dashboard once active
  useEffect(() => {
    if (status !== 'active') return;

    const timer = setTimeout(() => {
      window.location.href = '/dashboard';
    }, 1500);

    return () => clearTimeout(timer);
  }, [status]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
          <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-900">Welcome to Balkina AI!</h1>
        <p className="mt-2 text-sm text-gray-500">
          {status === 'verifying'
            ? 'Activating your subscription...'
            : 'Your subscription is active. Redirecting you to your dashboard...'}
        </p>
        {status === 'verifying' && (
          <div className="mt-4 flex justify-center">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-300 border-t-brand-600" />
          </div>
        )}
        <p className="mt-4 text-sm text-gray-400">
          If you are not redirected,{' '}
          <a href="/dashboard" className="text-brand-600 hover:text-brand-700">click here</a>.
        </p>
      </div>
    </div>
  );
}
