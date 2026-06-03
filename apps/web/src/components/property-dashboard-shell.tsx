'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard', icon: '📊' },
  { key: 'tenants', label: 'Tenants', icon: '🏢' },
  { key: 'messages', label: 'Messages', icon: '✉️' },
  { key: 'branding', label: 'Branding', icon: '🎨' },
  { key: 'team', label: 'Team', icon: '👥' },
  { key: 'settings', label: 'Settings', icon: '⚙️' },
];

export function PropertyDashboardShell({
  propertyName,
  logoUrl,
  primaryColor,
  children,
  activeTab,
  onTabChange,
}: {
  propertyName: string;
  logoUrl?: string | null;
  primaryColor?: string;
  children: React.ReactNode;
  activeTab?: string;
  onTabChange?: (tab: string) => void;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const color = primaryColor || '#6B7FC4';

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-30 w-64 transform border-r border-gray-200 bg-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 lg:self-start ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="flex h-16 items-center gap-3 border-b border-gray-200 px-5">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-8 w-8 rounded-lg object-cover" />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: color }}>
              {propertyName.charAt(0)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-gray-900 truncate">{propertyName}</p>
            <p className="text-xs text-gray-400">Property Admin</p>
          </div>
        </div>

        <nav className="mt-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => { onTabChange?.(item.key); setMobileMenuOpen(false); }}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                activeTab === item.key
                  ? 'bg-brand-50 text-brand-700'
                  : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
              }`}
            >
              <span className="text-base">{item.icon}</span>
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-4">
          <button
            onClick={() => createClient().auth.signOut().then(() => window.location.href = '/auth/login')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <span>🚪</span> Sign Out
          </button>
          <p className="mt-2 text-center text-xs text-gray-300">Powered by Balkina AI</p>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-20 bg-black/30 lg:hidden" onClick={() => setMobileMenuOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-6 lg:hidden">
          <button onClick={() => setMobileMenuOpen(true)} className="text-gray-600">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <p className="text-sm font-bold text-gray-900">{propertyName}</p>
          <div className="w-6" />
        </header>

        <main className="p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
