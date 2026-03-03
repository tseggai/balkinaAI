'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface Appointment {
  id: string;
  customer_id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  created_at: string;
  services: { name: string; duration_minutes: number } | null;
  customers: { display_name: string | null; email: string | null } | null;
  staff: { name: string } | null;
}

type PeriodKey = 'today' | 'yesterday' | 'tomorrow' | 'this_week' | 'this_month' | 'this_year' | 'custom';

interface PeriodRange {
  from: string;
  to: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function getPeriodRange(key: PeriodKey, customFrom?: string, customTo?: string): PeriodRange {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const d = now.getDate();

  switch (key) {
    case 'today':
      return {
        from: new Date(y, m, d).toISOString(),
        to: new Date(y, m, d + 1).toISOString(),
      };
    case 'yesterday':
      return {
        from: new Date(y, m, d - 1).toISOString(),
        to: new Date(y, m, d).toISOString(),
      };
    case 'tomorrow':
      return {
        from: new Date(y, m, d + 1).toISOString(),
        to: new Date(y, m, d + 2).toISOString(),
      };
    case 'this_week': {
      const dayOfWeek = now.getDay();
      return {
        from: new Date(y, m, d - dayOfWeek).toISOString(),
        to: new Date(y, m, d - dayOfWeek + 7).toISOString(),
      };
    }
    case 'this_month':
      return {
        from: new Date(y, m, 1).toISOString(),
        to: new Date(y, m + 1, 1).toISOString(),
      };
    case 'this_year':
      return {
        from: new Date(y, 0, 1).toISOString(),
        to: new Date(y + 1, 0, 1).toISOString(),
      };
    case 'custom':
      return {
        from: customFrom ? new Date(customFrom).toISOString() : new Date(y, m, 1).toISOString(),
        to: customTo ? new Date(new Date(customTo).getTime() + 86400000).toISOString() : new Date(y, m + 1, 1).toISOString(),
      };
  }
}

function formatDuration(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${mins}m`;
  if (mins === 0) return `${hours}h`;
  return `${hours}h ${mins}m`;
}

/* ─── Status config ───────────────────────────────────────────────────────── */

const STATUS_CONFIG: { key: string; label: string; color: string; bgColor: string; borderColor: string }[] = [
  { key: 'pending', label: 'Pending', color: 'text-amber-700', bgColor: 'bg-amber-50', borderColor: 'border-amber-200' },
  { key: 'confirmed', label: 'Confirmed', color: 'text-blue-700', bgColor: 'bg-blue-50', borderColor: 'border-blue-200' },
  { key: 'completed', label: 'Completed', color: 'text-green-700', bgColor: 'bg-green-50', borderColor: 'border-green-200' },
  { key: 'cancelled', label: 'Cancelled', color: 'text-red-700', bgColor: 'bg-red-50', borderColor: 'border-red-200' },
  { key: 'no_show', label: 'No Show', color: 'text-gray-700', bgColor: 'bg-gray-50', borderColor: 'border-gray-200' },
  { key: 'rescheduled', label: 'Rescheduled', color: 'text-purple-700', bgColor: 'bg-purple-50', borderColor: 'border-purple-200' },
  { key: 'rejected', label: 'Rejected', color: 'text-orange-700', bgColor: 'bg-orange-50', borderColor: 'border-orange-200' },
  { key: 'emergency', label: 'Emergency', color: 'text-rose-700', bgColor: 'bg-rose-50', borderColor: 'border-rose-200' },
];

const STATUS_BADGE_STYLES: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-700',
  rescheduled: 'bg-purple-100 text-purple-700',
  rejected: 'bg-orange-100 text-orange-700',
  emergency: 'bg-rose-100 text-rose-700',
};

const PERIOD_OPTIONS: { key: PeriodKey; label: string }[] = [
  { key: 'today', label: 'Today' },
  { key: 'yesterday', label: 'Yesterday' },
  { key: 'tomorrow', label: 'Tomorrow' },
  { key: 'this_week', label: 'This Week' },
  { key: 'this_month', label: 'This Month' },
  { key: 'this_year', label: 'This Year' },
  { key: 'custom', label: 'Custom' },
];

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function DashboardOverview() {
  const [period, setPeriod] = useState<PeriodKey>('this_month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const range = useMemo(() => getPeriodRange(period, customFrom, customTo), [period, customFrom, customTo]);

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('from', range.from);
    params.set('to', range.to);

    const [periodRes, allRes] = await Promise.all([
      fetch(`/api/appointments?${params}`),
      fetch('/api/appointments'),
    ]);

    const periodJson = await periodRes.json();
    const allJson = await allRes.json();

    setAppointments(periodJson.data ?? []);
    setAllAppointments(allJson.data ?? []);
    setLoading(false);
  }, [range.from, range.to]);

  useEffect(() => {
    fetchAppointments();
  }, [fetchAppointments]);

  /* ── KPI calculations ─────────────────────────────────────────────────── */

  const totalAppointments = appointments.length;

  const totalDurationMinutes = appointments.reduce((sum, a) => {
    return sum + (a.services?.duration_minutes ?? 0);
  }, 0);

  const revenue = appointments
    .filter((a) => a.status === 'confirmed' || a.status === 'completed')
    .reduce((sum, a) => sum + (a.total_price ?? 0), 0);

  const allCustomerFirstDates = useMemo(() => {
    const map = new Map<string, string>();
    for (const a of allAppointments) {
      const existing = map.get(a.customer_id);
      if (!existing || a.created_at < existing) {
        map.set(a.customer_id, a.created_at);
      }
    }
    return map;
  }, [allAppointments]);

  const newCustomers = useMemo(() => {
    let count = 0;
    const periodCustomerIds = new Set(appointments.map((a) => a.customer_id));
    for (const cid of periodCustomerIds) {
      const firstDate = allCustomerFirstDates.get(cid);
      if (firstDate && firstDate >= range.from && firstDate < range.to) {
        count++;
      }
    }
    return count;
  }, [appointments, allCustomerFirstDates, range.from, range.to]);

  /* ── Status breakdown ─────────────────────────────────────────────────── */

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of STATUS_CONFIG) {
      counts[s.key] = 0;
    }
    for (const a of appointments) {
      if (counts[a.status] !== undefined) {
        counts[a.status] = (counts[a.status] ?? 0) + 1;
      }
    }
    return counts;
  }, [appointments]);

  /* ── Recent appointments (last 5) ─────────────────────────────────────── */

  const recentAppointments = appointments.slice(0, 5);

  /* ── KPI cards data ───────────────────────────────────────────────────── */

  const kpis = [
    {
      label: 'Total Appointments',
      value: String(totalAppointments),
      icon: (
        <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
        </svg>
      ),
    },
    {
      label: 'Total Duration',
      value: formatDuration(totalDurationMinutes),
      icon: (
        <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'Revenue',
      value: `$${revenue.toFixed(2)}`,
      icon: (
        <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      ),
    },
    {
      label: 'New Customers',
      value: String(newCustomers),
      icon: (
        <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v3m0 0v3m0-3h3m-3 0h-3m-2.25-4.125a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0ZM3 19.235v-.11a6.375 6.375 0 0 1 12.75 0v.109A12.318 12.318 0 0 1 9.374 21c-2.331 0-4.512-.645-6.374-1.766Z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="p-6 lg:p-8">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-1 text-sm text-gray-500">Overview of your business performance.</p>
        </div>
      </div>

      {/* ── Period Selector ─────────────────────────────────────────────── */}
      <div className="mt-5">
        <div className="flex flex-wrap items-center gap-2">
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

        {period === 'custom' && (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">From</label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-gray-500">To</label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* ── Loading state ───────────────────────────────────────────────── */}
      {loading ? (
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ── KPI Cards ─────────────────────────────────────────────────── */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-5">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium text-gray-500">{kpi.label}</p>
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                    {kpi.icon}
                  </div>
                </div>
                <p className="mt-3 text-3xl font-bold text-gray-900">{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* ── Status Breakdown ──────────────────────────────────────────── */}
          <div className="mt-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500">Appointment Status</h2>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              {STATUS_CONFIG.map((s) => (
                <div
                  key={s.key}
                  className={`rounded-lg border ${s.borderColor} ${s.bgColor} px-3 py-3 text-center`}
                >
                  <p className={`text-2xl font-bold ${s.color}`}>{statusCounts[s.key]}</p>
                  <p className={`mt-1 text-xs font-medium ${s.color}`}>{s.label}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Recent Appointments ──────────────────────────────────────── */}
          <div className="mt-8">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Recent Appointments</h2>
              <Link
                href="/dashboard/appointments"
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                View all
              </Link>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl border border-gray-200 bg-white">
              {recentAppointments.length > 0 ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Service</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                      <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {recentAppointments.map((appt) => (
                      <tr key={appt.id} className="hover:bg-gray-50">
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                          {appt.customers?.display_name ?? appt.customers?.email ?? 'Unknown'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {appt.services?.name ?? '\u2014'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {appt.staff?.name ?? '\u2014'}
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {new Date(appt.start_time).toLocaleDateString()}{' '}
                          <span className="text-gray-400">
                            {new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                              STATUS_BADGE_STYLES[appt.status] ?? 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {appt.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                          ${(appt.total_price ?? 0).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="px-6 py-12 text-center">
                  <p className="text-sm text-gray-500">No appointments in this period.</p>
                  <p className="mt-1 text-xs text-gray-400">
                    Appointments will appear here once customers start booking.
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
