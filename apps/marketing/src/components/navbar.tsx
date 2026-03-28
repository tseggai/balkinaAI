'use client';

import { useState } from 'react';
import Link from 'next/link';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-600">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5 text-white" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-7.07-2.83 2.83M9.76 14.24l-2.83 2.83m11.14 0-2.83-2.83M9.76 9.76 6.93 6.93" />
            </svg>
          </div>
          <span className="text-xl font-bold tracking-wide text-gray-900">BALKINA</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/#features" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">Features</Link>
          <Link href="/#how-it-works" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">How It Works</Link>
          <Link href="/pricing" className="text-sm font-medium text-gray-600 hover:text-brand-600 transition-colors">Pricing</Link>
          <div className="h-5 w-px bg-gray-200" />
          <a href="https://app.balkina.ai" className="text-sm font-medium text-gray-700 hover:text-brand-600 transition-colors">Sign In</a>
          <a href="https://app.balkina.ai/register" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors">Get Started Free</a>
        </div>

        {/* Mobile hamburger */}
        <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden rounded-lg p-2 text-gray-600 hover:bg-gray-100" aria-label="Toggle menu">
          {mobileOpen ? (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
          ) : (
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" /></svg>
          )}
        </button>
      </nav>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="border-t border-gray-100 bg-white px-6 pb-6 pt-4 md:hidden">
          <div className="flex flex-col gap-4">
            <Link href="/#features" onClick={() => setMobileOpen(false)} className="text-base font-medium text-gray-700">Features</Link>
            <Link href="/#how-it-works" onClick={() => setMobileOpen(false)} className="text-base font-medium text-gray-700">How It Works</Link>
            <Link href="/pricing" onClick={() => setMobileOpen(false)} className="text-base font-medium text-gray-700">Pricing</Link>
            <hr className="border-gray-100" />
            <a href="https://app.balkina.ai" className="text-base font-medium text-gray-700">Sign In</a>
            <a href="https://app.balkina.ai/register" className="rounded-full bg-brand-600 px-5 py-3 text-center text-base font-semibold text-white">Get Started Free</a>
          </div>
        </div>
      )}
    </header>
  );
}
