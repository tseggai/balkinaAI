'use client';

import Link from 'next/link';

/* ─── Reuse devices.css phone frame ────────────────────────────────────── */

const PHONE_SCALE = 0.48;
const PHONE_VIS_W = Math.round(428 * PHONE_SCALE);
const PHONE_VIS_H = Math.round(868 * PHONE_SCALE);
const PHONE_CONTENT_SCALE = 390 / 260;

function PhoneDevice({ children }: { children: React.ReactNode }) {
  return (
    <div className="device device-iphone-14-pro">
      <div className="device-frame">
        <div className="device-screen">
          <div style={{ transform: `scale(${PHONE_CONTENT_SCALE})`, transformOrigin: 'top left', width: 260 }}>
            {children}
          </div>
        </div>
      </div>
      <div className="device-stripe" />
      <div className="device-header" />
      <div className="device-sensors" />
      <div className="device-btns" />
      <div className="device-power" />
      <div className="device-home" />
    </div>
  );
}

function ScaledPhone({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div style={{ width: PHONE_VIS_W, height: PHONE_VIS_H, position: 'relative' }}>
        <div style={{ transform: `scale(${PHONE_SCALE})`, transformOrigin: 'bottom left', position: 'absolute', bottom: 0, left: 0 }}>
          <PhoneDevice>{children}</PhoneDevice>
        </div>
      </div>
      <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">{label}</p>
    </div>
  );
}

/* ─── Customer phone content ───────────────────────────────────────────── */

