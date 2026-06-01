'use client';

import { createClient } from '@/lib/supabase/client';

export function PropertyDashboardShell({
  propertyName,
  children,
}: {
  propertyName: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-500 text-sm font-bold text-white">
              {propertyName.charAt(0)}
            </div>
            <h1 className="text-lg font-bold text-gray-900">{propertyName}</h1>
            <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-600">Property</span>
          </div>
          <button
            onClick={() => createClient().auth.signOut().then(() => window.location.href = '/auth/login')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Sign Out
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-6 py-8">
        {children}
      </main>
    </div>
  );
}
