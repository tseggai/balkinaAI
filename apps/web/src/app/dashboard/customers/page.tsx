'use client';

import { useEffect, useState, useCallback } from 'react';
import { BulkActionBar } from '@/components/bulk-action-bar';
import { ImageUpload } from '@/components/image-upload';

interface CustomerWithStats {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  notes: string | null;
  profile_image_url: string | null;
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
  const [editFirstName, setEditFirstName] = useState('');
  const [editLastName, setEditLastName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editDob, setEditDob] = useState('');
  const [editGender, setEditGender] = useState('');
  const [editNote, setEditNote] = useState('');
  const [editProfileImage, setEditProfileImage] = useState('');
  const [updateLoading, setUpdateLoading] = useState(false);

  // Add customer form
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newDob, setNewDob] = useState('');
  const [newGender, setNewGender] = useState('');
  const [newNote, setNewNote] = useState('');
  const [newProfileImage, setNewProfileImage] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  // Bulk delete
  const [bulkDeleting, setBulkDeleting] = useState(false);

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
      setEditFirstName(selected.first_name ?? '');
      setEditLastName(selected.last_name ?? '');
      setEditEmail(selected.email ?? '');
      setEditPhone(selected.phone ?? '');
      setEditDob(selected.date_of_birth ? (selected.date_of_birth.split('T')[0] ?? '') : '');
      setEditGender(selected.gender ?? '');
      setEditNote(selected.notes ?? '');
      setEditProfileImage(selected.profile_image_url ?? '');
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

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} customer(s)?`)) return;
    setBulkDeleting(true);
    await Promise.all(selectedIds.map(id => fetch(`/api/customers?id=${id}`, { method: 'DELETE' })));
    setSelectedIds([]);
    setBulkDeleting(false);
    fetchCustomers();
  }

  const handleAddCustomer = async () => {
    if (!newFirstName.trim() && !newLastName.trim()) return;
    setAddLoading(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: newFirstName.trim() || null,
          last_name: newLastName.trim() || null,
          display_name: (newFirstName.trim() + ' ' + newLastName.trim()).trim(),
          email: newEmail.trim() || null,
          phone: newPhone.trim() || null,
          date_of_birth: newDob || null,
          gender: newGender || null,
          notes: newNote.trim() || null,
          profile_image_url: newProfileImage || null,
        }),
      });
      if (res.ok) {
        setNewFirstName('');
        setNewLastName('');
        setNewEmail('');
        setNewPhone('');
        setNewDob('');
        setNewGender('');
        setNewNote('');
        setNewProfileImage('');
        setShowAddModal(false);
        fetchCustomers();
      }
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateCustomer = async () => {
    if (!selected) return;
    setUpdateLoading(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selected.id,
          first_name: editFirstName.trim() || null,
          last_name: editLastName.trim() || null,
          display_name: (editFirstName.trim() + ' ' + editLastName.trim()).trim() || null,
          email: editEmail.trim() || null,
          phone: editPhone.trim() || null,
          date_of_birth: editDob || null,
          gender: editGender || null,
          notes: editNote.trim() || null,
          profile_image_url: editProfileImage || null,
        }),
      });
      if (res.ok) fetchCustomers();
    } finally {
      setUpdateLoading(false);
    }
  };

  const addInputClass = 'w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const editInputClass = 'w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';

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

        {/* Bulk action bar - above the table */}
        <BulkActionBar
          selectedCount={selectedIds.length}
          totalCount={customers.length}
          onDelete={handleBulkDelete}
          onClearSelection={() => setSelectedIds([])}
          deleting={bulkDeleting}
        />

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
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Photo</th>
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
                    <td className="px-4 py-3">
                      {c.profile_image_url ? (
                        <img src={c.profile_image_url} alt={c.display_name ?? ''} className="h-9 w-9 rounded-full border border-gray-200 object-cover" />
                      ) : (
                        <div className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-gray-100">
                          <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0" />
                          </svg>
                        </div>
                      )}
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
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelected(null)} />
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
                {/* Row 1: Profile Image (100%) */}
                <ImageUpload value={editProfileImage} onChange={setEditProfileImage} label="" />

                {/* Row 2: First Name (50%) + Last Name (50%) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400">First Name</label>
                    <input type="text" value={editFirstName} onChange={(e) => setEditFirstName(e.target.value)} placeholder="First name" className={editInputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400">Last Name</label>
                    <input type="text" value={editLastName} onChange={(e) => setEditLastName(e.target.value)} placeholder="Last name" className={editInputClass} />
                  </div>
                </div>

                {/* Row 3: Email (50%) + Phone (50%) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400">Email</label>
                    <input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} placeholder="Email" className={editInputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400">Phone</label>
                    <input type="tel" value={editPhone} onChange={(e) => setEditPhone(e.target.value)} placeholder="Phone" className={editInputClass} />
                  </div>
                </div>

                {/* Row 4: Date of Birth (50%) + Gender (50%) */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400">Date of Birth</label>
                    <input type="date" value={editDob} onChange={(e) => setEditDob(e.target.value)} className={editInputClass} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400">Gender</label>
                    <select value={editGender} onChange={(e) => setEditGender(e.target.value)} className={editInputClass}>
                      <option value="">Select</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="non-binary">Non-binary</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  </div>
                </div>

                {/* Row 4: Note (100%) */}
                <div>
                  <label className="block text-xs text-gray-400">Note</label>
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    placeholder="Add a note..."
                    rows={3}
                    className="w-full rounded-[.3rem] border border-transparent bg-transparent px-0 py-2 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3"
                  />
                </div>
              </div>

              {/* Stats */}
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

            <div className="border-t border-gray-200 px-8 py-4">
              <div className="flex justify-between">
                <button
                  onClick={async () => {
                    if (!confirm('Delete this customer?')) return;
                    await fetch(`/api/customers?id=${selected.id}`, { method: 'DELETE' });
                    setSelected(null);
                    fetchCustomers();
                  }}
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
                <div className="flex gap-3">
                  <button onClick={() => setSelected(null)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                  <button
                    onClick={handleUpdateCustomer}
                    disabled={updateLoading}
                    className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                  >
                    {updateLoading ? 'Saving...' : 'Update'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Add Customer modal overlay panel */}
      {showAddModal && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowAddModal(false)} />
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
                {/* Row 1: Upload profile photo (100%) */}
                <ImageUpload value={newProfileImage} onChange={setNewProfileImage} label="" />

                {/* Row 2: First Name (50%) + Last Name (50%) */}
                <div className="grid grid-cols-2 gap-4">
                  <input type="text" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} placeholder="First name" className={addInputClass} />
                  <input type="text" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} placeholder="Last name" className={addInputClass} />
                </div>

                {/* Row 3: Email (50%) + Phone (50%) */}
                <div className="grid grid-cols-2 gap-4">
                  <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="Email" className={addInputClass} />
                  <input type="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="Phone" className={addInputClass} />
                </div>

                {/* Row 4: Date of Birth (50%) + Gender (50%) */}
                <div className="grid grid-cols-2 gap-4">
                  <input type="date" value={newDob} onChange={(e) => setNewDob(e.target.value)} placeholder="Date of Birth" className={addInputClass} />
                  <select value={newGender} onChange={(e) => setNewGender(e.target.value)} className={addInputClass}>
                    <option value="">Gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>

                {/* Row 5: Note (100%) */}
                <textarea
                  value={newNote}
                  onChange={(e) => setNewNote(e.target.value)}
                  placeholder="Note"
                  rows={3}
                  className="w-full rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>

            <div className="border-t border-gray-200 px-8 py-4">
              <div className="flex justify-end gap-3">
                <button onClick={() => setShowAddModal(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button
                  onClick={handleAddCustomer}
                  disabled={addLoading || (!newFirstName.trim() && !newLastName.trim())}
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
