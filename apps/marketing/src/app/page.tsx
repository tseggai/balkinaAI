'use client';

import Link from 'next/link';

/* ─── Chat Avatars ─────────────────────────────────────────────────────── */

function BalkinaAvatar() {
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-600">
      <span className="text-[7px] font-bold text-white">B</span>
    </div>
  );
}

function CustomerAvatar() {
  return (
    <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-200">
      <svg className="h-3 w-3 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
      </svg>
    </div>
  );
}

/* ─── Device Frames ────────────────────────────────────────────────────── */

function PhoneMockup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-[2.5rem] border border-gray-200/80 bg-gray-50 p-[3px] shadow-2xl shadow-gray-300/40">
        <div className="relative w-[250px] rounded-[2.3rem] bg-white overflow-hidden">
          {/* Dynamic Island */}
          <div className="absolute top-[6px] left-1/2 -translate-x-1/2 z-10 h-[14px] w-[50px] rounded-full bg-gray-900" />
          <div className="pt-6">{children}</div>
          {/* Home Indicator */}
          <div className="flex justify-center pb-2 pt-1">
            <div className="h-[3px] w-20 rounded-full bg-gray-200" />
          </div>
        </div>
      </div>
      <p className="mt-5 text-sm font-semibold text-gray-600">{label}</p>
    </div>
  );
}

function IPadMockup({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="rounded-[1.2rem] border border-gray-200/80 bg-gray-50 p-[3px] shadow-2xl shadow-gray-300/40">
        <div className="relative w-[480px] rounded-[1rem] bg-white overflow-hidden">
          {/* Camera dot */}
          <div className="absolute top-[8px] left-1/2 -translate-x-1/2 z-10 h-[6px] w-[6px] rounded-full bg-gray-300" />
          {children}
          {/* Home Indicator */}
          <div className="flex justify-center pb-1.5">
            <div className="h-[3px] w-20 rounded-full bg-gray-200" />
          </div>
        </div>
      </div>
      <p className="mt-5 text-sm font-semibold text-gray-600">{label}</p>
    </div>
  );
}

/* ─── Customer Booking Flow (5 animated screens) ──────────────────────── */

