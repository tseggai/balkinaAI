'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function AudienceToggle() {
  const pathname = usePathname();
  const isCustomers = pathname === '/app';

  return (
    <div className="flex justify-center">
      <div className="inline-flex rounded-full bg-gray-100 p-1">
        <Link
          href="/"
          className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
            !isCustomers
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          For Businesses
        </Link>
        <Link
          href="/app"
          className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
            isCustomers
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          For Customers
        </Link>
      </div>
    </div>
  );
}
