'use client';

import { useEffect, useState } from 'react';
import { Sidebar } from '@/components/sidebar';

const STORAGE_KEY = 'admin.sidebar.collapsed';

/**
 * Responsive dashboard frame: off-canvas drawer with a top bar on small
 * screens, collapsible icon rail on desktop (remembered per browser).
 */
export function DashboardShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try { setCollapsed(window.localStorage.getItem(STORAGE_KEY) === '1'); } catch { /* ignore */ }
  }, []);

  const toggleCollapse = () => {
    setCollapsed((c) => {
      try { window.localStorage.setItem(STORAGE_KEY, c ? '0' : '1'); } catch { /* ignore */ }
      return !c;
    });
  };

  // Close the drawer on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mobileOpen]);

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 z-30 bg-black/40 md:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar: drawer on mobile, static on desktop */}
      <div
        className={`fixed inset-y-0 left-0 z-40 overflow-hidden transition-transform duration-200 md:static md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <Sidebar
          collapsed={collapsed && !mobileOpen}
          onToggleCollapse={toggleCollapse}
          onNavigate={() => setMobileOpen(false)}
          onClose={() => setMobileOpen(false)}
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile top bar */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 md:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="rounded-lg p-1.5 text-gray-600 hover:bg-gray-100">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
            </svg>
          </button>
          <img src="/assets/Balkina_logo_color.png" alt="Balkina AI" className="h-6 w-auto" />
          <span className="rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] font-semibold text-red-700">ADMIN</span>
        </header>

        <main className="min-w-0 flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
