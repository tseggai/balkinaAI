'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

function Svg({ active, d }: { active?: boolean; d: string }) {
  return (
    <svg className={`h-5 w-5 ${active ? 'text-brand-600' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      {d.split('|').map((p, i) => (
        <path key={i} strokeLinecap="round" strokeLinejoin="round" d={p} />
      ))}
    </svg>
  );
}

const ICONS: Record<string, string> = {
  dashboard: 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z',
  tenants: 'M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21',
  campaigns: 'M10.34 15.84c-.688-.06-1.386-.09-2.09-.09H7.5a4.5 4.5 0 1 1 0-9h.75c.704 0 1.402-.03 2.09-.09m0 9.18c.253.962.584 1.892.985 2.783.247.55.06 1.21-.463 1.511l-.657.38c-.551.318-1.26.117-1.527-.461a20.845 20.845 0 0 1-1.44-4.282m3.102.069a18.03 18.03 0 0 1-.59-4.59c0-1.586.205-3.124.59-4.59m0 9.18a23.848 23.848 0 0 1 8.835 2.535M10.34 6.66a23.847 23.847 0 0 0 8.835-2.535m0 0c.39 1.737.6 3.542.6 5.395 0 1.853-.21 3.658-.6 5.395',
  messages: 'M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75',
  branding: 'M4.098 19.902a3.75 3.75 0 0 0 5.304 0l6.401-6.402M6.75 21A3.75 3.75 0 0 1 3 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 0 0 3.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88',
  team: 'M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z',
  members: 'M17.982 18.725A7.488 7.488 0 0 0 12 15.75a7.488 7.488 0 0 0-5.982 2.975m11.963 0a9 9 0 1 0-11.963 0m11.963 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-5.982-2.275M15 9.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
  settings: 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z|M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z',
};

const NAV_ITEMS = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'tenants', label: 'Tenants' },
  { key: 'members', label: 'Members' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'messages', label: 'Messages' },
  { key: 'branding', label: 'Branding' },
  { key: 'team', label: 'Team' },
  { key: 'settings', label: 'Settings' },
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

  // Recolor every Tailwind `brand-*` utility used inside the property panel to
  // the property's own accent — scoped to `.prop-theme` so the rest of Balkina
  // (and other apps) keep the default brand palette. color-mix derives the
  // hover/tint shades from the single accent.
  const themeCss = `
    .prop-theme .bg-brand-500 { background-color: var(--pa); }
    .prop-theme .hover\\:bg-brand-700:hover { background-color: color-mix(in srgb, var(--pa) 82%, black); }
    .prop-theme .bg-brand-50 { background-color: color-mix(in srgb, var(--pa) 12%, white); }
    .prop-theme .hover\\:bg-brand-50:hover { background-color: color-mix(in srgb, var(--pa) 12%, white); }
    .prop-theme .bg-brand-100 { background-color: color-mix(in srgb, var(--pa) 20%, white); }
    .prop-theme .text-brand-600 { color: var(--pa); }
    .prop-theme .text-brand-700 { color: color-mix(in srgb, var(--pa) 82%, black); }
    .prop-theme .hover\\:text-brand-400:hover { color: var(--pa); }
    .prop-theme .border-brand-200 { border-color: color-mix(in srgb, var(--pa) 35%, white); }
    .prop-theme .border-brand-300 { border-color: color-mix(in srgb, var(--pa) 45%, white); }
    .prop-theme .border-brand-400 { border-color: color-mix(in srgb, var(--pa) 60%, white); }
    .prop-theme .border-brand-500 { border-color: var(--pa); }
    .prop-theme .focus\\:border-brand-500:focus { border-color: var(--pa); }
    .prop-theme .focus\\:ring-brand-500:focus { --tw-ring-color: var(--pa); }
  `;

  return (
    <div className="prop-theme flex min-h-screen bg-gray-50" style={{ '--pa': color } as React.CSSProperties}>
      <style dangerouslySetInnerHTML={{ __html: themeCss }} />
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
              <Svg active={activeTab === item.key} d={ICONS[item.key] ?? ''} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-0 left-0 right-0 border-t border-gray-200 p-4">
          <button
            onClick={() => createClient().auth.signOut().then(() => window.location.href = '/auth/login')}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <svg className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            Sign Out
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
