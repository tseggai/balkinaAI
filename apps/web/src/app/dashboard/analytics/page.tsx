'use client';

import { useEffect, useState, useCallback } from 'react';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface StatsData {
  period: string;
  revenue: { period: number; allTime: number };
  appointments: { total: number; statusBreakdown: Record<string, number> };
  topServices: { id: string; name: string; count: number; revenue: number }[];
  topStaff: { id: string; name: string; count: number; revenue: number }[];
  customers: { periodActive: number; totalUnique: number; newInPeriod: number; returning: number };
  reviews: { avgRating: number | null; totalCount: number };
  dailyRevenue: { date: string; revenue: number; count: number }[];
}

type PeriodKey = 'today' | 'this_week' | 'this_month' | 'last_month' | 'this_year';

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_year', label: 'This Year' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-400',
  confirmed: 'bg-blue-400',
  completed: 'bg-green-400',
  cancelled: 'bg-red-400',
  no_show: 'bg-gray-400',
  rescheduled: 'bg-purple-400',
  rejected: 'bg-orange-400',
  emergency: 'bg-rose-400',
};

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/stats?period=${period}`);
    const json = await res.json();
    setData(json);
    setLoading(false);
  }, [period]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const maxDailyRevenue = data ? Math.max(...data.dailyRevenue.map((d) => d.revenue), 1) : 1;
  const maxDailyCount = data ? Math.max(...data.dailyRevenue.map((d) => d.count), 1) : 1;

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Analytics</h1>
          <p className="mt-1 text-sm text-gray-500">Detailed insights into your business performance.</p>
        </div>
      </div>

      {/* Period Selector */}
      <div className="mt-5 flex flex-wrap items-center gap-2">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            onClick={() => setPeriod(opt.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              period === opt.key
                ? 'bg-brand-600 text-white'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : data ? (
        <>
          {/* ── KPI Cards ─────────────────────────────────────────── */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <KpiCard
              label="Period Revenue"
              value={`$${data.revenue.period.toFixed(2)}`}
              subtitle={`All-time: $${data.revenue.allTime.toFixed(2)}`}
              icon={<DollarIcon />}
            />
            <KpiCard
              label="Appointments"
              value={String(data.appointments.total)}
              subtitle={`${data.appointments.statusBreakdown.completed ?? 0} completed`}
              icon={<CalendarIcon />}
            />
            <KpiCard
              label="Active Customers"
              value={String(data.customers.periodActive)}
              subtitle={`${data.customers.newInPeriod} new, ${data.customers.returning} returning`}
              icon={<UsersIcon />}
            />
            <KpiCard
              label="Avg Rating"
              value={data.reviews.avgRating !== null ? data.reviews.avgRating.toFixed(1) : '—'}
              subtitle={`${data.reviews.totalCount} total reviews`}
              icon={<StarIcon />}
            />
          </div>

          {/* ── Revenue Chart (CSS bars) ──────────────────────────── */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Revenue Trend</h2>
            <div className="mt-4 flex items-end gap-1 overflow-x-auto" style={{ minHeight: 160 }}>
              {data.dailyRevenue.map((day) => {
                const height = maxDailyRevenue > 0 ? (day.revenue / maxDailyRevenue) * 140 : 0;
                return (
                  <div key={day.date} className="group relative flex flex-col items-center" style={{ minWidth: data.dailyRevenue.length > 31 ? 8 : 20 }}>
                    <div className="absolute -top-8 hidden rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block whitespace-nowrap z-10">
                      ${day.revenue.toFixed(0)} &middot; {day.count} appts
                    </div>
                    <div
                      className="w-full rounded-t bg-brand-500 transition-all hover:bg-brand-600"
                      style={{ height: Math.max(height, 2), minWidth: data.dailyRevenue.length > 31 ? 6 : 16 }}
                    />
                    {data.dailyRevenue.length <= 31 && (
                      <span className="mt-1 text-[10px] text-gray-400">{day.date.slice(8)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Appointments Chart ────────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Daily Appointments</h2>
            <div className="mt-4 flex items-end gap-1 overflow-x-auto" style={{ minHeight: 160 }}>
              {data.dailyRevenue.map((day) => {
                const height = maxDailyCount > 0 ? (day.count / maxDailyCount) * 140 : 0;
                return (
                  <div key={day.date} className="group relative flex flex-col items-center" style={{ minWidth: data.dailyRevenue.length > 31 ? 8 : 20 }}>
                    <div className="absolute -top-8 hidden rounded bg-gray-800 px-2 py-1 text-xs text-white group-hover:block whitespace-nowrap z-10">
                      {day.count} appointments
                    </div>
                    <div
                      className="w-full rounded-t bg-emerald-500 transition-all hover:bg-emerald-600"
                      style={{ height: Math.max(height, 2), minWidth: data.dailyRevenue.length > 31 ? 6 : 16 }}
                    />
                    {data.dailyRevenue.length <= 31 && (
                      <span className="mt-1 text-[10px] text-gray-400">{day.date.slice(8)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Status Breakdown ──────────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Appointment Status</h2>
            <div className="mt-4 space-y-3">
              {Object.entries(data.appointments.statusBreakdown)
                .sort(([, a], [, b]) => b - a)
                .map(([status, count]) => {
                  const pct = data.appointments.total > 0 ? (count / data.appointments.total) * 100 : 0;
                  return (
                    <div key={status} className="flex items-center gap-3">
                      <span className="w-24 text-sm capitalize text-gray-600">{status.replace('_', ' ')}</span>
                      <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-3">
                        <div
                          className={`h-full rounded-full transition-all ${STATUS_COLORS[status] ?? 'bg-gray-400'}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="w-12 text-right text-sm font-medium text-gray-700">{count}</span>
                      <span className="w-12 text-right text-xs text-gray-400">{pct.toFixed(0)}%</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* ── Top Services & Top Staff ──────────────────────────── */}
          <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Top Services */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Top Services</h2>
              {data.topServices.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {data.topServices.map((svc, i) => (
                    <div key={svc.id} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{svc.name}</p>
                        <p className="text-xs text-gray-400">{svc.count} bookings</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">${svc.revenue.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-400">No service data for this period.</p>
              )}
            </div>

            {/* Top Staff */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Top Staff</h2>
              {data.topStaff.length > 0 ? (
                <div className="mt-4 space-y-3">
                  {data.topStaff.map((staff, i) => (
                    <div key={staff.id} className="flex items-center gap-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                        {i + 1}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-sm font-medium text-gray-900">{staff.name}</p>
                        <p className="text-xs text-gray-400">{staff.count} appointments</p>
                      </div>
                      <span className="text-sm font-semibold text-gray-700">${staff.revenue.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-400">No staff data for this period.</p>
              )}
            </div>
          </div>

          {/* ── Customer Metrics ──────────────────────────────────── */}
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Customer Metrics</h2>
            <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{data.customers.periodActive}</p>
                <p className="mt-1 text-xs text-gray-500">Active This Period</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{data.customers.newInPeriod}</p>
                <p className="mt-1 text-xs text-gray-500">New Customers</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{data.customers.returning}</p>
                <p className="mt-1 text-xs text-gray-500">Returning</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-gray-900">{data.customers.totalUnique}</p>
                <p className="mt-1 text-xs text-gray-500">All-Time Unique</p>
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="mt-8 rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
          <p className="text-sm text-gray-500">Unable to load analytics data.</p>
        </div>
      )}
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function KpiCard({ label, value, subtitle, icon }: { label: string; value: string; subtitle: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-500">{label}</p>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">{icon}</div>
      </div>
      <p className="mt-3 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
    </div>
  );
}

/* ─── Icons ───────────────────────────────────────────────────────────────── */

function DollarIcon() {
  return (
    <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function StarIcon() {
  return (
    <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
    </svg>
  );
}
