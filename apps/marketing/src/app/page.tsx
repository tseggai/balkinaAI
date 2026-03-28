'use client';

import { useState } from 'react';
import Link from 'next/link';

/* ─── Hero Tab Data ─────────────────────────────────────────────────────── */

const HERO_TABS = [
  {
    id: 'business',
    label: 'For Businesses',
    headline: 'Your booking engine,\npowered by AI',
    sub: 'A professional dashboard to manage services, staff, locations, payments, coupons, and analytics. Customers find you and book through AI — you focus on your craft.',
    cta: { label: 'Get Started Free', href: 'https://app.balkina.ai/register' },
    steps: [
      { num: '1', title: 'Sign Up & Set Up', desc: 'Create your account, add services, staff, and locations in minutes.' },
      { num: '2', title: 'Customers Discover You', desc: 'The AI chatbot surfaces your business to customers searching nearby.' },
      { num: '3', title: 'Bookings Flow In', desc: 'Appointments appear in your dashboard with deposits collected automatically.' },
    ],
    visual: 'dashboard',
  },
  {
    id: 'customer',
    label: 'For Customers',
    headline: 'Just tell us\nwhat you need',
    sub: 'Open the app, describe what you want in plain language, and the AI finds the best nearby businesses, shows live availability, and books your appointment — all in one chat.',
    cta: { label: 'Download the App', href: '#download' },
    steps: [
      { num: '1', title: 'Open Chat', desc: '"I need a haircut near downtown" — that\'s all it takes.' },
      { num: '2', title: 'Pick a Business', desc: 'See matching businesses with ratings, distance, prices, and available times.' },
      { num: '3', title: 'Book Instantly', desc: 'Choose a service, pick a time, confirm. Done in under a minute.' },
    ],
    visual: 'chat',
  },
];

/* ─── Feature Grid Data ─────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 12a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375M21 12c0 4.556-4.03 8.25-9 8.25a9.764 9.764 0 01-2.555-.337A5.972 5.972 0 015.41 20.97a5.969 5.969 0 01-.474-.065 4.48 4.48 0 00.978-2.025c.09-.457-.133-.901-.467-1.226C3.93 16.178 3 14.189 3 12c0-4.556 4.03-8.25 9-8.25s9 3.694 9 8.25z" /></svg>,
    title: 'AI-Powered Booking',
    desc: 'Customers chat naturally. The AI finds matching businesses, checks real-time availability, and books appointments — all in one conversation.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
    title: 'Full Business Dashboard',
    desc: 'Services, staff schedules, multiple locations, deposits, extras, coupons, CRM, reviews — everything a booking business needs.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" /></svg>,
    title: 'Mobile-First Experience',
    desc: 'A native mobile app for customers with push notifications, Apple Pay, Google Pay, and smart rebooking reminders.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" /></svg>,
    title: 'Integrated Payments',
    desc: 'Stripe-powered deposits, Apple Pay, Google Pay. Customers pay when they book, you get paid securely via Stripe Connect.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
    title: 'Multi-Location Support',
    desc: 'Manage multiple locations with separate staff, schedules, and services. Customers discover nearby businesses via AI-powered geo-search.',
  },
  {
    icon: <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
    title: 'Smart Notifications',
    desc: 'Email confirmations, push reminders, and AI-driven rebooking nudges that bring customers back at the right time.',
  },
];

/* ─── Mockup Components ─────────────────────────────────────────────────── */

