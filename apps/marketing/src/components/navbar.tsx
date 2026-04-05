'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';

export function Navbar() {
  const pathname = usePathname();
  const isCustomers = pathname === '/app';

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-lg">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-3">
        {/* Logo + Beta badge — logo 30% smaller on mobile */}
        <Link href="/" className="flex items-center gap-2">
          <Image src="/assets/Balkina_logo_color.png" alt="Balkina" width={130} height={36} className="h-5 w-auto md:h-8" priority />
          <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">BETA</span>
        </Link>

        {/* Right actions — shown on all screen sizes for businesses, hidden for customers */}
        {!isCustomers && (
          <div className="flex items-center gap-2 md:gap-3">
            <a href="https://app.balkina.ai/auth/login" className="rounded-full px-3 py-2 text-xs font-medium text-gray-700 hover:text-brand-600 transition-colors md:px-5 md:py-2.5 md:text-sm">Sign In</a>
            <Link href="/join" className="rounded-full bg-brand-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-brand-700 transition-colors md:px-5 md:py-2.5 md:text-sm">Join the Beta</Link>
          </div>
        )}
      </nav>
    </header>
  );
}
