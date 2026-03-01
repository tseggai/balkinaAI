'use client';

import { useEffect, useState, useCallback } from 'react';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
}

type WeekSchedule = Record<string, DaySchedule>;

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  availability_schedule: WeekSchedule;
  created_at: string;
}

const defaultSchedule: WeekSchedule = Object.fromEntries(
  DAYS.map((d) => [d.toLowerCase(), { enabled: d !== 'Sunday' && d !== 'Saturday', start: '09:00', end: '17:00' }])
);

export default function StaffPage() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [form, setForm] = useState({ name: '', email: '', phone: '' });
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/staff');
    const json = await res.json();
    setStaff(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  function openNew() {
    setEditing(null);
    setForm({ name: '', email: '', phone: '' });
    setSchedule(defaultSchedule);
    setShowForm(true);
  }

  function openEdit(s: StaffMember) {
    setEditing(s);
    setForm({ name: s.name, email: s.email, phone: s.phone ?? '' });
    setSchedule(
      typeof s.availability_schedule === 'object' && s.availability_schedule
        ? (s.availability_schedule as WeekSchedule)
        : defaultSchedule
    );
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this staff member?')) return;
    await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
    fetchStaff();
  }

  function updateDay(day: string, field: keyof DaySchedule, value: boolean | string) {
    setSchedule((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const body = {
      id: editing?.id,
      name: form.name,
      email: form.email,
      phone: form.phone || null,
      availability_schedule: schedule,
    };

    const res = await fetch('/api/staff', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? 'Failed to save');
      setSaving(false);
      return;
    }

    setShowForm(false);
    setEditing(null);
    setSaving(false);
    fetchStaff();
  }

  if (showForm) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{editing ? 'Edit Staff' : 'Add Staff'}</h1>
          <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>

        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Full Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>

          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Weekly Availability</label>
            <div className="space-y-2 rounded-lg border border-gray-200 p-4">
              {DAYS.map((day) => {
                const key = day.toLowerCase();
                const ds = schedule[key] ?? { enabled: false, start: '09:00', end: '17:00' };
                return (
                  <div key={day} className="flex items-center gap-3">
                    <label className="flex w-28 items-center gap-2">
                      <input type="checkbox" checked={ds.enabled} onChange={(e) => updateDay(key, 'enabled', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600" />
                      <span className="text-sm text-gray-700">{day}</span>
                    </label>
                    {ds.enabled && (
                      <>
                        <input type="time" value={ds.start} onChange={(e) => updateDay(key, 'start', e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1 text-sm" />
                        <span className="text-sm text-gray-400">to</span>
                        <input type="time" value={ds.end} onChange={(e) => updateDay(key, 'end', e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1 text-sm" />
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Update' : 'Add Staff'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your team members.</p>
        </div>
        <button onClick={openNew} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Add Staff
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : staff.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No staff members yet.</p>
            <button onClick={openNew} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
              Add your first team member
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Phone</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {staff.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{s.email}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{s.phone ?? '—'}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <button onClick={() => openEdit(s)} className="mr-3 text-brand-600 hover:text-brand-800">Edit</button>
                    <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
