'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Logo — 30% smaller on mobile */}
        <Link href="/" className="flex items-center">
          <Image src="/assets/Balkina_logo_color.png" alt="Balkina" width={130} height={36} className="h-5 w-auto md:h-8" priority />
        </Link>

        {/* Desktop nav — right actions */}
        <div className="hidden items-center gap-3 md:flex">
          <a href="https://app.balkina.ai/auth/login" className="rounded-full px-5 py-2.5 text-sm font-medium text-gray-700 hover:text-brand-600 transition-colors">Sign In</a>
          <a href="https://app.balkina.ai/auth/register" className="rounded-full bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors">Start Free Trial</a>
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
            <a href="https://app.balkina.ai/auth/login" className="text-base font-medium text-gray-700">Sign In</a>
            <a href="https://app.balkina.ai/auth/register" className="rounded-full bg-brand-600 px-5 py-3 text-center text-base font-semibold text-white">Start Free Trial</a>
          </div>
        </div>
      )}
    </header>
  );
}
