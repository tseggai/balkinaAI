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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);

  // Editable detail fields
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');

  // Add customer form
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  const fetchCustomers = useCallback(async () => {
    const res = await fetch('/api/customers');
    const json = await res.json();
    setCustomers(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCustomers(); }, [fetchCustomers]);

  // When selected customer changes, populate editable fields
  useEffect(() => {
    if (selected) {
      setEditName(selected.display_name ?? '');
      setEditEmail(selected.email ?? '');
      setEditPhone(selected.phone ?? '');
    }
  }, [selected]);

  const allSelected = customers.length > 0 && selectedIds.length === customers.length;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(customers.map((c) => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleAddCustomer = async () => {
    if (!newName.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: newName.trim(),
          email: newEmail.trim() || null,
          phone: newPhone.trim() || null,
        }),
      });
      if (res.ok) {
        setNewName('');
        setNewEmail('');
        setNewPhone('');
        // Refresh data without closing the modal
        fetchCustomers();
      }
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="relative h-full">
      {/* Main list - always full width */}
      <div className="h-full p-6 lg:p-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
            <p className="mt-1 text-sm text-gray-500">Customers who have booked with you.</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-brand-700 transition-colors"
          >
            <span className="text-lg leading-none">+</span> Add Customer
          </button>
        </div>

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
                  <th className="w-10 px-4 py-3">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Contact</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Bookings</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Total Spent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last Booking</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customers.map((c) => (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => setSelected(c)}
                  >
                    <td className="w-10 px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {c.display_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      <div>{c.email ?? '---'}</div>
                      {c.phone && <div className="text-xs text-gray-400">{c.phone}</div>}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{c.total_bookings}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">${c.total_spent.toFixed(2)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {c.last_booking_date ? new Date(c.last_booking_date).toLocaleDateString() : '---'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Customer detail slide-in overlay panel */}
      {selected && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelected(null)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]">
            <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Customer Profile</h2>
              <button onClick={() => setSelected(null)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-3">
              <div className="space-y-5">
                {/* Editable Name */}
                <div className="space-y-0.5">
                  <label className="block text-xs text-gray-400">Display Name</label>
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3"
                  />
                </div>

                {/* Editable Email */}
                <div className="space-y-0.5">
                  <label className="block text-xs text-gray-400">Email</label>
                  <input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="No email"
                    className="w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3"
                  />
                </div>

                {/* Editable Phone */}
                <div className="space-y-0.5">
                  <label className="block text-xs text-gray-400">Phone</label>
                  <input
                    type="tel"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="No phone"
                    className="w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3"
                  />
                </div>
              </div>

              <div className="mt-6 grid grid-cols-2 gap-4">
                <StatCard label="Total Bookings" value={String(selected.total_bookings)} />
                <StatCard label="Total Spent" value={`$${selected.total_spent.toFixed(2)}`} />
                <StatCard label="Avg Interval" value={selected.avg_interval_days ? `${selected.avg_interval_days} days` : '---'} />
                <StatCard
                  label="Next Predicted"
                  value={selected.predicted_next_date ? new Date(selected.predicted_next_date).toLocaleDateString() : '---'}
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
          </div>
        </>
      )}

      {/* Add Customer modal overlay panel */}
      {showAddModal && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setShowAddModal(false)}
          />
          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]">
            <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Add Customer</h2>
              <button onClick={() => setShowAddModal(false)} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-8 py-3">
              <div className="space-y-5">
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Display Name"
                  className="w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="Email"
                  className="w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <input
                  type="tel"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Phone"
                  className="w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-8 py-4">
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowAddModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button
                  onClick={handleAddCustomer}
                  disabled={addLoading || !newName.trim()}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {addLoading ? 'Adding...' : 'Add Customer'}
                </button>
              </div>
            </div>
          </div>
        </>
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
