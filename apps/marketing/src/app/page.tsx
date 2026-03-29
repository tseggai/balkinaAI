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
        <div className="h-4 w-4 rounded-full bg-brand-600" />
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
            <div className="mb-1 h-10 w-10 rounded-full bg-brand-600" />
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
            <div className="h-4 w-4 rounded-full bg-brand-600" />
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
  <svg key="svc" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" /></svg>,
  <svg key="staff" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" /></svg>,
  <svg key="loc" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>,
  <svg key="pay" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>,
  <svg key="coupon" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M16.5 6v.75m0 3v.75m0 3v.75m0 3V18m-9-5.25h5.25M7.5 15h3M3.375 5.25c-.621 0-1.125.504-1.125 1.125v3.026a2.999 2.999 0 010 5.198v3.026c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-3.026a2.999 2.999 0 010-5.198V6.375c0-.621-.504-1.125-1.125-1.125H3.375z" /></svg>,
  <svg key="chart" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" /></svg>,
  <svg key="bell" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" /></svg>,
  <svg key="star" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" /></svg>,
];

const FEATURES = [
  { title: 'Service Management', desc: 'Set prices, durations, deposits, extras, buffer times, and booking limits for every service.' },
  { title: 'Staff Scheduling', desc: 'Individual schedules, day-offs, service assignments, and multi-location support for your team.' },
  { title: 'Multi-Location', desc: 'Manage multiple branches with separate staff, services, and schedules from one dashboard.' },
  { title: 'Deposit Payments', desc: 'Collect deposits at booking via Stripe. Apple Pay, Google Pay, and cards supported.' },
  { title: 'Coupons & Promotions', desc: 'Create discount codes with usage limits, expiration dates, and percentage or fixed amounts.' },
  { title: 'Analytics & CRM', desc: 'Track revenue, bookings, reviews, and customer history. Know your business inside out.' },
  { title: 'Smart Reminders', desc: 'Automated email and push confirmations, reminders, and AI-powered rebooking nudges.' },
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
              Your business, booked by AI
            </h1>
            <p className="mx-auto mt-3 max-w-2xl text-base text-gray-500 md:text-lg">
              Customers find you, book you, and pay you — all through a single chat. You just do what you do best.
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
            <h2 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">Everything you need, nothing you don&apos;t</h2>
            <p className="mt-4 text-lg text-gray-500">A complete booking platform built for service businesses.</p>
          </div>
          <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
            <button onClick={() => setShowAllFeatures(!showAllFeatures)} className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors">
              {showAllFeatures ? 'Show less' : 'View all features'} {showAllFeatures ? '\u2191' : '\u2193'}
            </button>
          </div>

          {showAllFeatures && (
            <div className="mt-10 mx-auto max-w-4xl rounded-2xl border border-gray-100 bg-white p-8">
              <h3 className="mb-6 text-center text-lg font-semibold text-gray-900">Full Feature Comparison</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="pb-3 font-medium text-gray-500">Feature</th>
                      <th className="pb-3 text-center font-medium text-gray-500">Starter</th>
                      <th className="pb-3 text-center font-medium text-brand-600">Pro</th>
                      <th className="pb-3 text-center font-medium text-gray-500">Enterprise</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {[
                      { f: 'AI Booking Chatbot', s: true, p: true, e: true },
                      { f: 'Staff Members', s: '1', p: '10', e: 'Unlimited' },
                      { f: 'Locations', s: '1', p: '3', e: 'Unlimited' },
                      { f: 'Email Notifications', s: true, p: true, e: true },
                      { f: 'SMS Notifications', s: false, p: true, e: true },
                      { f: 'Deposit Payments', s: false, p: true, e: true },
                      { f: 'Coupons & Promotions', s: false, p: true, e: true },
                      { f: 'Analytics & CRM', s: 'Basic', p: 'Advanced', e: 'Advanced' },
                      { f: 'Custom Branding', s: false, p: false, e: true },
                      { f: 'API Access', s: false, p: false, e: true },
                      { f: 'Priority Support', s: false, p: true, e: true },
                      { f: 'Dedicated Account Manager', s: false, p: false, e: true },
                    ].map((row) => (
                      <tr key={row.f}>
                        <td className="py-2.5 text-gray-700">{row.f}</td>
                        {[row.s, row.p, row.e].map((v, vi) => (
                          <td key={vi} className="py-2.5 text-center">
                            {v === true ? (
                              <svg className="mx-auto h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                            ) : v === false ? (
                              <span className="text-gray-300">&mdash;</span>
                            ) : (
                              <span className="text-gray-600">{v}</span>
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
