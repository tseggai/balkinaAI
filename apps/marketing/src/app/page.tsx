import Link from 'next/link';

const FEATURES = [
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" />
      </svg>
    ),
    title: 'AI-Powered Booking',
    desc: 'Customers chat naturally. The AI finds matching businesses, checks real-time availability, and books appointments — all in one conversation.',
  },
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
      </svg>
    ),
    title: 'Full Business Dashboard',
    desc: 'Services, staff schedules, multiple locations, deposits, extras, coupons, CRM, reviews — everything a booking business needs.',
  },
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    title: 'Mobile-First Experience',
    desc: 'A native mobile app for customers with push notifications, Apple Pay, Google Pay, and smart rebooking reminders.',
  },
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
    title: 'Integrated Payments',
    desc: 'Stripe-powered deposits, Apple Pay, Google Pay. Customers pay when they book, you get paid securely via Stripe Connect.',
  },
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
      </svg>
    ),
    title: 'Multi-Location Support',
    desc: 'Manage multiple locations with separate staff, schedules, and services. Customers discover nearby businesses via AI-powered geo-search.',
  },
  {
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
      </svg>
    ),
    title: 'Smart Notifications',
    desc: 'Email confirmations, push reminders, and AI-driven rebooking nudges that bring customers back at the right time.',
  },
];

const STEPS = [
  { num: '1', title: 'Customer Opens Chat', desc: '"I need a haircut near downtown" — that\'s all it takes.' },
  { num: '2', title: 'AI Finds & Presents Options', desc: 'Matching businesses with ratings, distance, services, and real-time availability.' },
  { num: '3', title: 'Book in Seconds', desc: 'Pick a service, choose a time, confirm. Deposit is taken instantly if required.' },
  { num: '4', title: 'Business Gets Notified', desc: 'The appointment appears in the dashboard. Automated confirmations go out via email and push.' },
];