function DashboardMockup() {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-2xl shadow-gray-200/60 overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <div className="h-2.5 w-2.5 rounded-full bg-red-300" />
        <div className="h-2.5 w-2.5 rounded-full bg-amber-300" />
        <div className="h-2.5 w-2.5 rounded-full bg-green-300" />
        <span className="ml-3 text-xs text-gray-400">app.balkina.ai/dashboard</span>
      </div>
      <div className="p-5">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Today', value: '12', sub: 'appointments' },
            { label: 'This Week', value: '$2,840', sub: 'revenue' },
            { label: 'Rating', value: '4.9', sub: '142 reviews' },
          ].map((s, i) => (
            <div key={i} className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">{s.label}</p>
              <p className="mt-1 text-xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>
        {/* Upcoming */}
        <div className="mt-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">Upcoming</p>
          <div className="mt-2 space-y-2">
            {[
              { time: '10:00 AM', name: 'Sarah M.', svc: 'Haircut & Beard', staff: 'Marcus J.' },
              { time: '11:30 AM', name: 'James K.', svc: 'Skin Fade', staff: 'Andre D.' },
              { time: '1:00 PM', name: 'Emma L.', svc: 'Hair Coloring', staff: 'Taylor K.' },
            ].map((apt, i) => (
              <div key={i} className="flex items-center gap-3 rounded-lg border border-gray-100 p-2.5">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{apt.name.charAt(0)}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{apt.name} &middot; {apt.svc}</p>
                  <p className="text-xs text-gray-400">{apt.staff}</p>
                </div>
                <span className="text-xs font-medium text-brand-600">{apt.time}</span>
              </div>
            ))}
          </div>
        </div>
        {/* Quick actions */}
        <div className="mt-4 flex gap-2">
          <div className="flex-1 rounded-lg bg-brand-600 py-2 text-center text-xs font-semibold text-white">Manage Services</div>
          <div className="flex-1 rounded-lg border border-gray-200 py-2 text-center text-xs font-semibold text-gray-600">Staff Schedule</div>
        </div>
      </div>
    </div>
  );
}

