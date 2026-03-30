'use client';

import { useState } from 'react';
import Link from 'next/link';

/* ─── Device Frames (devices.css) ──────────────────────────────────────── */

/* Scale factors: phone 0.52x, iPad 0.88x → iPad is ~42px taller than phones */
const PHONE_SCALE = 0.52;
const PHONE_VIS_W = Math.round(428 * PHONE_SCALE); // 222px
const PHONE_VIS_H = Math.round(868 * PHONE_SCALE); // 451px
const PHONE_CONTENT_SCALE = 390 / 260; // screen is 390px, content designed at 260px

const IPAD_SCALE = 0.88;
const IPAD_VIS_W = Math.round(778 * IPAD_SCALE); // 685px
const IPAD_VIS_H = Math.round(560 * IPAD_SCALE); // 493px (42px taller than phone)
const IPAD_CONTENT_SCALE = 724 / 580; // screen is 724px, content designed at 580px

function PhoneDevice({ children }: { children: React.ReactNode }) {
  return (
    <div className="device device-iphone-14-pro">
      <div className="device-frame">
        <div className="device-screen">
          <div style={{
            transform: `scale(${PHONE_CONTENT_SCALE})`,
            transformOrigin: 'top left',
            width: 260,
          }}>
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

function IPadDevice({ children }: { children: React.ReactNode }) {
  return (
    <div className="device device-ipad-landscape">
      <div className="device-frame">
        <div className="device-screen">
          <div style={{
            transform: `scale(${IPAD_CONTENT_SCALE})`,
            transformOrigin: 'top left',
            width: 580,
          }}>
            {children}
          </div>
        </div>
      </div>
      <div className="device-sensors" />
      <div className="device-btns" />
    </div>
  );
}

/* ─── Customer Booking Flow (5 animated screens) ──────────────────────── */

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

function CustomerPhoneContent() {
  return (
      <div className="relative overflow-hidden bg-white" style={{ height: 530 }}>

        {/* ── Intro: Categories ──────────────────────────────────── */}
        <div className="bk-intro absolute inset-0 z-20 flex flex-col bg-white">
          <div className="flex flex-1 flex-col items-center justify-center px-6">
            <img src="/assets/Balkina_icon_color.png" alt="" className="mb-1 h-10 w-10" />
            <p className="mb-1 text-[10px] font-bold tracking-[0.2em] text-brand-600">BALKINA</p>
            <p className="mb-4 text-[10px] text-gray-400">What would you like to book today?</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {[
                'Health & Wellness', 'Beauty & Personal Care',
                'Fitness & Sports', 'Home Services',
                'Professional Services', 'Education & Tutoring',
                'Pet Services', 'Automotive',
              ].map((cat, i) => (
                <div
                  key={i}
                  className={`rounded-full border px-3 py-1.5 text-[8px] ${
                    cat === 'Beauty & Personal Care'
                      ? 'border-brand-300 bg-brand-50 font-medium text-brand-700'
                      : 'border-gray-200 text-gray-600'
                  }`}
                >
                  {cat}
                </div>
              ))}
            </div>
          </div>
          <BottomBar />
        </div>

        {/* ── Chat: Continuous scrolling conversation ─────────────── */}
        <div className="bk-chat absolute inset-0 z-10 flex flex-col">
          <ChatHeader />
          <div className="flex flex-1 flex-col justify-end overflow-hidden px-3">
              {/* 1. User selects category */}
              <div className="chat-msg-1 flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-md bg-brand-500 px-2.5 py-2 text-[9px] text-white">
                  Find Beauty &amp; Personal Care businesses near me
                </div>
              </div>

              {/* 2. AI responds with businesses */}
              <div className="chat-msg-2 max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[9px] text-gray-700">
                Here are some Beauty &amp; Personal Care businesses near you:
              </div>

              {/* 3. Business cards */}
              <div className="chat-msg-3 flex gap-1.5">
                {[
                  { name: 'Dan the Barber', rating: '5', reviews: '9', dist: '0.3 mi', drive: '1 min drive', gradient: 'from-amber-200 via-orange-100 to-yellow-50', selected: true },
                  { name: 'Radiant Spa', rating: '4.9', reviews: '15', dist: '1.9 mi', drive: '5 min drive', gradient: 'from-emerald-200 via-teal-100 to-cyan-50' },
                ].map((biz, i) => (
                  <div key={i} className={`w-[130px] shrink-0 overflow-hidden rounded-xl border ${biz.selected ? 'border-brand-300' : 'border-gray-100'}`}>
                    <div className={`h-16 bg-gradient-to-br ${biz.gradient}`} />
                    <div className="p-1.5">
                      <p className="text-[9px] font-bold text-gray-900">{biz.name}</p>
                      <div className="flex items-center gap-0.5">
                        <span className="text-[8px] text-amber-500">&#9733;&#9733;&#9733;&#9733;&#9733;</span>
                        <span className="text-[8px] text-gray-400">{biz.rating} ({biz.reviews})</span>
                      </div>
                      <p className="text-[8px] text-gray-400">{biz.dist} &middot; {biz.drive}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* 4. Service cards */}
              <div className="chat-msg-4 flex gap-1.5">
                {[
                  { name: 'Beard trimming', price: '$25', sub: '20 min' },
                  { name: 'Hair Color', price: '$30', sub: '50% deposit', selected: true },
                ].map((svc, i) => (
                  <div key={i} className={`flex-1 rounded-xl border p-2 ${svc.selected ? 'border-brand-300 bg-brand-50' : 'border-gray-200'}`}>
                    <p className={`text-[9px] font-semibold ${svc.selected ? 'text-brand-700' : 'text-gray-800'}`}>{svc.name}</p>
                    <div className="flex items-baseline gap-1">
                      <span className={`text-[9px] font-bold ${svc.selected ? 'text-brand-600' : 'text-gray-600'}`}>{svc.price}</span>
                      <span className="text-[7px] text-gray-400">{svc.sub}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* 5. User selects service */}
              <div className="chat-msg-5 flex justify-end">
                <div className="rounded-2xl rounded-tr-md bg-brand-500 px-2.5 py-2 text-[9px] text-white">
                  Hair Color at Dan the Barber
                </div>
              </div>

              {/* 6. AI asks when + date options */}
              <div className="chat-msg-6">
                <div className="mb-2 max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[9px] text-gray-700">
                  When would you like your appointment?
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {['Today', 'Tomorrow', 'Next Week', 'Pick a date'].map((d) => (
                    <div key={d} className={`rounded-full border px-3 py-1.5 text-[8px] ${d === 'Tomorrow' ? 'border-brand-400 bg-brand-50 font-medium text-brand-700' : 'border-gray-200 text-gray-600'}`}>
                      {d}
                    </div>
                  ))}
                </div>
              </div>

              {/* 7. User picks Tomorrow */}
              <div className="chat-msg-7 flex justify-end">
                <div className="rounded-2xl rounded-tr-md bg-brand-500 px-2.5 py-2 text-[9px] text-white">
                  Tomorrow
                </div>
              </div>

              {/* 8. AI shows staff */}
              <div className="chat-msg-8">
                <div className="mb-2 max-w-[85%] rounded-2xl rounded-tl-md bg-gray-100 px-2.5 py-2 text-[9px] text-gray-700">
                  Here are the available staff and time slots:
                </div>
                <div className="mb-2 flex items-center gap-2">
                  <div className="h-9 w-9 shrink-0 rounded-full bg-gradient-to-br from-sky-300 via-blue-200 to-indigo-100" />
                  <div>
                    <p className="text-[9px] font-bold text-gray-900">Dragana Djurica</p>
                    <p className="text-[8px] text-gray-400">15 slots</p>
                  </div>
                </div>
              </div>

              {/* 9. Time slots */}
              <div className="chat-msg-9 grid grid-cols-3 gap-1">
                {['9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM', '12:00 PM', '12:30 PM', '1:00 PM'].map((time) => (
                  <div key={time} className={`rounded-lg border py-1.5 text-center text-[8px] font-medium ${time === '9:00 AM' ? 'border-brand-400 bg-brand-600 text-white' : 'border-gray-200 text-gray-600'}`}>
                    {time}
                  </div>
                ))}
              </div>
          </div>
          <BottomBar />
        </div>

        {/* ── Confirmation: Full screen ───────────────────────────── */}
        <div className="bk-confirm absolute inset-0 z-30 flex flex-col items-center justify-center bg-gray-50 px-4">
          {/* Green check */}
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green-500">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="mb-1 text-[11px] font-bold text-gray-900">Appointment Confirmed</p>
          <p className="mb-4 text-center text-[8px] text-gray-500">
            Your booking with Dragana Djurica is confirmed.
            <br />You&apos;ll receive a notification shortly.
          </p>
          {/* Summary card */}
          <div className="w-full rounded-xl border border-gray-200 bg-white p-3">
            <div className="space-y-1.5">
              {[
                { l: 'Service', v: 'Hair Color' },
                { l: 'Business', v: 'Dan the Barber' },
                { l: 'Staff', v: 'Dragana Djurica' },
                { l: 'Date', v: 'Sunday, March 29, 2026' },
                { l: 'Time', v: '9:00 AM' },
              ].map((row) => (
                <div key={row.l} className="flex justify-between text-[8px]">
                  <span className="text-gray-400">{row.l}</span>
                  <span className="font-semibold text-gray-800">{row.v}</span>
                </div>
              ))}
              <div className="border-t border-gray-100 pt-1.5">
                <div className="flex justify-between text-[8px]">
                  <span className="text-gray-400">Total</span>
                  <span className="font-bold text-gray-900">$30.00</span>
                </div>
                <div className="flex justify-between text-[8px]">
                  <span className="text-gray-400">Deposit</span>
                  <span className="font-bold text-red-500">$15.00 (Due)</span>
                </div>
              </div>
            </div>
          </div>
          {/* Buttons */}
          <div className="mt-3 w-full space-y-1.5">
            <div className="w-full rounded-xl bg-brand-600 py-2 text-center text-[9px] font-semibold text-white">Done</div>
            <div className="w-full rounded-xl border border-brand-300 py-2 text-center text-[9px] font-semibold text-brand-600">Get Directions</div>
          </div>
        </div>

      </div>
  );
}

/* ─── Staff Notification Content ───────────────────────────────────────── */

function StaffPhoneContent() {
  return (
      <div className="px-3 pb-4 pt-3" style={{ minHeight: 530 }}>
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
  );
}

/* ─── Dashboard Content (iPad Landscape) ───────────────────────────────── */

function DashboardContent() {
  return (
      <div className="flex h-full">
        {/* Sidebar nav */}
        <div className="w-[100px] shrink-0 border-r border-gray-100 bg-gray-50/50 px-2 pt-4 pb-2">
          <div className="flex items-center gap-1.5 mb-4 px-1">
            <img src="/assets/Balkina_icon_color.png" alt="" className="h-4 w-4" />
            <span className="text-[9px] font-bold text-gray-800">Balkina</span>
          </div>
          {[
            { name: 'Dashboard', active: true },
            { name: 'Appointments' },
            { name: 'Services' },
            { name: 'Staff' },
            { name: 'Customers' },
            { name: 'Analytics' },
            { name: 'Settings' },
          ].map((item) => (
            <div
              key={item.name}
              className={`mb-0.5 rounded-md px-2 py-1.5 text-[9px] ${
                item.active
                  ? 'bg-brand-100 font-semibold text-brand-700'
                  : 'text-gray-500'
              }`}
            >
              {item.name}
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-4 pt-4">
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
                { time: '11:00 AM', name: 'Alex R.', svc: 'Yin & Restore', staff: 'Priya S.', status: 'Confirmed', sc: 'bg-green-100 text-green-700' },
                { time: '12:30 PM', name: 'Mia T.', svc: 'Power Yoga', staff: 'Luna R.', status: 'Confirmed', sc: 'bg-green-100 text-green-700' },
              ].map((apt, i) => (
                <div key={i} className={`grid grid-cols-5 gap-1 px-2 py-1.5 text-[9px] ${i < 4 ? 'border-b border-gray-50' : ''} ${i === 2 ? 'animate-fade-in-6 bg-green-50/50' : ''}`}>
                  <span className="text-gray-500">{apt.time}</span>
                  <span className="font-medium text-gray-800">{apt.name}</span>
                  <span className="text-gray-600">{apt.svc}</span>
                  <span className="text-gray-500">{apt.staff}</span>
                  <span className={`inline-block w-fit rounded-full px-1.5 py-0.5 text-[7px] font-semibold ${apt.sc}`}>{apt.status}</span>
                </div>
              ))}
              <div className="animate-fade-in-7 grid grid-cols-5 gap-1 border-t border-brand-100 bg-brand-50/50 px-2 py-1.5 text-[9px]">
                <span className="text-gray-500">2:00 PM</span>
                <span className="font-medium text-brand-700">New booking!</span>
                <span className="text-gray-600">Gentle Yoga</span>
                <span className="text-gray-500">Raj K.</span>
                <span className="inline-block w-fit rounded-full bg-amber-100 px-1.5 py-0.5 text-[7px] font-semibold text-amber-700">Pending</span>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
}

/* ─── Feature Grid ──────────────────────────────────────────────────────── */

const FEATURE_ICONS = [
  <svg key="loc" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  <svg key="svc" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  <svg key="staff" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  <svg key="role" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" /></svg>,
  <svg key="cust" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" /></svg>,
  <svg key="addon" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.4.604-.4.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.96.401v0a.656.656 0 00.657-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" /></svg>,
  <svg key="pkg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" /></svg>,
  <svg key="inv" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M20.25 7.5l-.625 10.632a2.25 2.25 0 01-2.247 2.118H6.622a2.25 2.25 0 01-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125z" /></svg>,
  <svg key="coupon" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>,
  <svg key="loyalty" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" /></svg>,
  <svg key="bill" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
  <svg key="chart" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  <svg key="bell" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
  <svg key="star" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>,
];

const FEATURES = [
  { title: 'Location Management', desc: 'Manage multiple branches with separate staff, services, and schedules from one dashboard.' },
  { title: 'Service Management', desc: 'Set prices, durations, buffer times, booking limits, visibility, and custom timesheets per service.' },
  { title: 'Staff Management', desc: 'Individual schedules, day-offs, service assignments, and multi-location support for your team.' },
  { title: 'Role Management', desc: 'Define admin, manager, and staff roles with granular permissions for every part of your business.' },
  { title: 'Customer Management', desc: 'Full customer profiles, booking history, behavior tracking, and communication preferences.' },
  { title: 'Service Add-ons', desc: 'Let customers customize bookings with optional extras — each with its own price and duration.' },
  { title: 'Service Packages', desc: 'Bundle multiple services into packages with combined pricing and streamlined booking.' },
  { title: 'Inventory Management', desc: 'Track product stock, link items to services, and get alerts when inventory runs low.' },
  { title: 'Coupons Management', desc: 'Create discount codes with usage limits, expiration dates, and percentage or fixed amounts.' },
  { title: 'Loyalty Programs', desc: 'Reward repeat customers with points, tiers, and automated perks that drive retention.' },
  { title: 'Billing Management', desc: 'Deposits, full payments, and invoicing via Stripe. Apple Pay, Google Pay, and cards supported.' },
  { title: 'Analytics & CRM', desc: 'Track revenue, bookings, reviews, and customer history. Know your business inside out.' },
  { title: 'Smart Reminders', desc: 'Automated email, SMS, and push confirmations, reminders, and AI-powered rebooking nudges.' },
  { title: 'Reviews & Ratings', desc: 'Collect customer reviews automatically. Your rating helps you rank higher in AI search.' },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function HomePage() {
  const [showAllFeatures, setShowAllFeatures] = useState(false);

  return (
    <>
      {/* ─── Hero (full viewport, visual-first) ──────────────────────────── */}
      <section className="relative flex min-h-[calc(100vh-73px)] flex-col bg-gradient-to-b from-gray-50 to-white">
        <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col px-6 pt-10 md:pt-14">
          {/* Minimal headline */}
          <div className="text-center">
            <h1 className="text-3xl font-extrabold tracking-tight text-gray-900 md:text-4xl lg:text-5xl">
              Let AI book you while you work
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-base text-gray-500 md:text-lg">
              Automated front desk for salons, clinics, studios, and beyond.
            </p>
          </div>

          {/* Mobile: phones only, stacked */}
          <div className="mt-10 flex flex-1 flex-col items-center justify-center gap-8 pb-8 lg:hidden">
            <div style={{ width: PHONE_VIS_W, height: PHONE_VIS_H, position: 'relative' }}>
              <div style={{ transform: `scale(${PHONE_SCALE})`, transformOrigin: 'bottom left', position: 'absolute', bottom: 0, left: 0 }}>
                <PhoneDevice><CustomerPhoneContent /></PhoneDevice>
              </div>
            </div>
            <div style={{ width: PHONE_VIS_W, height: PHONE_VIS_H, position: 'relative' }}>
              <div style={{ transform: `scale(${PHONE_SCALE})`, transformOrigin: 'bottom left', position: 'absolute', bottom: 0, left: 0 }}>
                <PhoneDevice><StaffPhoneContent /></PhoneDevice>
              </div>
            </div>
          </div>

          {/* Desktop: 3 devices — phones aligned bottom, iPad 42px taller, staff overlaps iPad */}
          <div className="relative mt-10 hidden flex-1 items-end justify-center pb-8 lg:flex">
            {/* Customer phone — left, gap from iPad */}
            <div className="flex flex-col items-center" style={{ zIndex: 10 }}>
              <div style={{ width: PHONE_VIS_W, height: PHONE_VIS_H, position: 'relative' }}>
                <div style={{ transform: `scale(${PHONE_SCALE})`, transformOrigin: 'bottom left', position: 'absolute', bottom: 0, left: 0 }}>
                  <PhoneDevice><CustomerPhoneContent /></PhoneDevice>
                </div>
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Your Customers</p>
            </div>

            {/* Dashboard iPad — center, 42px taller */}
            <div className="flex flex-col items-center" style={{ zIndex: 0, marginLeft: 24 }}>
              <div style={{ width: IPAD_VIS_W, height: IPAD_VIS_H, position: 'relative' }}>
                <div style={{ transform: `scale(${IPAD_SCALE})`, transformOrigin: 'bottom left', position: 'absolute', bottom: 0, left: 0 }}>
                  <IPadDevice><DashboardContent /></IPadDevice>
                </div>
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Your Dashboard</p>
            </div>

            {/* Staff phone — right, overlapping iPad */}
            <div className="flex flex-col items-center" style={{ zIndex: 10, marginLeft: -70 }}>
              <div style={{ width: PHONE_VIS_W, height: PHONE_VIS_H, position: 'relative' }}>
                <div style={{ transform: `scale(${PHONE_SCALE})`, transformOrigin: 'bottom left', position: 'absolute', bottom: 0, left: 0 }}>
                  <PhoneDevice><StaffPhoneContent /></PhoneDevice>
                </div>
              </div>
              <p className="mt-4 text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-400">Your Staff</p>
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
      <section id="features" className="section-animate py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">One platform. Every tool you need.</h2>
            <p className="mt-4 text-lg text-gray-500">Manage your entire booking operation from a single dashboard.</p>
          </div>
          <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {FEATURES.map((f, i) => (
              <div key={i} className="group rounded-2xl border border-gray-100 bg-white p-6 transition-all hover:border-brand-200 hover:shadow-lg hover:shadow-brand-100/40">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                  {FEATURE_ICONS[i]}
                </div>
                <h3 className="mt-3 text-base font-semibold text-gray-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-gray-500">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Social Proof / Numbers ───────────────────────────────────────── */}
      <section className="section-animate border-y border-gray-100 bg-gray-50 py-16">
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
      <section id="pricing" className="section-animate py-24 md:py-32">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Simple pricing, no surprises</h2>
            <p className="mt-4 text-lg text-gray-500">Start free. Upgrade as you grow. All paid plans include a 7-day free trial.</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              { name: 'Solo', price: '0', desc: 'For individuals getting started', staff: '1 staff', locations: '1 location', bookings: '20/month', trial: false, features: ['AI chatbot', 'Staff app', 'Smart reminders', 'SMS notifications', 'Reviews & ratings', 'Basic analytics'] },
              { name: 'Solo Pro', price: '19', desc: 'For serious solo professionals', staff: '1 staff', locations: '1 location', bookings: 'Unlimited', trial: true, features: ['Everything in Solo', 'Unlimited bookings', 'Full service management', 'Service add-ons', 'Coupons'] },
              { name: 'Team', price: '49', desc: 'For small teams', staff: 'Up to 5 staff', locations: '2 locations', bookings: 'Unlimited', popular: true, trial: true, extra: '+\u20AC6/additional staff', features: ['Everything in Solo Pro', 'Service packages', 'Staff management', 'Advanced analytics'] },
              { name: 'Scale', price: '99', desc: 'For growing businesses', staff: 'Up to 15 staff', locations: '5 locations', bookings: 'Unlimited', trial: true, extra: '+\u20AC6/additional staff', features: ['Everything in Team', 'Role management', 'Loyalty programs', 'Inventory management', 'Dedicated support'] },
            ].map((plan, i) => (
              <div key={i} className={`relative flex flex-col rounded-2xl border p-6 ${plan.popular ? 'border-brand-600 bg-white shadow-xl shadow-brand-100/50' : 'border-gray-200 bg-white'}`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-brand-600 px-4 py-1 text-[10px] font-semibold text-white">Most Popular</div>
                )}
                <h3 className="text-lg font-semibold text-gray-900">{plan.name}</h3>
                <p className="mt-0.5 text-sm text-gray-500">{plan.desc}</p>
                <div className="mt-4">
                  <span className="text-3xl font-extrabold text-gray-900">&euro;{plan.price}</span>
                  <span className="text-sm text-gray-500">/mo</span>
                </div>
                {plan.trial && <p className="mt-1 text-[11px] text-brand-600">7-day free trial</p>}
                <div className="mt-4 space-y-1 rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
                  <p>{plan.staff} &middot; {plan.locations}</p>
                  <p>{plan.bookings} bookings</p>
                  {plan.extra && <p className="text-brand-600">{plan.extra}</p>}
                </div>
                <ul className="mt-4 flex-1 space-y-2">
                  {plan.features.map((f, fi) => (
                    <li key={fi} className="flex items-start gap-2 text-sm text-gray-600">
                      <svg className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                      {f}
                    </li>
                  ))}
                </ul>
                <a href="https://app.balkina.ai/register" className={`mt-6 block rounded-full py-2.5 text-center text-sm font-semibold transition-colors ${plan.popular ? 'bg-brand-600 text-white hover:bg-brand-700' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`}>
                  {plan.price === '0' ? 'Start for Free' : 'Start Free Trial'}
                </a>
              </div>
            ))}
          </div>

          {/* Online Payments add-on */}
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-gray-200 bg-white p-5">
            <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900">Online Payments</p>
                  <p className="text-xs text-gray-500">Accept deposits and payments via Stripe. Available where Stripe is supported.</p>
                </div>
              </div>
              <p className="shrink-0 text-lg font-bold text-gray-900">+&euro;14<span className="text-sm font-normal text-gray-500">/mo</span></p>
            </div>
          </div>

          {/* View all features toggle */}
          <div className="mt-8 text-center">
            <button onClick={() => setShowAllFeatures(!showAllFeatures)} className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
              {showAllFeatures ? 'Show less' : 'View all features'} {showAllFeatures ? '\u2191' : '\u2193'}
            </button>
          </div>

          {showAllFeatures && (
            <div className="mt-10 mx-auto max-w-5xl rounded-2xl border border-gray-100 bg-white p-6 md:p-8">
              <h3 className="mb-6 text-center text-lg font-semibold text-gray-900">Full Feature Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="pb-4 pr-4 font-medium text-gray-500" style={{ minWidth: 200 }}>Feature</th>
                      <th className="pb-4 text-center font-medium text-gray-500" style={{ minWidth: 90 }}><div>Solo</div><div className="text-xs font-normal text-gray-400">&euro;0/mo</div></th>
                      <th className="pb-4 text-center font-medium text-gray-500" style={{ minWidth: 90 }}><div>Solo Pro</div><div className="text-xs font-normal text-gray-400">&euro;19/mo</div></th>
                      <th className="pb-4 text-center font-semibold text-brand-700" style={{ minWidth: 90 }}><div className="rounded-t-lg bg-brand-50 px-2 py-1.5 -mx-2">Team<div className="text-xs font-normal text-brand-500">&euro;49/mo</div></div></th>
                      <th className="pb-4 text-center font-medium text-gray-500" style={{ minWidth: 90 }}><div>Scale</div><div className="text-xs font-normal text-gray-400">&euro;99/mo</div></th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { f: 'AI Chatbot', d: 'Customers discover and book you through conversational AI', fr: true, g: true, b: true, s: true },
                      { f: 'Staff App', d: 'Your team manages bookings and notifications on mobile', fr: true, g: true, b: true, s: true },
                      { f: 'Smart Reminders', d: 'Automated email, SMS, and push for confirmations and follow-ups', fr: true, g: true, b: true, s: true },
                      { f: 'SMS Notifications', d: 'Text message alerts for bookings, cancellations, and updates', fr: true, g: true, b: true, s: true },
                      { f: 'Reviews & Ratings', d: 'Collect feedback automatically after each appointment', fr: true, g: true, b: true, s: true },
                      { f: 'Analytics', d: 'Track bookings, revenue, and customer trends', fr: 'Basic', g: 'Basic', b: 'Advanced', s: 'Advanced' },
                      { f: 'Bookings', d: 'Number of appointments per month', fr: '20/mo', g: 'Unlimited', b: 'Unlimited', s: 'Unlimited' },
                      { f: 'Staff Members', d: 'Team members who can receive bookings', fr: '1', g: '1', b: '5 (+\u20AC6)', s: '15 (+\u20AC6)' },
                      { f: 'Locations', d: 'Physical branches or addresses', fr: '1', g: '1', b: '2', s: '5' },
                      { f: 'Service Management', d: 'Configure pricing, duration, buffer times, and booking rules', fr: 'Basic', g: 'Full', b: 'Full', s: 'Full' },
                      { f: 'Service Add-ons', d: 'Optional extras customers can add to any booking', fr: false, g: true, b: true, s: true },
                      { f: 'Coupons', d: 'Discount codes with usage limits and expiration dates', fr: false, g: true, b: true, s: true },
                      { f: 'Service Packages', d: 'Bundle multiple services with combined pricing', fr: false, g: false, b: true, s: true },
                      { f: 'Staff Management', d: 'Schedules, day-offs, and service assignments per staff', fr: false, g: false, b: true, s: true },
                      { f: 'Role Management', d: 'Admin, manager, and staff roles with granular permissions', fr: false, g: false, b: false, s: true },
                      { f: 'Loyalty Programs', d: 'Reward repeat customers with points and automated perks', fr: false, g: false, b: false, s: true },
                      { f: 'Inventory Management', d: 'Track product stock and link items to services', fr: false, g: false, b: false, s: true },
                      { f: 'Online Payments', d: 'Accept deposits and payments via Stripe (where supported)', fr: '+\u20AC14', g: '+\u20AC14', b: '+\u20AC14', s: '+\u20AC14' },
                    ].map((row) => (
                      <tr key={row.f} className="border-b border-gray-50">
                        <td className="py-3 pr-4">
                          <p className="font-medium text-gray-700">{row.f}</p>
                          <p className="mt-0.5 text-xs text-gray-400">{row.d}</p>
                        </td>
                        {[row.fr, row.g, row.b, row.s].map((v, vi) => (
                          <td key={vi} className={`py-3 text-center ${vi === 2 ? 'bg-brand-50/50' : ''}`}>
                            {v === true ? (
                              <svg className="mx-auto h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            ) : v === false ? (
                              <span className="text-gray-300">&mdash;</span>
                            ) : (
                              <span className="text-xs font-medium text-gray-600">{v}</span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* ─── CTA ──────────────────────────────────────────────────────────── */}
      <section className="section-animate bg-brand-600 py-20 md:py-24">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-4xl">Let AI fill your calendar</h2>
          <p className="mt-4 text-lg text-brand-100">Join barbershops, yoga studios, salons, and clinics already using Balkina AI.</p>
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a href="https://app.balkina.ai/register" className="rounded-full bg-white px-8 py-3.5 text-base font-semibold text-brand-600 shadow-lg hover:bg-gray-50 transition-colors">
              Get Started Free
            </a>
          </div>
          <p className="mt-4 text-sm text-brand-200">Free 14-day trial. No credit card required.</p>
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
