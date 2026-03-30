'use client';

import Link from 'next/link';

/* ─── Reuse devices.css phone frame ────────────────────────────────────── */

const PHONE_SCALE = 0.56;
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
      <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">{label}</p>
      <div style={{ width: PHONE_VIS_W, height: PHONE_VIS_H, position: 'relative' }}>
        <div style={{ transform: `scale(${PHONE_SCALE})`, transformOrigin: 'bottom left', position: 'absolute', bottom: 0, left: 0 }}>
          <PhoneDevice>{children}</PhoneDevice>
        </div>
      </div>
    </div>
  );
}

/* ─── Shared components for phone content ──────────────────────────────── */

function BottomBar() {
  return (
    <div className="shrink-0 bg-white">
      <div className="flex items-center gap-1.5 border-t border-gray-100 px-3 py-1.5">
        <div className="flex-1 rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-[9px] text-gray-300">Ask me anything...</div>
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500">
          <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" /></svg>
        </div>
      </div>
      <div className="flex items-center justify-around border-t border-gray-100 px-2 pb-1 pt-1.5">
        <div className="flex flex-col items-center">
          <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" /></svg>
          <span className="text-[7px] font-medium text-brand-600">Chat</span>
        </div>
        <div className="flex flex-col items-center">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>
          <span className="text-[7px] text-gray-400">Bookings</span>
        </div>
        <div className="flex flex-col items-center">
          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" /></svg>
          <span className="text-[7px] text-gray-400">Profile</span>
        </div>
      </div>
    </div>
  );
}

function ChatHeader() {
  return (
    <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2">
      <svg className="h-3 w-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
      <span className="text-[8px] text-gray-400">Start over</span>
      <div className="ml-2 flex items-center gap-1">
        <img src="/assets/Balkina_icon_color.png" alt="" className="h-4 w-4" />
        <span className="text-[9px] font-bold tracking-widest text-gray-800">BALKINA</span>
      </div>
    </div>
  );
}

/* ─── Customer phone: same scrolling chat as business page ─────────────── */

function CustomerPhoneContent() {
  return (
    <div className="relative overflow-hidden bg-white" style={{ height: 530 }}>
      {/* Intro: Categories */}
      <div className="bk-intro absolute inset-0 z-20 flex flex-col bg-white">
        <div className="flex flex-1 flex-col items-center justify-center px-6">
          <img src="/assets/Balkina_icon_color.png" alt="" className="mb-1 h-10 w-10" />
          <p className="mb-1 text-[10px] font-bold tracking-[0.2em] text-brand-600">BALKINA</p>
          <p className="mb-4 text-[10px] text-gray-400">What would you like to book today?</p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {['Health & Wellness', 'Beauty & Personal Care', 'Fitness & Sports', 'Home Services', 'Professional Services', 'Pet Services'].map((cat, i) => (
              <div key={i} className={`rounded-full border px-3 py-1.5 text-[8px] ${cat === 'Beauty & Personal Care' ? 'border-brand-300 bg-brand-50 font-medium text-brand-700' : 'border-gray-200 text-gray-600'}`}>{cat}</div>
            ))}
          </div>
        </div>
        <BottomBar />
      </div>

      {/* Chat: Continuous scroll */}
      <div className="bk-chat absolute inset-0 z-10 flex flex-col">
        <ChatHeader />
        <div className="flex flex-1 flex-col justify-end overflow-hidden px-3">
          <div className="chat-msg-1 flex justify-end">
            <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-500 px-2.5 py-2 text-[9px] text-white">Find Beauty &amp; Personal Care businesses near me</div>
          </div>
          <div className="chat-msg-2 max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[9px] text-gray-700">Here are some businesses near you:</div>
          <div className="chat-msg-3 flex gap-1.5">
            {[{ name: 'Dan the Barber', r: '5 (9)', d: '0.3 mi', g: 'from-amber-200 via-orange-100 to-yellow-50', s: true }, { name: 'Radiant Spa', r: '4.9 (15)', d: '1.9 mi', g: 'from-emerald-200 via-teal-100 to-cyan-50' }].map((b, i) => (
              <div key={i} className={`w-[120px] shrink-0 overflow-hidden rounded-xl border ${b.s ? 'border-brand-300' : 'border-gray-100'}`}>
                <div className={`h-14 bg-gradient-to-br ${b.g}`} />
                <div className="p-1.5"><p className="text-[8px] font-bold text-gray-900">{b.name}</p><p className="text-[7px] text-gray-400">&#9733; {b.r} &middot; {b.d}</p></div>
              </div>
            ))}
          </div>
          <div className="chat-msg-4 flex gap-1.5">
            {[{ n: 'Beard trimming', p: '$25', s: '20 min' }, { n: 'Hair Color', p: '$30', s: '50% deposit', sel: true }].map((v, i) => (
              <div key={i} className={`flex-1 rounded-xl border p-2 ${v.sel ? 'border-brand-300 bg-brand-50' : 'border-gray-200'}`}>
                <p className={`text-[9px] font-semibold ${v.sel ? 'text-brand-700' : 'text-gray-800'}`}>{v.n}</p>
                <p className={`text-[8px] ${v.sel ? 'text-brand-500' : 'text-gray-400'}`}>{v.p} &middot; {v.s}</p>
              </div>
            ))}
          </div>
          <div className="chat-msg-5 flex justify-end">
            <div className="rounded-2xl rounded-tr-md bg-brand-500 px-2.5 py-2 text-[9px] text-white">Hair Color at Dan the Barber</div>
          </div>
          <div className="chat-msg-6">
            <div className="mb-2 max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[9px] text-gray-700">When would you like your appointment?</div>
            <div className="flex flex-wrap gap-1.5">
              {['Today', 'Tomorrow', 'Next Week'].map((d) => (
                <div key={d} className={`rounded-full border px-3 py-1.5 text-[8px] ${d === 'Tomorrow' ? 'border-brand-400 bg-brand-50 font-medium text-brand-700' : 'border-gray-200 text-gray-600'}`}>{d}</div>
              ))}
            </div>
          </div>
          <div className="chat-msg-7 flex justify-end">
            <div className="rounded-2xl rounded-tr-md bg-brand-500 px-2.5 py-2 text-[9px] text-white">Tomorrow</div>
          </div>
          <div className="chat-msg-8">
            <div className="mb-2 max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[9px] text-gray-700">Here are the available staff and time slots:</div>
            <div className="mb-2 flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-sky-300 via-blue-200 to-indigo-100" />
              <div><p className="text-[9px] font-bold text-gray-900">Helen Jones</p><p className="text-[7px] text-gray-400">15 slots</p></div>
            </div>
            <div className="grid grid-cols-3 gap-1">
              {['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM'].map((t) => (
                <div key={t} className={`rounded-lg border py-1.5 text-center text-[7px] font-medium ${t === '9:00 AM' ? 'border-brand-400 bg-brand-600 text-white' : 'border-gray-200 text-gray-600'}`}>{t}</div>
              ))}
            </div>
          </div>
        </div>
        <BottomBar />
      </div>

      {/* Confirmation */}
      <div className="bk-confirm absolute inset-0 z-30 flex flex-col items-center justify-center bg-gray-50 px-4">
        <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-green-500">
          <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
        </div>
        <p className="mb-1 text-[11px] font-bold text-gray-900">Appointment Confirmed</p>
        <p className="mb-3 text-center text-[8px] text-gray-500">Hair Color at Dan the Barber<br />Tomorrow, 9:00 AM</p>
        <div className="w-full rounded-xl bg-brand-600 py-2 text-center text-[9px] font-semibold text-white">Done</div>
      </div>
    </div>
  );
}

