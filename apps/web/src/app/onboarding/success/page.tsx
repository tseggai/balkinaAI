'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OnboardingSuccessPage() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/dashboard');
      router.refresh();
    }, 3000);

    return () => clearTimeout(timer);
  }, [router]);

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
          Your subscription is active. Redirecting you to your dashboard...
        </p>
        <p className="mt-4 text-sm text-gray-400">
          If you are not redirected,{' '}
          <a href="/dashboard" className="text-brand-600 hover:text-brand-700">click here</a>.
        </p>
      </div>
    </div>
  );
}