export default function HomePage() {
  return (
    <>
      {/* ─── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50/60 to-white">
        <div className="mx-auto max-w-7xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600" />
              </span>
              Now in beta
            </div>
            <h1 className="text-5xl font-extrabold tracking-tight text-gray-900 md:text-6xl lg:text-7xl">
              Book appointments<br />
              <span className="bg-gradient-to-r from-brand-600 to-indigo-500 bg-clip-text text-transparent">with AI</span>
            </h1>
            <p className="mt-6 text-lg leading-relaxed text-gray-600 md:text-xl">
              One chat, every booking. Customers describe what they need, and our AI finds the best businesses, checks live availability, and books — in seconds.
            </p>
            <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
              <a href="https://app.balkina.ai/register" className="rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 transition-all hover:shadow-xl hover:shadow-brand-600/30">
                Start Free Trial
              </a>
              <Link href="#how-it-works" className="rounded-full border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors">
                See How It Works
              </Link>
            </div>
            <p className="mt-4 text-sm text-gray-400">No credit card required. Free 14-day trial.</p>
          </div>

          {/* Hero visual — chat mockup */}
          <div className="mx-auto mt-16 max-w-md">
            <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-2xl shadow-gray-200/60">
              <div className="mb-4 flex items-center gap-3">
                <div className="h-3 w-3 rounded-full bg-gray-200" />
                <div className="h-3 w-3 rounded-full bg-gray-200" />
                <div className="h-3 w-3 rounded-full bg-gray-200" />
                <span className="ml-auto text-xs font-medium tracking-wide text-gray-400">BALKINA</span>
              </div>
              <div className="space-y-3">
                <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-md bg-brand-600 px-4 py-2.5 text-sm text-white">
                  I need a haircut near me
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-4 py-2.5 text-sm text-gray-700">
                  I found 3 barbershops near you! Here are the closest ones with available slots today...
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 rounded-xl border border-gray-200 bg-white p-3">
                    <div className="h-16 rounded-lg bg-gradient-to-br from-brand-100 to-brand-50" />
                    <p className="mt-2 text-xs font-semibold text-gray-800">Crown Barbershop</p>
                    <p className="text-xs text-gray-400">0.3 mi &middot; 4.8 stars</p>
                  </div>
                  <div className="flex-1 rounded-xl border border-gray-200 bg-white p-3">
                    <div className="h-16 rounded-lg bg-gradient-to-br from-indigo-100 to-indigo-50" />
                    <p className="mt-2 text-xs font-semibold text-gray-800">Elite Cuts</p>
                    <p className="text-xs text-gray-400">0.5 mi &middot; 4.9 stars</p>
                  </div>
                </div>
                <div className="ml-auto max-w-[75%] rounded-2xl rounded-tr-md bg-brand-600 px-4 py-2.5 text-sm text-white">
                  Book a haircut at Crown for 2pm
                </div>
                <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-4 py-2.5 text-sm text-gray-700">
                  Done! Your haircut at Crown Barbershop is confirmed for today at 2:00 PM with Marcus.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Everything you need to run a booking business</h2>
            <p className="mt-4 text-lg text-gray-500">From AI-powered customer discovery to full business management.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <div key={i} className="group rounded-2xl border border-gray-100 bg-white p-8 transition-all hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/40">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-50 text-brand-600 transition-colors group-hover:bg-brand-600 group-hover:text-white">
                  {f.icon}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-gray-50 py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">How it works</h2>
            <p className="mt-4 text-lg text-gray-500">From search to booked in under a minute.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s, i) => (
              <div key={i} className="relative rounded-2xl bg-white p-8 shadow-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{s.num}</div>
                <h3 className="mt-5 text-base font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.desc}</p>
                {i < STEPS.length - 1 && (
                  <div className="absolute right-0 top-12 hidden translate-x-1/2 text-gray-300 lg:block">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing Preview ──────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Simple, transparent pricing</h2>
            <p className="mt-4 text-lg text-gray-500">Start free, upgrade as you grow. No hidden fees.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {[
              { name: 'Starter', price: '49', desc: 'For solo professionals', features: ['1 staff member', '1 location', 'AI booking chatbot', 'Email notifications', 'Basic analytics'] },
              { name: 'Pro', price: '99', desc: 'For growing teams', popular: true, features: ['Up to 10 staff', '3 locations', 'Everything in Starter', 'SMS notifications', 'Deposit payments', 'Coupons & promotions', 'Priority support'] },
              { name: 'Enterprise', price: '199', desc: 'For multi-location businesses', features: ['Unlimited staff', 'Unlimited locations', 'Everything in Pro', 'Custom branding', 'API access', 'Dedicated account manager'] },
            ].map((plan, i) => (
              <div key={i} className={`relative rounded-2xl border p-8 ${plan.popular ? 'border-brand-600 bg-white shadow-xl shadow-brand-100/50' : 'border-gray-200 bg-white'}`}>
                {plan.popular && (
                  <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-xs font-semibold text-white">Most Popular</div>
                )}
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-1 text-sm text-gray-500">{plan.desc}</p>
                <div className="mt-6">
                  <span className="text-4xl font-extrabold text-gray-900">&euro;{plan.price}</span>
                  <span className="text-sm text-gray-500">/month</span>
                </div>
                <ul className="mt-8 space-y-3">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2.5 text-sm text-gray-600">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="https://app.balkina.ai/register" className={`mt-8 block rounded-full py-3 text-center text-sm font-semibold transition-colors ${plan.popular ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
                  Get Started
                </a>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <Link href="/pricing" className="text-sm font-medium text-brand-600 hover:text-brand-700">View full pricing details &rarr;</Link>
          </div>
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────────── */}
      <section className="bg-brand-600 py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Ready to transform your booking experience?</h2>
          <p className="mt-4 text-lg text-brand-100">Join businesses already using Balkina AI to fill their calendars with zero effort.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="https://app.balkina.ai/register" className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-brand-600 shadow-lg hover:bg-gray-50 transition-colors">
              Start Free Trial
            </a>
            <Link href="/pricing" className="rounded-full border border-white/30 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
              View Pricing
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