function CustomerPhoneAnimation() {
  const backArrow = (
    <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );

  return (
    <PhoneMockup label="Your Customers">
      <div className="relative overflow-hidden" style={{ height: 430 }}>

        {/* ── Screen 1: Categories ──────────────────────────────────── */}
        <div className="bk-screen-1 absolute inset-0 px-3 pt-1">
          <div className="flex items-center gap-1.5 pb-3">
            <BalkinaAvatar />
            <span className="text-[10px] font-bold text-gray-800">Balkina</span>
          </div>
          <div className="mb-3 flex items-start gap-1.5">
            <BalkinaAvatar />
            <div className="rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[11px] text-gray-700">
              Hi! What are you looking for?
            </div>
          </div>
          <div className="grid grid-cols-3 gap-1.5 px-1">
            {[
              { name: 'Beauty', gradient: 'from-pink-400 to-rose-300' },
              { name: 'Wellness', gradient: 'from-emerald-400 to-teal-300', selected: true },
              { name: 'Fitness', gradient: 'from-orange-400 to-amber-300' },
              { name: 'Medical', gradient: 'from-blue-400 to-cyan-300' },
              { name: 'Pets', gradient: 'from-yellow-400 to-amber-200' },
              { name: 'Home', gradient: 'from-violet-400 to-purple-300' },
            ].map((cat, i) => (
              <div
                key={i}
                className={`flex flex-col items-center rounded-xl border p-2.5 ${
                  cat.selected
                    ? 'border-brand-300 bg-brand-50 shadow-sm'
                    : 'border-gray-100 bg-white'
                }`}
              >
                <div className={`h-8 w-8 rounded-xl bg-gradient-to-br ${cat.gradient}`} />
                <p className={`mt-1 text-[9px] font-medium ${
                  cat.selected ? 'text-brand-700' : 'text-gray-600'
                }`}>{cat.name}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Screen 2: Businesses ─────────────────────────────────── */}
        <div className="bk-screen-2 absolute inset-0 px-3 pt-1">
          <div className="flex items-center gap-1.5 pb-3">
            {backArrow}
            <span className="text-[10px] font-semibold text-gray-800">Wellness</span>
          </div>
          <div className="mb-2 flex items-start justify-end gap-1.5">
            <div className="rounded-2xl rounded-tr-md bg-brand-600 px-2.5 py-2 text-[11px] text-white">
              Wellness
            </div>
            <CustomerAvatar />
          </div>
          <div className="mb-2 flex items-start gap-1.5">
            <BalkinaAvatar />
            <div className="rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[11px] text-gray-700">
              Here are spots near you:
            </div>
          </div>
          <div className="flex gap-2 overflow-hidden px-1">
            {[
              { name: 'Sunrise Yoga', rating: '4.8', dist: '0.3 mi', gradient: 'from-emerald-300 via-teal-200 to-cyan-100' },
              { name: 'Zen Wellness', rating: '4.9', dist: '0.5 mi', gradient: 'from-brand-300 via-indigo-200 to-purple-100', selected: true },
              { name: 'Harmony Spa', rating: '4.7', dist: '1.2 mi', gradient: 'from-rose-300 via-pink-200 to-fuchsia-100' },
            ].map((biz, i) => (
              <div
                key={i}
                className={`w-[105px] shrink-0 rounded-xl border overflow-hidden ${
                  biz.selected ? 'border-brand-300 shadow-md shadow-brand-100/50' : 'border-gray-100'
                }`}
              >
                <div className={`h-14 bg-gradient-to-br ${biz.gradient}`} />
                <div className="p-1.5">
                  <p className={`text-[10px] font-semibold ${biz.selected ? 'text-brand-800' : 'text-gray-800'}`}>{biz.name}</p>
                  <div className="mt-0.5 flex items-center gap-1">
                    <span className="text-[9px] text-amber-500">&#9733;</span>
                    <span className="text-[9px] text-gray-500">{biz.rating}</span>
                    <span className="text-[9px] text-gray-300">&middot;</span>
                    <span className="text-[9px] text-gray-400">{biz.dist}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Screen 3: Services ───────────────────────────────────── */}
        <div className="bk-screen-3 absolute inset-0 px-3 pt-1">
          <div className="flex items-center gap-1.5 pb-3">
            {backArrow}
            <span className="text-[10px] font-semibold text-gray-800">Zen Wellness</span>
          </div>
          <div className="mb-2 flex items-start gap-1.5">
            <BalkinaAvatar />
            <div className="rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[11px] text-gray-700">
              Here are their services:
            </div>
          </div>
          <div className="space-y-1.5 px-1">
            {[
              { name: 'Vinyasa Flow', price: '$30', dur: '60 min', selected: true },
              { name: 'Hot Yoga', price: '$35', dur: '60 min' },
              { name: 'Yin & Restore', price: '$28', dur: '45 min' },
              { name: 'Power Yoga', price: '$32', dur: '75 min' },
            ].map((svc, i) => (
              <div
                key={i}
                className={`flex items-center justify-between rounded-xl border p-2.5 ${
                  svc.selected ? 'border-brand-300 bg-brand-50' : 'border-gray-100 bg-white'
                }`}
              >
                <div>
                  <p className={`text-[11px] font-semibold ${svc.selected ? 'text-brand-800' : 'text-gray-800'}`}>{svc.name}</p>
                  <p className={`text-[9px] ${svc.selected ? 'text-brand-500' : 'text-gray-400'}`}>{svc.dur}</p>
                </div>
                <p className={`text-[11px] font-bold ${svc.selected ? 'text-brand-700' : 'text-gray-600'}`}>{svc.price}</p>
              </div>
            ))}
          </div>
        </div>

        {/* ── Screen 4: Staff + Time Slots ─────────────────────────── */}
        <div className="bk-screen-4 absolute inset-0 px-3 pt-1">
          <div className="flex items-center gap-1.5 pb-3">
            {backArrow}
            <span className="text-[10px] font-semibold text-gray-800">Vinyasa Flow</span>
          </div>
          <div className="mb-2 flex items-start gap-1.5">
            <BalkinaAvatar />
            <div className="rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[11px] text-gray-700">
              Pick your instructor &amp; time:
            </div>
          </div>
          <div className="mb-3 flex gap-2 px-1">
            {[
              { name: 'Priya S.', initials: 'PS', gradient: 'from-amber-200 to-orange-100', color: 'text-amber-800', selected: true },
              { name: 'Luna R.', initials: 'LR', gradient: 'from-sky-200 to-blue-100', color: 'text-blue-800' },
              { name: 'Raj K.', initials: 'RK', gradient: 'from-emerald-200 to-green-100', color: 'text-green-800' },
            ].map((staff, i) => (
              <div
                key={i}
                className={`flex flex-1 flex-col items-center rounded-xl border p-2 ${
                  staff.selected ? 'border-brand-300 bg-brand-50' : 'border-gray-100'
                }`}
              >
                <div className={`flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br ${staff.gradient}`}>
                  <span className={`text-[10px] font-bold ${staff.color}`}>{staff.initials}</span>
                </div>
                <p className={`mt-1 text-[9px] font-medium ${staff.selected ? 'text-brand-700' : 'text-gray-600'}`}>{staff.name}</p>
                <div className="mt-0.5 flex items-center gap-0.5">
                  <span className="text-[8px] text-amber-500">&#9733;</span>
                  <span className="text-[8px] text-gray-400">{staff.selected ? '4.9' : i === 1 ? '4.7' : '4.8'}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mb-1.5 px-1 text-[9px] font-semibold uppercase tracking-wider text-gray-400">Tomorrow</p>
          <div className="grid grid-cols-4 gap-1 px-1">
            {['9:00', '10:00', '11:00', '14:00', '15:00', '16:00', '17:00', '18:00'].map((time) => (
              <div
                key={time}
                className={`rounded-lg border py-1.5 text-center text-[10px] font-medium ${
                  time === '10:00'
                    ? 'border-brand-400 bg-brand-600 text-white'
                    : 'border-gray-100 text-gray-600'
                }`}
              >
                {time}
              </div>
            ))}
          </div>
        </div>

        {/* ── Screen 5: Summary + Confirmation ─────────────────────── */}
        <div className="bk-screen-5 absolute inset-0 px-3 pt-1">
          <div className="flex items-center gap-1.5 pb-3">
            <BalkinaAvatar />
            <span className="text-[10px] font-bold text-gray-800">Balkina</span>
          </div>
          <div className="mb-2 flex items-start gap-1.5">
            <BalkinaAvatar />
            <div className="rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[11px] text-gray-700">
              Here&apos;s your booking summary:
            </div>
          </div>
          <div className="mx-1 rounded-xl border border-gray-200 bg-white p-3 shadow-sm">
            <div className="space-y-2">
              {[
                { l: 'Business', v: 'Zen Wellness' },
                { l: 'Service', v: 'Vinyasa Flow' },
                { l: 'Instructor', v: 'Priya S.' },
                { l: 'Date & Time', v: 'Tomorrow, 10:00 AM' },
                { l: 'Duration', v: '60 min' },
              ].map((row) => (
                <div key={row.l} className="flex justify-between text-[10px]">
                  <span className="text-gray-400">{row.l}</span>
                  <span className="font-semibold text-gray-800">{row.v}</span>
                </div>
              ))}
              <div className="flex justify-between border-t border-gray-100 pt-2 text-[10px]">
                <span className="text-gray-400">Total</span>
                <span className="font-bold text-gray-900">$30.00</span>
              </div>
            </div>
          </div>
          <div className="mx-1 mt-3 rounded-xl border border-green-200 bg-green-50 p-2.5">
            <div className="flex items-center gap-1.5">
              <svg className="h-4 w-4 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <p className="text-[11px] font-semibold text-green-800">Booking Confirmed!</p>
            </div>
            <p className="mt-1 text-[9px] text-green-600">You&apos;ll receive a confirmation shortly.</p>
          </div>
        </div>

      </div>
    </PhoneMockup>
  );
}

/* ─── Staff Notification Animation ──────────────────────────────────────── */

function StaffPhoneAnimation() {
  return (
    <PhoneMockup label="Your Staff">
      <div className="px-3 pb-4 pt-3" style={{ minHeight: 420 }}>
        {/* Header */}
        <div className="flex items-center justify-between pb-3">
          <div>
            <p className="text-[11px] font-bold text-gray-900">Priya Sharma</p>
            <p className="text-[9px] text-gray-400">Yoga Instructor</p>
          </div>
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100">
            <span className="text-[10px] font-bold text-brand-700">PS</span>
          </div>
        </div>

        {/* Today's schedule */}
        <div className="mb-3 rounded-lg bg-gray-50 p-2">
          <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Today</p>
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-14 text-gray-400">8:00 AM</span>
              <div className="h-1.5 flex-1 rounded-full bg-brand-200" />
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-14 text-gray-400">9:00 AM</span>
              <div className="h-1.5 flex-1 rounded-full bg-brand-400" />
            </div>
            <div className="flex items-center gap-2 text-[10px]">
              <span className="w-14 font-medium text-gray-600">10:00 AM</span>
              <div className="h-1.5 flex-1 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>

        {/* New booking notification — animated */}
        <div className="animate-fade-in-4 space-y-2.5">
          {/* Push notification */}
          <div className="animate-slide-down rounded-xl border border-brand-200 bg-brand-50 p-3 shadow-md shadow-brand-100/50">
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600">
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-brand-800">New Booking Request</p>
                <p className="text-[9px] text-brand-600">Vinyasa Flow &middot; Tomorrow 10 AM</p>
              </div>
            </div>
          </div>

          {/* Booking detail card */}
          <div className="animate-fade-in-5 rounded-xl border border-gray-200 bg-white p-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[10px] font-bold text-gray-600">EL</div>
              <div>
                <p className="text-[11px] font-semibold text-gray-900">Emma L.</p>
                <p className="text-[9px] text-gray-400">First visit &middot; Via AI chat</p>
              </div>
            </div>
            <div className="mt-2 rounded-lg bg-gray-50 p-2">
              <div className="flex justify-between text-[9px]">
                <span className="text-gray-400">Service</span>
                <span className="font-medium text-gray-700">Vinyasa Flow (60 min)</span>
              </div>
              <div className="mt-1 flex justify-between text-[9px]">
                <span className="text-gray-400">Time</span>
                <span className="font-medium text-gray-700">Tomorrow, 10:00 AM</span>
              </div>
              <div className="mt-1 flex justify-between text-[9px]">
                <span className="text-gray-400">Deposit</span>
                <span className="font-medium text-green-600">$10 paid</span>
              </div>
            </div>
            {/* Action buttons */}
            <div className="mt-2.5 flex gap-2">
              <button className="animate-fade-in-6 flex-1 rounded-lg bg-green-600 py-2 text-center text-[10px] font-semibold text-white">
                Approve
              </button>
              <button className="animate-fade-in-6 flex-1 rounded-lg border border-gray-200 py-2 text-center text-[10px] font-semibold text-gray-600">
                Reschedule
              </button>
            </div>
          </div>

          {/* Approved state */}
          <div className="animate-fade-in-7 flex items-center gap-1.5 rounded-lg bg-green-50 px-3 py-2">
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <p className="text-[10px] font-medium text-green-700">Booking confirmed &middot; Customer notified</p>
          </div>
        </div>
      </div>
    </PhoneMockup>
  );
}

/* ─── Dashboard iPad (Landscape) ───────────────────────────────────────── */

function DashboardIPadAnimation() {
  return (
    <IPadMockup label="Your Dashboard">
      <div className="p-4 pt-5">
        {/* Stats row */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Today', value: '8', sub: 'bookings', bg: 'bg-brand-50', fg: 'text-brand-700' },
            { label: 'Pending', value: '2', sub: 'requests', bg: 'bg-amber-50', fg: 'text-amber-700' },
            { label: 'Revenue', value: '$1,240', sub: 'this week', bg: 'bg-green-50', fg: 'text-green-700' },
            { label: 'Rating', value: '4.9', sub: '89 reviews', bg: 'bg-purple-50', fg: 'text-purple-700' },
          ].map((s, i) => (
            <div key={i} className={`rounded-lg p-2 ${s.bg}`}>
              <p className="text-[8px] text-gray-400">{s.label}</p>
              <p className={`text-lg font-bold ${s.fg}`}>{s.value}</p>
              <p className="text-[8px] text-gray-400">{s.sub}</p>
            </div>
          ))}
        </div>

        {/* Appointments table */}
        <div className="mt-3">
          <div className="flex items-center justify-between">
            <p className="text-[9px] font-semibold uppercase tracking-wider text-gray-400">Today&apos;s Appointments</p>
            <div className="rounded bg-brand-600 px-2 py-0.5 text-[8px] font-semibold text-white">+ New</div>
          </div>
          <div className="mt-2 rounded-lg border border-gray-100">
            <div className="grid grid-cols-5 gap-1 border-b border-gray-100 bg-gray-50 px-2 py-1 text-[8px] font-semibold text-gray-400">
              <span>Time</span><span>Customer</span><span>Service</span><span>Staff</span><span>Status</span>
            </div>
            {[
              { time: '8:00 AM', name: 'Sarah M.', svc: 'Vinyasa Flow', staff: 'Priya S.', status: 'Completed', sc: 'bg-gray-100 text-gray-600' },
              { time: '9:00 AM', name: 'James K.', svc: 'Hot Yoga', staff: 'Luna R.', status: 'In Progress', sc: 'bg-blue-100 text-blue-700' },
              { time: '10:00 AM', name: 'Emma L.', svc: 'Vinyasa Flow', staff: 'Priya S.', status: 'Confirmed', sc: 'bg-green-100 text-green-700' },
            ].map((apt, i) => (
              <div key={i} className={`grid grid-cols-5 gap-1 px-2 py-1.5 text-[9px] ${i < 2 ? 'border-b border-gray-50' : ''} ${i === 2 ? 'animate-fade-in-6 bg-green-50/50' : ''}`}>
                <span className="text-gray-500">{apt.time}</span>
                <span className="font-medium text-gray-800">{apt.name}</span>
                <span className="text-gray-600">{apt.svc}</span>
                <span className="text-gray-500">{apt.staff}</span>
                <span className={`inline-block w-fit rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${apt.sc}`}>{apt.status}</span>
              </div>
            ))}
            <div className="animate-fade-in-7 grid grid-cols-5 gap-1 border-t border-brand-100 bg-brand-50/50 px-2 py-1.5 text-[9px]">
              <span className="text-gray-500">11:30 AM</span>
              <span className="font-medium text-brand-700">New booking!</span>
              <span className="text-gray-600">Gentle Yoga</span>
              <span className="text-gray-500">Raj K.</span>
              <span className="inline-block w-fit rounded-full bg-amber-100 px-1.5 py-0.5 text-[7px] font-semibold text-amber-700">Pending</span>
            </div>
          </div>
        </div>
      </div>
    </IPadMockup>
  );
}

/* ─── Feature Grid ──────────────────────────────────────────────────────── */

const FEATURES = [
  { icon: '📅', title: 'Service Management', desc: 'Set prices, durations, deposits, extras, buffer times, and booking limits for every service.' },
  { icon: '👥', title: 'Staff Scheduling', desc: 'Individual schedules, day-offs, service assignments, and multi-location support for your team.' },
  { icon: '📍', title: 'Multi-Location', desc: 'Manage multiple branches with separate staff, services, and schedules from one dashboard.' },
  { icon: '💳', title: 'Deposit Payments', desc: 'Collect deposits at booking via Stripe. Apple Pay, Google Pay, and cards supported.' },
  { icon: '🎟️', title: 'Coupons & Promotions', desc: 'Create discount codes with usage limits, expiration dates, and percentage or fixed amounts.' },
  { icon: '📊', title: 'Analytics & CRM', desc: 'Track revenue, bookings, reviews, and customer history. Know your business inside out.' },
  { icon: '🔔', title: 'Smart Reminders', desc: 'Automated email and push confirmations, reminders, and AI-powered rebooking nudges.' },
  { icon: '⭐', title: 'Reviews & Ratings', desc: 'Collect customer reviews automatically. Your rating helps you rank higher in AI search.' },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function HomePage() {
  return (
    <>
      {/* ─── Hero (full viewport, visual-first) ──────────────────────────── */}
      <section className="relative flex min-h-[calc(100vh-73px)] flex-col bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pt-10 md:pt-14">
          {/* Minimal headline */}
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
              Your business, booked by AI
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-base text-gray-500 md:text-lg">
              Customers find you, book you, and pay you — all through a single chat. You just do what you do best.
            </p>
          </div>

          {/* Three-device showcase */}
          <div className="mt-10 flex flex-1 flex-col items-center justify-center gap-8 pb-8 lg:flex-row lg:items-start lg:gap-6 xl:gap-10">
            {/* Customer phone */}
            <div className="shrink-0 lg:mt-8">
              <CustomerPhoneAnimation />
            </div>

            {/* Dashboard iPad — center, hidden on mobile */}
            <div className="hidden shrink-0 lg:flex lg:order-none lg:-mt-2">
              <DashboardIPadAnimation />
            </div>

            {/* Staff phone */}
            <div className="shrink-0 lg:mt-8">
              <StaffPhoneAnimation />
            </div>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex justify-center pb-6">
          <Link href="#features" className="flex flex-col items-center gap-1 text-gray-300 hover:text-gray-400 transition-colors">
            <span className="text-xs">See all features</span>
            <svg className="h-5 w-5 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" /></svg>
          </Link>
        </div>
      </section>

      {/* ─── Features ─────────────────────────────────────────────────────── */}
      <section id="features" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Everything you need, nothing you don&apos;t</h2>
            <p className="mt-4 text-lg text-gray-500">A complete booking platform built for service businesses.</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="group rounded-2xl border border-gray-100 bg-white p-6 transition-all hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/40">
                <span className="text-2xl">{f.icon}</span>
                <h3 className="mt-3 text-base font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Social Proof / Numbers ───────────────────────────────────────── */}
      <section className="border-y border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {[
              { value: '< 1 min', label: 'Average booking time' },
              { value: '24/7', label: 'AI availability' },
              { value: '0%', label: 'No-show rate with deposits' },
              { value: '$0', label: 'To get started' },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <p className="text-2xl font-extrabold text-brand-600 md:text-3xl">{s.value}</p>
                <p className="mt-1 text-sm text-gray-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Simple pricing, no surprises</h2>
            <p className="mt-4 text-lg text-gray-500">Start with a free trial. Upgrade when you&apos;re ready.</p>
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
                  Start Free Trial
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
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Let AI fill your calendar</h2>
          <p className="mt-4 text-lg text-brand-100">Join barbershops, yoga studios, salons, and clinics already using Balkina AI.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="https://app.balkina.ai/register" className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-brand-600 shadow-lg hover:bg-gray-50 transition-colors">
              Get Started Free
            </a>
            <Link href="/pricing" className="rounded-full border border-white/30 px-8 py-3.5 text-base font-semibold text-white hover:bg-white/10 transition-colors">
              View Pricing
            </Link>
          </div>
          <p className="mt-4 text-sm text-brand-200">Free 14-day trial. No credit card required.</p>
        </div>
      </section>
    </>
  );
}
