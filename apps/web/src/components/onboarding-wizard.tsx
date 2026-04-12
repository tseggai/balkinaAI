'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';

type WizardStep = 'welcome' | 'add-service' | 'add-staff' | 'done' | null;

const STORAGE_KEY = 'balkina_onboarding_dismissed';

/**
 * Full-screen onboarding wizard shown to new tenants who have no services
 * and/or no staff yet. Guides them through creating their first service and
 * their first staff member, then auto-dismisses.
 */
export function OnboardingWizard({ tenantName }: { tenantName: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [step, setStep] = useState<WizardStep>(null);
  const [loading, setLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Only run on the main dashboard page
    if (pathname !== '/dashboard') {
      setStep(null);
      setLoading(false);
      return;
    }

    // Already dismissed permanently
    if (typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY)) {
      setStep(null);
      setLoading(false);
      return;
    }

    // Fetch service + staff counts to determine which step to show
    let cancelled = false;
    (async () => {
      try {
        const [svcRes, staffRes] = await Promise.all([
          fetch('/api/services'),
          fetch('/api/staff'),
        ]);
        if (cancelled) return;
        const svcJson = await svcRes.json();
        const staffJson = await staffRes.json();
        const hasServices = (svcJson.data ?? []).length > 0;
        const hasStaff = (staffJson.data ?? []).length > 0;

        if (!hasServices) {
          setStep('welcome');
        } else if (!hasStaff) {
          setStep('add-staff');
        } else {
          // Both exist — show celebration once, then dismiss permanently
          const celebrated = localStorage.getItem(STORAGE_KEY + '_celebrated');
          if (!celebrated) {
            setStep('done');
            localStorage.setItem(STORAGE_KEY + '_celebrated', '1');
          } else {
            dismiss();
          }
        }
      } catch {
        // API error — don't block the dashboard
        setStep(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setFadeOut(true);
    setTimeout(() => setStep(null), 300);
  }

  function goToServices() {
    router.push('/dashboard/services');
    // Don't dismiss — when they come back without staff, show step 2
  }

  function goToStaff() {
    router.push('/dashboard/staff');
  }

  if (loading || !step) return null;

  return (
    <div
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
        fadeOut ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="relative mx-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
        {/* Skip / dismiss button */}
        <button
          onClick={dismiss}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600"
          aria-label="Skip setup"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
          </svg>
        </button>

        {step === 'welcome' && (
          <WelcomeStep
            tenantName={tenantName}
            onNext={() => setStep('add-service')}
          />
        )}

        {step === 'add-service' && (
          <AddServiceStep onGo={goToServices} onSkip={() => setStep('add-staff')} />
        )}

        {step === 'add-staff' && (
          <AddStaffStep onGo={goToStaff} onSkip={dismiss} />
        )}

        {step === 'done' && (
          <DoneStep onClose={dismiss} />
        )}
      </div>
    </div>
  );
}

/* ─── Step components ──────────────────────────────────────────────────────── */

function WelcomeStep({ tenantName, onNext }: { tenantName: string; onNext: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100">
        <svg className="h-8 w-8 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21v-8.25M15.75 21v-8.25M8.25 21v-8.25M3 9l9-6 9 6m-1.5 12V10.332A48.36 48.36 0 0 0 12 9.75c-2.551 0-5.056.2-7.5.582V21M3 21h18M12 6.75h.008v.008H12V6.75Z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">
        Welcome to Balkina AI!
      </h2>
      <p className="mt-2 text-gray-600">
        <strong>{tenantName}</strong> is all set up. Let&apos;s get you ready to accept bookings in just 2 quick steps.
      </p>

      {/* Progress indicator */}
      <div className="mx-auto mt-6 flex max-w-[200px] items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-brand-600" />
        <div className="h-2 flex-1 rounded-full bg-gray-200" />
      </div>
      <p className="mt-2 text-xs text-gray-400">Step 1 of 2</p>

      <button
        onClick={onNext}
        className="mt-6 w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
      >
        Let&apos;s get started
      </button>
    </div>
  );
}

function AddServiceStep({ onGo, onSkip }: { onGo: () => void; onSkip: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
        <svg className="h-8 w-8 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900">Add your first service</h2>
      <p className="mt-2 text-gray-600">
        What do you offer? Haircuts, consultations, training sessions — add a service so customers know what they can book.
      </p>

      <div className="mx-auto mt-6 flex max-w-[200px] items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-brand-600" />
        <div className="h-2 flex-1 rounded-full bg-gray-200" />
      </div>
      <p className="mt-2 text-xs text-gray-400">Step 1 of 2</p>

      <button
        onClick={onGo}
        className="mt-6 w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
      >
        Add a service
      </button>
      <button
        onClick={onSkip}
        className="mt-2 w-full rounded-lg px-6 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        I&apos;ll do this later
      </button>
    </div>
  );
}

function AddStaffStep({ onGo, onSkip }: { onGo: () => void; onSkip: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
        <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900">Add your first staff member</h2>
      <p className="mt-2 text-gray-600">
        Who provides the services? Add yourself or a team member so customers can see who they&apos;re booking with.
      </p>

      <div className="mx-auto mt-6 flex max-w-[200px] items-center gap-2">
        <div className="h-2 flex-1 rounded-full bg-brand-600" />
        <div className="h-2 flex-1 rounded-full bg-brand-600" />
      </div>
      <p className="mt-2 text-xs text-gray-400">Step 2 of 2</p>

      <button
        onClick={onGo}
        className="mt-6 w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
      >
        Add a staff member
      </button>
      <button
        onClick={onSkip}
        className="mt-2 w-full rounded-lg px-6 py-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition-colors"
      >
        I&apos;ll do this later
      </button>
    </div>
  );
}

function DoneStep({ onClose }: { onClose: () => void }) {
  return (
    <div className="text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
        <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
        </svg>
      </div>
      <h2 className="text-xl font-bold text-gray-900">You&apos;re all set!</h2>
      <p className="mt-2 text-gray-600">
        Your business is ready to accept bookings. Customers can now discover you through the Balkina AI chatbot.
      </p>
      <p className="mt-4 text-sm text-gray-500">
        You can add more services, staff, and locations anytime from the sidebar.
      </p>

      <button
        onClick={onClose}
        className="mt-6 w-full rounded-lg bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors"
      >
        Go to dashboard
      </button>
    </div>
  );
}