function ChatMockup() {
  return (
    <div className="mx-auto max-w-[320px]">
      {/* Phone frame */}
      <div className="rounded-[2.5rem] border-[6px] border-gray-800 bg-gray-800 p-1 shadow-2xl">
        <div className="rounded-[2rem] bg-white overflow-hidden">
          {/* Status bar */}
          <div className="flex items-center justify-between bg-white px-5 pt-3 pb-1">
            <span className="text-xs font-semibold text-gray-900">9:41</span>
            <div className="flex items-center gap-1">
              <div className="h-2.5 w-4 rounded-sm bg-gray-900" />
            </div>
          </div>
          {/* App header */}
          <div className="flex items-center justify-center gap-2 border-b border-gray-100 py-2.5">
            <div className="h-6 w-6 rounded-full bg-brand-600" />
            <span className="text-sm font-bold tracking-wide text-gray-900">BALKINA</span>
          </div>
          {/* Chat */}
          <div className="space-y-2.5 p-4" style={{ minHeight: 340 }}>
            <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-md bg-brand-600 px-3.5 py-2 text-[13px] text-white">
              Find Beauty & Personal Care businesses near me
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-3.5 py-2 text-[13px] text-gray-700">
              Here are some top-rated options nearby:
            </div>
            {/* Business cards */}
            <div className="flex gap-2 overflow-hidden">
              <div className="w-36 shrink-0 rounded-xl border border-gray-200 bg-white p-2">
                <div className="h-14 rounded-lg bg-gradient-to-br from-pink-100 to-rose-50" />
                <p className="mt-1.5 text-[11px] font-semibold text-gray-800">Glow Beauty Studio</p>
                <p className="text-[10px] text-gray-400">0.2 mi &middot; 4.9 stars</p>
              </div>
              <div className="w-36 shrink-0 rounded-xl border border-gray-200 bg-white p-2">
                <div className="h-14 rounded-lg bg-gradient-to-br from-purple-100 to-indigo-50" />
                <p className="mt-1.5 text-[11px] font-semibold text-gray-800">Bella Nails & Spa</p>
                <p className="text-[10px] text-gray-400">0.4 mi &middot; 4.8 stars</p>
              </div>
            </div>
            {/* Service chips */}
            <div className="flex gap-1.5">
              <div className="rounded-lg border border-gray-200 px-2.5 py-1.5">
                <p className="text-[11px] font-medium text-gray-800">Manicure</p>
                <p className="text-[10px] text-brand-600">$35 &middot; 30 min</p>
              </div>
              <div className="rounded-lg border border-brand-300 bg-brand-50 px-2.5 py-1.5">
                <p className="text-[11px] font-medium text-brand-800">Facial</p>
                <p className="text-[10px] text-brand-600">$75 &middot; 60 min</p>
              </div>
            </div>
            <div className="ml-auto max-w-[78%] rounded-2xl rounded-tr-md bg-brand-600 px-3.5 py-2 text-[13px] text-white">
              Book a facial at Glow for tomorrow at 2pm
            </div>
            <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-3.5 py-2 text-[13px] text-gray-700">
              Booked! Your facial at Glow Beauty Studio is confirmed for tomorrow at 2:00 PM.
            </div>
          </div>
          {/* Input bar */}
          <div className="border-t border-gray-100 px-4 py-3">
            <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 px-4 py-2">
              <span className="flex-1 text-[13px] text-gray-400">Ask me anything...</span>
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600">
                <svg className="h-3.5 w-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [activeTab, setActiveTab] = useState(0);
  const tab = HERO_TABS[activeTab]!;

  return (
    <>
      {/* ─── Hero (full viewport) ────────────────────────────────────────── */}
      <section className="relative min-h-[calc(100vh-73px)] flex flex-col bg-gradient-to-b from-brand-50/60 via-white to-white">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 py-12 md:py-16">
          {/* Badge + tabs */}
          <div className="flex flex-col items-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-brand-600" />
              </span>
              Now in beta
            </div>
            {/* Tab switcher */}
            <div className="inline-flex rounded-full border border-gray-200 bg-white p-1 shadow-sm">
              {HERO_TABS.map((t, i) => (
                <button
                  key={t.id}
                  onClick={() => setActiveTab(i)}
                  className={`rounded-full px-6 py-2 text-sm font-semibold transition-all ${
                    activeTab === i
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Content: left text + right visual */}
          <div className="mt-10 flex flex-1 flex-col items-center gap-12 lg:mt-14 lg:flex-row lg:items-start lg:gap-16">
            {/* Left — text + steps */}
            <div className="flex-1 text-center lg:text-left">
              <h1 className="whitespace-pre-line text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
                {tab.headline}
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-relaxed text-gray-600 md:text-xl lg:mx-0 mx-auto">
                {tab.sub}
              </p>
              <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start sm:justify-center">
                <a href={tab.cta.href} className="rounded-full bg-brand-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 hover:bg-brand-700 transition-all hover:shadow-xl hover:shadow-brand-600/30">
                  {tab.cta.label}
                </a>
                {activeTab === 1 && (
                  <a href="https://app.balkina.ai/register" className="rounded-full border border-gray-300 bg-white px-8 py-3.5 text-base font-semibold text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-colors">
                    List Your Business
                  </a>
                )}
              </div>
              {/* How it works (contextual to tab) */}
              <div className="mt-12">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">How it works</p>
                <div className="mt-4 space-y-4">
                  {tab.steps.map((s) => (
                    <div key={s.num} className="flex items-start gap-4">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">{s.num}</div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{s.title}</p>
                        <p className="text-sm text-gray-500">{s.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Right — visual */}
            <div className="w-full max-w-md shrink-0 lg:max-w-lg">
              {tab.visual === 'dashboard' ? <DashboardMockup /> : <ChatMockup />}
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex justify-center pb-6">
          <Link href="#features" className="flex flex-col items-center gap-1 text-gray-300 hover:text-gray-400 transition-colors">
            <span className="text-xs">Scroll to explore</span>
            <svg className="h-5 w-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </Link>
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

      {/* ─── Pricing Preview ──────────────────────────────────────────────── */}
      <section id="pricing" className="bg-gray-50 py-24 md:py-32">
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

      {/* ─── Download / CTA ───────────────────────────────────────────────── */}
      <section id="download" className="bg-brand-600 py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Ready to get started?</h2>
          <p className="mt-4 text-lg text-brand-100">Whether you run a business or need to book one — Balkina has you covered.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="https://app.balkina.ai/register" className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-brand-600 shadow-lg hover:bg-gray-50 transition-colors">
              List Your Business
            </a>
            <a href="#" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
              App Store
            </a>
            <a href="#" className="inline-flex items-center gap-2 rounded-full border border-white/30 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.292l2.545 1.473c.68.394.68 1.03 0 1.424l-2.545 1.473-2.534-2.534 2.534-2.536zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" /></svg>
              Google Play
            </a>
          </div>
        </div>
      </section>
    </>
  );
}
