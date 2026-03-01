'use client';

import { useState } from 'react';

const PLANS = [
  {
    key: 'starter',
    name: 'Starter',
    price: 49,
    features: [
      'AI chatbot booking',
      'Up to 3 staff members',
      '1 location',
      'Basic appointment management',
      'Email notifications',
    ],
  },
  {
    key: 'pro',
    name: 'Pro',
    price: 99,
    popular: true,
    features: [
      'Everything in Starter',
      'Up to 10 staff members',
      '3 locations',
      'SMS notifications',
      'Analytics dashboard',
      'Customer behavior insights',
      'Coupon & discount management',
    ],
  },
  {
    key: 'enterprise',
    name: 'Enterprise',
    price: 199,
    features: [
      'Everything in Pro',
      'Up to 50 staff members',
      '10 locations',
      'White-label experience',
      'AI rebooking nudges',
      'Priority support',
      'Custom integrations',
    ],
  },
];

export default function SelectPlanPage() {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleSelectPlan(planKey: string) {
    setError('');
    setLoading(planKey);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="px-4 pt-12 pb-4 text-center">
        <h1 className="text-3xl font-extrabold text-gray-900">Choose your plan</h1>
        <p className="mt-2 text-gray-500">Start growing your business with AI-powered booking.</p>
      </div>

      {error && <p className="text-center text-sm text-red-600">{error}</p>}

      <div className="mx-auto grid max-w-5xl grid-cols-1 gap-6 px-4 py-8 md:grid-cols-3">
        {PLANS.map((plan) => (
          <div key={plan.key}
            className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-sm ${
              plan.popular ? 'border-brand-600 ring-2 ring-brand-600' : 'border-gray-200'
            }`}>
            {plan.popular && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">
                Most Popular
              </span>
            )}
            <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
            <div className="mt-4">
              <span className="text-4xl font-bold text-gray-900">${plan.price}</span>
              <span className="text-sm text-gray-500">/mo</span>
            </div>
            <ul className="mt-6 flex-1 space-y-3">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-600">
                  <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
            <button
              onClick={() => handleSelectPlan(plan.key)}
              disabled={loading !== null}
              className={`mt-6 w-full rounded-lg px-4 py-2.5 text-sm font-medium disabled:opacity-50 ${
                plan.popular
                  ? 'bg-brand-600 text-white hover:bg-brand-700'
                  : 'border border-brand-600 text-brand-600 hover:bg-brand-50'
              }`}>
              {loading === plan.key ? 'Redirecting...' : `Get ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
