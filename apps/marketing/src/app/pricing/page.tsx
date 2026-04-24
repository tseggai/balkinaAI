import type { Metadata } from 'next';
import { createClient } from '@supabase/supabase-js';

export const metadata: Metadata = {
  title: 'Pricing — Balkina AI',
  description: 'Simple, transparent pricing for every business size. Start free with a 14-day trial.',
};

export const revalidate = 300;

interface Plan {
  name: string;
  price_monthly: number;
  max_staff: number;
  max_locations: number;
  features: Record<string, boolean> | null;
}

const PLAN_DETAILS: Record<string, { desc: string; features: string[]; limits: string[]; popular?: boolean }> = {
  Starter: {
    desc: 'Perfect for solo professionals — barbers, therapists, consultants.',
    features: [
      'AI booking chatbot',
      'Email notifications',
      'Appointment management',
      'Customer CRM',
      'Basic analytics',
      'Review collection',
    ],
    limits: [
      'No SMS notifications',
      'No deposit payments',
      'No coupons',
    ],
  },
  Pro: {
    desc: 'For growing teams that need the full toolkit.',
    popular: true,
    features: [
      'Everything in Starter, plus:',
      'SMS notifications',
      'Deposit & online payments',
      'Coupons & promotions',
      'Service extras & packages',
      'Staff scheduling & buffers',
      'Smart rebooking reminders',
      'Priority support',
    ],
    limits: [],
  },
  Enterprise: {
    desc: 'For multi-location businesses at scale.',
    features: [
      'Everything in Pro, plus:',
      'Custom branding',
      'API access',
      'Advanced analytics & forecasting',
      'Dedicated account manager',
      'Custom integrations',
      'SLA guarantee',
    ],
    limits: [],
  },
};

const FAQ = [
  { q: 'Is there a free trial?', a: 'Yes! Every plan comes with a 14-day free trial. No credit card required to start.' },
  { q: 'Can I change plans later?', a: 'Absolutely. Upgrade or downgrade at any time from your dashboard. Changes take effect on your next billing cycle.' },
  { q: 'How does the AI chatbot work?', a: 'Customers open the Balkina app and describe what they need in plain language. The AI searches for matching businesses, shows real-time availability, and books the appointment — all in a single conversation.' },
  { q: 'Do my customers need to download an app?', a: 'Yes, the customer experience is through the Balkina mobile app (iOS and Android). This gives them the best experience with push notifications, Apple Pay, and smart reminders.' },
  { q: 'How do payments work?', a: 'We use Stripe Connect. When a customer pays a deposit, the money goes directly to your Stripe account minus a small platform commission. You\'ll need to complete Stripe\'s verification process.' },
  { q: 'What if I have more than 10 staff?', a: 'The Enterprise plan supports unlimited staff and locations. Contact us if you need a custom arrangement.' },
];

async function getPlans(): Promise<Plan[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key);
  const { data } = await supabase
    .from('subscription_plans')
    .select('name, price_monthly, max_staff, max_locations, features')
    .order('price_monthly');
  return (data ?? []) as Plan[];
}

export default async function PricingPage() {
  const plans = await getPlans();

  const displayPlans = plans.map((plan) => {
    const details = PLAN_DETAILS[plan.name] ?? { desc: '', features: [], limits: [] };
    const staffLabel = plan.max_staff >= 50 ? 'Unlimited staff' : `Up to ${plan.max_staff} staff member${plan.max_staff > 1 ? 's' : ''}`;
    const locLabel = plan.max_locations >= 10 ? 'Unlimited locations' : `${plan.max_locations} location${plan.max_locations > 1 ? 's' : ''}`;
    return {
      name: plan.name,
      price: Math.floor(plan.price_monthly) === plan.price_monthly
        ? String(Math.floor(plan.price_monthly))
        : plan.price_monthly.toFixed(2),
      desc: details.desc,
      popular: details.popular ?? false,
      features: [staffLabel, locLabel, ...details.features],
      limits: details.limits,
    };
  });

  return (
    <>
      {/* Header */}
      <section className="bg-gradient-to-b from-brand-50/60 to-white pb-4 pt-20 md:pt-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl">Pricing</h1>
          <p className="mt-4 text-lg text-gray-500">Start free. Scale as you grow. Cancel anytime.</p>
        </div>
      </section>

      {/* Plans */}
      <section className="pb-24 pt-16">
        <div className="mx-auto max-w-7xl px-6">
          <div className="grid gap-8 md:grid-cols-3">
            {displayPlans.map((plan, i) => (
              <div key={i} className={`relative flex flex-col rounded-2xl border p-8 ${plan.popular ? 'border-brand-600 bg-white shadow-xl shadow-brand-100/50' : 'border-gray-200 bg-white'}`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white">Most Popular</div>
                )}
                <h2 className="text-xl font-bold text-gray-900">{plan.name}</h2>
                <p className="mt-2 text-sm text-gray-500">{plan.desc}</p>
                <div className="mt-6">
                  <span className="text-5xl font-extrabold text-gray-900">&euro;{plan.price}</span>
                  <span className="text-base text-gray-500">/month</span>
                </div>
                <a href="/join" className={`mt-8 block rounded-full py-3.5 text-center text-sm font-semibold transition-colors ${plan.popular ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
                  Join the Beta
                </a>

                <div className="mt-8 flex-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Includes</p>
                  <ul className="mt-4 space-y-3">
                    {plan.features.map((f, fi) => (
                      <li key={fi} className="flex items-start gap-2.5 text-sm text-gray-600">
                        <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                        {f}
                      </li>
                    ))}
                  </ul>
                  {plan.limits.length > 0 && (
                    <>
                      <p className="mt-6 text-xs font-semibold uppercase tracking-wider text-gray-400">Not included</p>
                      <ul className="mt-4 space-y-3">
                        {plan.limits.map((l, li) => (
                          <li key={li} className="flex items-start gap-2.5 text-sm text-gray-400">
                            <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                            {l}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-gray-100 bg-gray-50 py-24">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="text-center text-3xl font-bold tracking-tight text-gray-900">Frequently asked questions</h2>
          <dl className="mt-12 space-y-8">
            {FAQ.map((item, i) => (
              <div key={i}>
                <dt className="text-base font-semibold text-gray-900">{item.q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-gray-500">{item.a}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-brand-600 py-16">
        <div className="mx-auto max-w-2xl px-6 text-center">
          <h2 className="text-2xl font-bold text-white md:text-3xl">Start your 14-day free trial today</h2>
          <p className="mt-3 text-base text-brand-100">No credit card required. Set up in minutes.</p>
          <a href="/join" className="mt-8 inline-block rounded-full bg-white px-8 py-3.5 text-base font-semibold text-brand-600 shadow-lg hover:bg-gray-50 transition-colors">
            Get Started Free
          </a>
        </div>
      </section>
    </>
  );
}