/* ─── Staff phone: animations start at 12s (after customer confirm) ──── */

function StaffPhoneContent() {
  return (
    <div className="bg-white" style={{ height: 530 }}>
      <div className="px-3 pt-10">
        <div className="flex items-center justify-between pb-3">
          <div>
            <p className="text-[10px] font-bold text-gray-900">Helen Jones</p>
            <p className="text-[8px] text-gray-400">Hair Stylist</p>
          </div>
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-100">
            <span className="text-[8px] font-bold text-brand-700">HJ</span>
          </div>
        </div>
        <div className="mb-3 rounded-lg bg-gray-50 p-2">
          <p className="text-[8px] font-semibold uppercase tracking-wider text-gray-400">Tomorrow</p>
          <div className="mt-1 space-y-1">
            <div className="flex items-center gap-2 text-[9px]">
              <span className="w-12 text-gray-400">9:00 AM</span>
              <div className="h-1.5 flex-1 rounded-full bg-gray-200" />
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="w-12 text-gray-400">10:00 AM</span>
              <div className="h-1.5 flex-1 rounded-full bg-brand-200" />
            </div>
            <div className="flex items-center gap-2 text-[9px]">
              <span className="w-12 text-gray-400">11:00 AM</span>
              <div className="h-1.5 flex-1 rounded-full bg-brand-400" />
            </div>
          </div>
        </div>
        {/* Notification appears at 12.5s */}
        <div className="staff-msg-1 rounded-xl border border-brand-200 bg-brand-50 p-2.5 shadow-md shadow-brand-100/50">
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
        {/* Detail card at 13.5s */}
        <div className="staff-msg-2 mt-2 rounded-xl border border-gray-200 bg-white p-2.5">
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
        {/* Confirmed at 14.5s */}
        <div className="staff-msg-3 mt-2 flex items-center gap-1.5 rounded-lg bg-green-50 px-2.5 py-1.5">
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
      {/* ─── Hero (full viewport, left text / right phones) ────────────── */}
      <section className="relative flex min-h-[calc(100vh-65px)] flex-col bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto flex w-full max-w-7xl flex-1 items-center px-6 py-10 md:py-16">
          <div className="flex w-full flex-col gap-10 lg:flex-row lg:items-center lg:gap-12">
            {/* Left — text */}
            <div className="flex-1 text-center lg:text-left">
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
                Free on iOS &amp; Android
              </div>
              <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 md:text-5xl lg:text-6xl">
                Book anything<br />
                under <span className="text-brand-600">1 minute</span>
              </h1>
              <p className="mx-auto mt-4 max-w-lg text-base leading-relaxed text-gray-500 md:text-lg lg:mx-0">
                Tell Balkina AI what you need. It finds top-rated services near you, checks real-time availability, and books them — in seconds.
              </p>
              <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start sm:justify-center">
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

            {/* Right — two phones with arrow */}
            <div className="flex shrink-0 items-end gap-3 md:gap-5">
              <ScaledPhone label="You">
                <CustomerPhoneContent />
              </ScaledPhone>

              {/* Arrow — appears after customer confirms */}
              <div className="connect-arrow mb-[220px] flex flex-col items-center gap-1">
                <svg className="h-5 w-5 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <span className="text-[8px] font-medium text-brand-400">Booked!</span>
              </div>

              <ScaledPhone label="Your Pro">
                <StaffPhoneContent />
              </ScaledPhone>
            </div>
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
            <img src="/assets/Balkina_icon_color.png" alt="" className="h-5 w-5" />
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
