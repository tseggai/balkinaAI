'use client';

import { useEffect, useState, useCallback } from 'react';

type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  total_price: number;
  deposit_paid: boolean;
  deposit_amount_paid: number | null;
  balance_due: number | null;
  services: { name: string } | null;
  customers: { display_name: string | null; email: string | null; phone: string | null } | null;
  staff: { name: string } | null;
  tenant_locations: { name: string } | null;
}

const STATUS_OPTIONS: AppointmentStatus[] = ['pending', 'confirmed', 'cancelled', 'completed', 'no_show'];

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-700',
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [updating, setUpdating] = useState(false);

  const fetchAppointments = useCallback(async () => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    const res = await fetch(`/api/appointments?${params}`);
    const json = await res.json();
    setAppointments(json.data ?? []);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);

  async function updateStatus(id: string, status: AppointmentStatus) {
    setUpdating(true);
    await fetch('/api/appointments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    setUpdating(false);
    setSelected(null);
    fetchAppointments();
  }

  return (
    <div className="flex h-full">
      {/* Main list */}
      <div className={`flex-1 p-6 lg:p-8 ${selected ? 'hidden lg:block' : ''}`}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
            <p className="mt-1 text-sm text-gray-500">View and manage bookings.</p>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
          ) : appointments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-500">No appointments found.</p>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date/Time</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Service</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Deposit</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {appointments.map((appt) => (
                  <tr key={appt.id} className="cursor-pointer hover:bg-gray-50" onClick={() => setSelected(appt)}>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                      {new Date(appt.start_time).toLocaleDateString()}{' '}
                      <span className="text-gray-500">{new Date(appt.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {appt.customers?.display_name ?? appt.customers?.email ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{appt.services?.name ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{appt.staff?.name ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusStyles[appt.status] ?? ''}`}>
                        {appt.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {appt.deposit_paid ? (
                        <span className="text-green-600">${appt.deposit_amount_paid?.toFixed(2)}</span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-medium text-gray-900">
                      ${appt.total_price.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Detail panel */}
      {selected && (
        <div className="w-full border-l border-gray-200 bg-white p-6 lg:w-96">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Appointment Details</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600">&times;</button>
          </div>

          <div className="mt-4 space-y-3 text-sm">
            <Detail label="Customer" value={selected.customers?.display_name ?? selected.customers?.email ?? 'Unknown'} />
            <Detail label="Phone" value={selected.customers?.phone ?? '—'} />
            <Detail label="Service" value={selected.services?.name ?? '—'} />
            <Detail label="Staff" value={selected.staff?.name ?? '—'} />
            <Detail label="Location" value={selected.tenant_locations?.name ?? '—'} />
            <Detail label="Date" value={new Date(selected.start_time).toLocaleDateString()} />
            <Detail label="Time" value={`${new Date(selected.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — ${new Date(selected.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`} />
            <Detail label="Total" value={`$${selected.total_price.toFixed(2)}`} />
            <Detail label="Deposit" value={selected.deposit_paid ? `$${selected.deposit_amount_paid?.toFixed(2)}` : 'Not paid'} />
            <Detail label="Balance Due" value={selected.balance_due != null ? `$${selected.balance_due.toFixed(2)}` : '—'} />
            <Detail label="Status" value={selected.status.replace('_', ' ')} />
          </div>

          <div className="mt-6 space-y-2">
            <p className="text-xs font-medium uppercase text-gray-500">Actions</p>
            {selected.status === 'pending' && (
              <button disabled={updating} onClick={() => updateStatus(selected.id, 'confirmed')}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50">
                Confirm
              </button>
            )}
            {(selected.status === 'pending' || selected.status === 'confirmed') && (
              <button disabled={updating} onClick={() => updateStatus(selected.id, 'cancelled')}
                className="w-full rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                Cancel
              </button>
            )}
            {selected.status === 'confirmed' && (
              <>
                <button disabled={updating} onClick={() => updateStatus(selected.id, 'completed')}
                  className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50">
                  Mark Complete
                </button>
                <button disabled={updating} onClick={() => updateStatus(selected.id, 'no_show')}
                  className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Mark No-Show
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-900">{value}</span>
    </div>
  );
}
