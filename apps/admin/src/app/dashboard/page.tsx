'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

interface PlatformStats {
  tenants: {
    total: number;
    statusBreakdown: Record<string, number>;
    newThisMonth: number;
    planDistribution: Record<string, number>;
  };
  customers: { total: number };
  appointments: {
    total: number;
    statusBreakdown: Record<string, number>;
    totalRevenue: number;
  };
  reviews: { total: number };
}

const TENANT_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'bg-green-100', text: 'text-green-700' },
  inactive: { bg: 'bg-gray-100', text: 'text-gray-700' },
  suspended: { bg: 'bg-red-100', text: 'text-red-700' },
  pending_subscription: { bg: 'bg-amber-100', text: 'text-amber-700' },
  past_due: { bg: 'bg-orange-100', text: 'text-orange-700' },
};

export default function AdminDashboard() {
  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/stats');
      const json = await res.json();
      setStats(json);
      setLoading(false);
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="p-6">
        <p className="text-sm text-gray-500">Failed to load platform statistics.</p>
      </div>
    );
  }

  const kpis = [
    {
      label: 'Total Tenants',
      value: String(stats.tenants.total),
      subtitle: `${stats.tenants.newThisMonth} new this month`,
      href: '/dashboard/tenants',
      color: 'bg-brand-50',
      iconColor: 'text-brand-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 21h16.5M4.5 3h15M5.25 3v18m13.5-18v18M9 6.75h1.5m-1.5 3h1.5m-1.5 3h1.5m3-6H15m-1.5 3H15m-1.5 3H15M9 21v-3.375c0-.621.504-1.125 1.125-1.125h3.75c.621 0 1.125.504 1.125 1.125V21" />
        </svg>
      ),
    },
    {
      label: 'Total Customers',
      value: String(stats.customers.total),
      subtitle: 'All registered customers',
      href: '/dashboard/customers',
      color: 'bg-emerald-50',
      iconColor: 'text-emerald-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
        </svg>
      ),
    },
    {
      label: 'Total Appointments',
      value: String(stats.appointments.total),
      subtitle: `${stats.appointments.statusBreakdown.completed ?? 0} completed`,
      href: '#',
      color: 'bg-blue-50',
      iconColor: 'text-blue-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      ),
    },
    {
      label: 'Platform Revenue',
      value: `$${stats.appointments.totalRevenue.toFixed(2)}`,
      subtitle: `${stats.reviews.total} total reviews`,
      href: '#',
      color: 'bg-amber-50',
      iconColor: 'text-amber-600',
      icon: (
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Platform Overview</h1>
        <p className="mt-1 text-sm text-gray-500">Manage and monitor the Balkina AI platform.</p>
      </div>

      {/* KPI Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href} className="group rounded-xl border border-gray-200 bg-white p-5 transition hover:shadow-md">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
              <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${kpi.color} ${kpi.iconColor}`}>
                {kpi.icon}
              </div>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">{kpi.value}</p>
            <p className="mt-1 text-xs text-gray-400">{kpi.subtitle}</p>
          </Link>
        ))}
      </div>

      {/* Tenant Status and Plan Distribution */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tenant Status */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Tenant Status</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(stats.tenants.statusBreakdown)
              .sort(([, a], [, b]) => b - a)
              .map(([status, count]) => {
                const pct = stats.tenants.total > 0 ? (count / stats.tenants.total) * 100 : 0;
                const colors = TENANT_STATUS_COLORS[status] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
                return (
                  <div key={status} className="flex items-center gap-3">
                    <span className={`inline-flex w-32 items-center justify-center rounded-full px-2 py-0.5 text-xs font-medium ${colors.bg} ${colors.text}`}>
                      {status.replace('_', ' ')}
                    </span>
                    <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-2.5">
                      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-sm font-medium text-gray-700">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>

        {/* Plan Distribution */}
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Plan Distribution</h2>
          <div className="mt-4 space-y-3">
            {Object.entries(stats.tenants.planDistribution)
              .sort(([, a], [, b]) => b - a)
              .map(([plan, count]) => {
                const pct = stats.tenants.total > 0 ? (count / stats.tenants.total) * 100 : 0;
                return (
                  <div key={plan} className="flex items-center gap-3">
                    <span className="w-32 truncate text-sm font-medium text-gray-600">{plan}</span>
                    <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-2.5">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-8 text-right text-sm font-medium text-gray-700">{count}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      {/* Appointment Status */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Appointment Status (Platform-Wide)</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {Object.entries(stats.appointments.statusBreakdown)
            .sort(([, a], [, b]) => b - a)
            .map(([status, count]) => (
              <div key={status} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3 text-center">
                <p className="text-2xl font-bold text-gray-900">{count}</p>
                <p className="mt-1 text-xs font-medium capitalize text-gray-500">{status.replace('_', ' ')}</p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
