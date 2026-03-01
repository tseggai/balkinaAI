'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();
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

      // Redirect to Stripe Checkout
      window.location.href = result.data.url;
    } catch {
      setError('An error occurred. Please try again.');
      setLoading(null);
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb' }}>
      <div style={{ textAlign: 'center', padding: '3rem 1rem 1rem' }}>
        <h1 style={{ fontSize: '2rem', fontWeight: 800 }}>Choose your plan</h1>
        <p style={{ color: '#6b7280', marginTop: '0.5rem' }}>
          Start growing your business with AI-powered booking.
        </p>
      </div>

      {error && (
        <p className="error-message" style={{ textAlign: 'center' }}>
          {error}
        </p>
      )}

      <div className="plans-container">
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className={`plan-card${plan.popular ? ' popular' : ''}`}
          >
            {plan.popular && <div className="plan-badge">Most Popular</div>}
            <h3>{plan.name}</h3>
            <div className="plan-price">
              ${plan.price}
              <span>/mo</span>
            </div>
            <ul className="plan-features">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
            <button
              className="btn btn-primary"
              onClick={() => handleSelectPlan(plan.key)}
              disabled={loading !== null}
            >
              {loading === plan.key ? 'Redirecting...' : `Get ${plan.name}`}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
