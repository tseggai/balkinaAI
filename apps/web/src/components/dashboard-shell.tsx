'use client';

import { useState, useCallback } from 'react';
import { Sidebar } from '@/components/sidebar';

/**
 * Client wrapper around the dashboard layout that manages mobile sidebar
 * open/close state. On desktop (md+), the sidebar is always visible. On
 * mobile, it starts hidden and slides in as an overlay when the hamburger
 * button is tapped.
 */
export function DashboardShell({
  tenantName,
  planName,
  children,
}: {
  tenantName: string;
  planName: string;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const closeSidebar = useCallback(() => setSidebarOpen(false), []);

  return (
    <div className="flex h-[100dvh] bg-gray-50">
      {/* Backdrop overlay — mobile only */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar — slides in on mobile, always visible on md+ */}
      <div
        className={`
          fixed inset-y-0 left-0 z-50 w-64 transform bg-white transition-transform duration-200 ease-in-out
          md:relative md:z-auto md:translate-x-0
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
      >
        <Sidebar
          tenantName={tenantName}
          planName={planName}
          onNavigate={closeSidebar}
        />
      </div>

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar — visible below md */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Open menu"
          >
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <img src="/assets/Balkina_logo_color.png" alt="Balkina AI" className="h-6 w-auto" />
        </header>

        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
