'use client';

import { useEffect, useState, useCallback } from 'react';

interface CustomerWithStats {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
  total_bookings: number;
  total_spent: number;
  last_booking_date: string | null;
  avg_interval_days: number | null;
  predicted_next_date: string | null;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<CustomerWithStats | null>(null);

  const fetchCustomers = useCallback(async () => {
    const res = await fetch('/api/customers');
    const json = await res.json();
    setCustomers(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  return (
    <div className="flex h-full">
      <div className={`flex-1 p-6 lg:p-8 ${selected ? 'hidden lg:block' : ''}`}>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="mt-1 text-sm text-gray-500">Customers who have booked with you.</p>

        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
          ) : customers.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-500">No customers yet.</p>
              <p className="mt-1 text-xs text-gray-400">Customers will appear here once they book appointments.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Bookings</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Total Spent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last Booking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <tr key={c.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(c)}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {c.display_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{c.email ?? '—'}</div>
                      {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{c.total_bookings}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">${c.total_spent.toFixed(2)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {c.last_booking_date ? new Date(c.last_booking_date).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Customer detail panel */}
      {selected && (
        <div className="w-full border-l border-gray-200 bg-white p-6 lg:w-96">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Customer Profile</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
          </div>

          <div className="mt-4">
            <p className="text-xl font-bold text-gray-900">{selected.display_name ?? 'Unknown'}</p>
            {selected.email && <p className="mt-1 text-sm text-gray-600">{selected.email}</p>}
            {selected.phone && <p className="text-sm text-gray-600">{selected.phone}</p>}
          </div>

          <div className="mt-6 grid grid-cols-2 gap-4">
            <StatCard label="Total Bookings" value={String(selected.total_bookings)} />
            <StatCard label="Total Spent" value={`$${selected.total_spent.toFixed(2)}`} />
            <StatCard label="Avg Interval" value={selected.avg_interval_days ? `${selected.avg_interval_days} days` : '—'} />
            <StatCard
              label="Next Predicted"
              value={selected.predicted_next_date ? new Date(selected.predicted_next_date).toLocaleDateString() : '—'}
            />
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700">Last Booking</p>
            <p className="mt-1 text-sm text-gray-500">
              {selected.last_booking_date ? new Date(selected.last_booking_date).toLocaleDateString() : 'Never'}
            </p>
          </div>

          <div className="mt-6">
            <p className="text-sm font-medium text-gray-700">Member Since</p>
            <p className="mt-1 text-sm text-gray-500">
              {new Date(selected.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 p-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900">{value}</p>
    </div>
  );
}
