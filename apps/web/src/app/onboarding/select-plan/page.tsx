'use client';

import { useEffect, useState } from 'react';

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  max_staff: number;
  max_locations: number;
}

// Per-plan copy, mirrored from the marketing pricing page (balkina.ai/pricing)
// so onboarding and the landing page tell the same story. The plan set itself
// (names, prices, Stripe wiring) is admin-managed in subscription_plans.
const PLAN_DETAILS: Record<string, { desc: string; popular?: boolean; features: string[] }> = {
  Solo: {
    desc: 'For individuals getting started',
    features: ['AI chatbot', 'Staff app', 'Smart reminders', 'SMS notifications', 'Reviews & ratings', 'Basic analytics'],
  },
  'Solo Pro': {
    desc: 'For serious solo professionals',
    features: ['Everything in Solo', 'Unlimited bookings', 'Full service management', 'Service add-ons', 'Coupons'],
  },
  Team: {
    desc: 'For small teams',
    popular: true,
    features: ['Everything in Solo Pro', 'Service packages', 'Staff management', 'Advanced analytics'],
  },
  Scale: {
    desc: 'For growing businesses',
    features: ['Everything in Team', 'Role management', 'Loyalty programs', 'Inventory management', 'Dedicated support'],
  },
};

export default function SelectPlanPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/plans');
        const json = await res.json();
        if (json.data) setPlans(json.data as Plan[]);
      } catch {
        setError('Could not load plans. Please refresh.');
      } finally {
        setPlansLoading(false);
      }
    })();
  }, []);

  async function handleSelectPlan(planId: string) {
    setError('');
    setLoading(planId);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });

      const result = await res.json();

      if (!res.ok || !result.data?.url) {
        setError(result.error?.message ?? 'Failed to start checkout');
        setLoading(null);
        return;
      }

      window.location.href = result.data.url;
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(null);
    }
  }

  const displayPlans = plans.map((plan) => {
    const details = PLAN_DETAILS[plan.name] ?? { desc: '', features: [] };
    const staffLabel = plan.max_staff >= 50 ? 'Unlimited staff' : `${plan.max_staff > 1 ? `Up to ${plan.max_staff}` : plan.max_staff} staff`;
    const locLabel = `${plan.max_locations} location${plan.max_locations > 1 ? 's' : ''}`;
    const bookingsLabel = plan.name === 'Solo' ? '20/month bookings' : 'Unlimited bookings';
    const extraStaff = plan.name === 'Team' || plan.name === 'Scale' ? '+€6/additional staff' : undefined;
    return {
      id: plan.id,
      name: plan.name,
      price: Math.floor(plan.price_monthly),
      desc: details.desc,
      popular: details.popular ?? false,
      features: details.features,
      staffLabel,
      locLabel,
      bookingsLabel,
      extraStaff,
    };
  });

  const gridCols = displayPlans.length >= 4 ? 'lg:grid-cols-4' : 'lg:grid-cols-3';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-12 pb-4 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">Choose your plan</h1>
        <p className="mt-2 text-gray-500">Start growing your business with AI-powered booking.</p>
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      {plansLoading ? (
        <p className="py-16 text-center text-sm text-gray-400">Loading plans…</p>
      ) : displayPlans.length === 0 ? (
        <p className="py-16 text-center text-sm text-gray-500">No plans are available yet. Please check back shortly.</p>
      ) : (
        <div className={`mx-auto grid max-w-7xl grid-cols-1 gap-8 px-6 py-8 md:grid-cols-2 ${gridCols}`}>
          {displayPlans.map((plan) => (
            <div key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-white p-8 ${
                plan.popular ? 'border-brand-600 shadow-xl shadow-brand-100/50' : 'border-gray-200'
              }`}>
              {plan.popular && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white">
                  Most Popular
                </div>
              )}
              <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
              {plan.desc && <p className="mt-1 text-sm text-gray-500">{plan.desc}</p>}
              <div className="mt-5">
                <span className="text-4xl font-extrabold text-gray-900">&euro;{plan.price}</span>
                <span className="text-base text-gray-500">/mo</span>
              </div>
              {plan.price > 0 && <p className="mt-1 text-xs font-medium text-brand-600">7-day free trial</p>}

              <div className="mt-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
                <p>{plan.staffLabel} &middot; {plan.locLabel}</p>
                <p>{plan.bookingsLabel}</p>
                {plan.extraStaff && <p className="text-brand-600">{plan.extraStaff}</p>}
              </div>

              <ul className="mt-6 flex-1 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm text-gray-600">
                    <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                    {feature}
                  </li>
                ))}
              </ul>

              <button
                onClick={() => handleSelectPlan(plan.id)}
                disabled={loading !== null}
                className={`mt-8 w-full rounded-full py-3.5 text-center text-sm font-semibold transition-colors disabled:opacity-50 ${
                  plan.popular
                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                    : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                }`}>
                {loading === plan.id ? 'Redirecting…' : `Get ${plan.name}`}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