function CustomerPhonePreview() {
  return (
    <div className="bg-white" style={{ height: 530 }}>
      {/* Header */}
      <div className="flex items-center justify-center gap-1.5 border-b border-gray-100 py-2">
        <div className="h-4 w-4 rounded-full bg-brand-600" />
        <span className="text-[9px] font-bold tracking-widest text-gray-800">BALKINA</span>
      </div>
      <div className="space-y-2 px-3 pt-3">
        <div className="flex justify-end">
          <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-brand-500 px-2.5 py-2 text-[9px] text-white">
            Find a barber nearby
          </div>
        </div>
        <div className="max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[9px] text-gray-700">
          Here are top-rated barbers near you:
        </div>
        <div className="flex gap-1.5">
          {[
            { name: 'Dan the Barber', rating: '5.0', dist: '0.3 mi', gradient: 'from-amber-200 via-orange-100 to-yellow-50' },
            { name: 'Fresh Cuts', rating: '4.8', dist: '0.7 mi', gradient: 'from-sky-200 via-blue-100 to-indigo-50' },
          ].map((b, i) => (
            <div key={i} className={`w-[110px] shrink-0 overflow-hidden rounded-xl border ${i === 0 ? 'border-brand-300' : 'border-gray-100'}`}>
              <div className={`h-12 bg-gradient-to-br ${b.gradient}`} />
              <div className="p-1.5">
                <p className="text-[8px] font-bold text-gray-900">{b.name}</p>
                <p className="text-[7px] text-gray-400">{b.rating} &#9733; &middot; {b.dist}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-end">
          <div className="rounded-2xl rounded-tr-md bg-brand-500 px-2.5 py-2 text-[9px] text-white">
            Hair Color at Dan the Barber
          </div>
        </div>
        <div className="rounded-xl border border-green-200 bg-green-50 p-2.5">
          <div className="flex items-center gap-1.5">
            <svg className="h-3.5 w-3.5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            <span className="text-[9px] font-semibold text-green-800">Confirmed!</span>
          </div>
          <p className="mt-0.5 text-[8px] text-green-700">Hair Color at Dan the Barber &middot; Tomorrow 9 AM</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Staff phone content ──────────────────────────────────────────────── */

function StaffPhonePreview() {
  return (
    <div className="bg-white" style={{ height: 530 }}>
      <div className="px-3 pt-3">
        <div className="flex items-center justify-between pb-3">
          <div>
            <p className="text-[10px] font-bold text-gray-900">Dragana Djurica</p>
            <p className="text-[8px] text-gray-400">Hair Stylist</p>
          </div>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100">
            <span className="text-[8px] font-bold text-brand-700">DD</span>
          </div>
        </div>
        <div className="mb-3 rounded-lg bg-gray-50 p-2">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400">Today</p>
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-2 text-[9px]">
              <span className="w-12 text-gray-400">9:00 AM</span>
              <div className="h-1.5 flex-1 rounded-full bg-brand-400" />
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="w-12 text-gray-400">10:00 AM</span>
              <div className="h-1.5 flex-1 rounded-full bg-brand-200" />
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="w-12 font-medium text-gray-600">11:00 AM</span>
              <div className="h-1.5 flex-1 rounded-full bg-gray-200" />
            </div>
          </div>
        </div>
        <div className="animate-slide-down rounded-xl border border-brand-200 bg-brand-50 p-2.5 shadow-md shadow-brand-100/50">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-brand-600">
              <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>
            </div>
            <div>
              <p className="text-[9px] font-semibold text-brand-800">New Booking Request</p>
              <p className="text-[8px] text-brand-600">Hair Color &middot; Tomorrow 9 AM</p>
            </div>
          </div>
        </div>
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-2.5">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gray-100 text-[9px] font-bold text-gray-600">EL</div>
            <div>
              <p className="text-[10px] font-semibold text-gray-900">Emma L.</p>
              <p className="text-[8px] text-gray-400">First visit &middot; Via AI chat</p>
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <div className="flex-1 rounded-lg bg-green-600 py-1.5 text-center text-[9px] font-semibold text-white">Approve</div>
            <div className="flex-1 rounded-lg border border-gray-200 py-1.5 text-center text-[9px] font-semibold text-gray-600">Reschedule</div>
          </div>
        </div>
        <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5">
          <svg className="h-3 w-3 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
          <p className="text-[8px] font-medium text-green-700">Confirmed &middot; Customer notified</p>
        </div>
      </div>
    </div>
  );
}

/* ─── How it works steps ───────────────────────────────────────────────── */

const STEPS = [
  { num: '1', title: 'Open the chat', desc: 'No browsing, no searching through lists. Just say what you need.', example: '"I need a haircut near downtown"' },
  { num: '2', title: 'See your options', desc: 'AI shows matching businesses with ratings, distance, prices, and real-time availability.', example: 'Cards with services, staff, and time slots' },
  { num: '3', title: 'Book and go', desc: 'Pick a time, confirm, pay the deposit if needed. Confirmation is instant.', example: '"Book a facial at Glow for tomorrow at 2pm"' },
];

/* ─── Perks with SVG icons ─────────────────────────────────────────────── */

const PERK_ICONS = [
  <svg key="chat" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>,
  <svg key="pin" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  <svg key="bolt" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>,
  <svg key="pay" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
  <svg key="bell" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
  <svg key="refresh" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.182" /></svg>,
];

const PERKS = [
  { title: 'One Chat, Every Booking', desc: 'Barbers, yoga, dental, massage, personal training — all from one app.' },
  { title: 'Nearby Discovery', desc: 'Find businesses near you with distance, drive time, and ratings.' },
  { title: 'Real-Time Availability', desc: 'See actual open slots and book instantly. No callbacks.' },
  { title: 'Pay in App', desc: 'Apple Pay, Google Pay, or card. Deposits handled securely.' },
  { title: 'Smart Reminders', desc: 'Push notifications so you never miss an appointment.' },
  { title: 'Easy Rebooking', desc: 'AI remembers your preferences and suggests when to rebook.' },
];

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function AppPage() {
  return (
    <>
      {/* ─── Hero ────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto max-w-7xl px-6 pb-20 pt-16 md:pt-24">
          <div className="text-center">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
              Free on iOS &amp; Android
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
              Book anything by chatting
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base text-gray-500 md:text-lg">
              Tell the AI what you need. It finds the best businesses near you, shows live availability, and books your appointment — in seconds.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <a href="#" className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-7 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-gray-800 transition-colors">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
                App Store
              </a>
              <a href="#" className="inline-flex items-center gap-2 rounded-full bg-gray-900 px-7 py-3.5 text-base font-semibold text-white shadow-lg hover:bg-gray-800 transition-colors">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.292l2.545 1.473c.68.394.68 1.03 0 1.424l-2.545 1.473-2.534-2.534 2.534-2.536zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" /></svg>
                Google Play
              </a>
            </div>
          </div>

          {/* Two phones side by side */}
          <div className="mt-14 flex items-end justify-center gap-6 md:gap-10">
            <ScaledPhone label="Customer Experience">
              <CustomerPhonePreview />
            </ScaledPhone>
            <ScaledPhone label="Staff Experience">
              <StaffPhonePreview />
            </ScaledPhone>
          </div>
        </div>
      </section>

      {/* ─── How It Works ─────────────────────────────────────────────────── */}
      <section className="section-animate py-24 md:py-32">
        <div className="mx-auto max-w-5xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Booking in 3 messages</h2>
            <p className="mt-4 text-lg text-gray-500">No apps to learn, no menus to navigate. Just chat.</p>
          </div>
          <div className="mt-16 grid gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.num} className="rounded-2xl border border-gray-100 bg-white p-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-600 text-lg font-bold text-white">{s.num}</div>
                <h3 className="mt-5 text-base font-semibold text-gray-900">{s.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-500">{s.desc}</p>
                <p className="mt-3 rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-xs italic text-brand-700">{s.example}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Perks ────────────────────────────────────────────────────────── */}
      <section className="section-animate bg-gray-50 py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Why customers love Balkina</h2>
            <p className="mt-4 text-lg text-gray-500">Everything you need to book, nothing you don&apos;t.</p>
          </div>
          <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PERKS.map((p, i) => (
              <div key={i} className="group rounded-2xl border border-gray-100 bg-white p-6 transition-all hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  {PERK_ICONS[i]}
                </div>
                <h3 className="mt-3 text-base font-semibold text-gray-900">{p.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Download CTA ─────────────────────────────────────────────────── */}
      <section className="section-animate bg-brand-600 py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Stop calling. Start chatting.</h2>
          <p className="mt-4 text-lg text-brand-100">Download Balkina and book your next appointment in under a minute.</p>
          <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <a href="#" className="inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-gray-900 shadow-lg hover:bg-gray-50 transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" /></svg>
              Download for iPhone
            </a>
            <a href="#" className="inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-3.5 text-base font-semibold text-gray-900 shadow-lg hover:bg-gray-50 transition-colors">
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.292l2.545 1.473c.68.394.68 1.03 0 1.424l-2.545 1.473-2.534-2.534 2.534-2.536zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z" /></svg>
              Download for Android
            </a>
          </div>
        </div>
      </section>

      {/* ─── Minimal Footer ───────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 bg-white py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-4 px-6 sm:flex-row sm:justify-between">
          <div className="flex items-center gap-2">
            <div className="h-5 w-5 rounded-full bg-brand-600" />
            <span className="text-sm font-semibold text-gray-800">Balkina AI</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-gray-400">
            <Link href="/privacy" className="hover:text-gray-600 transition-colors">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-gray-600 transition-colors">Terms of Service</Link>
          </div>
          <p className="text-sm text-gray-400">&copy; {new Date().getFullYear()} Balkina AI</p>
        </div>
      </footer>
    </>
  );
}
