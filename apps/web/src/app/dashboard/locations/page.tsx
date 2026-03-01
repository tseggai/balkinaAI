'use client';

import { useEffect, useState, useCallback } from 'react';

const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'America/Toronto', 'Europe/London', 'Europe/Paris', 'Europe/Berlin',
  'Asia/Tokyo', 'Asia/Shanghai', 'Asia/Dubai', 'Australia/Sydney',
];

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  timezone: string;
  created_at: string;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [form, setForm] = useState({ name: '', address: '', timezone: 'America/New_York' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchLocations = useCallback(async () => {
    const res = await fetch('/api/locations');
    const json = await res.json();
    setLocations(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  function openNew() {
    setEditing(null);
    setForm({ name: '', address: '', timezone: 'America/New_York' });
    setShowForm(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setForm({ name: loc.name, address: loc.address, timezone: loc.timezone });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this location?')) return;
    await fetch(`/api/locations?id=${id}`, { method: 'DELETE' });
    fetchLocations();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const body = { id: editing?.id, ...form };
    const res = await fetch('/api/locations', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error?.message ?? 'Failed to save'); setSaving(false); return; }
    setShowForm(false);
    setEditing(null);
    setSaving(false);
    fetchLocations();
  }

  if (showForm) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{editing ? 'Edit Location' : 'Add Location'}</h1>
          <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
        <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Location Name</label>
            <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Address</label>
            <input required value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
              placeholder="123 Main St, City, State, ZIP"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            <p className="mt-1 text-xs text-gray-400">Address will be geocoded automatically for map display.</p>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Timezone</label>
            <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Update' : 'Add Location'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your business locations.</p>
        </div>
        <button onClick={openNew} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Add Location
        </button>
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : locations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No locations yet.</p>
            <button onClick={openNew} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
              Add your first location
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Address</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Timezone</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Coordinates</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {locations.map((loc) => (
                <tr key={loc.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{loc.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{loc.address}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{loc.timezone}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-400">
                    {loc.lat && loc.lng ? `${loc.lat.toFixed(4)}, ${loc.lng.toFixed(4)}` : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <button onClick={() => openEdit(loc)} className="mr-3 text-brand-600 hover:text-brand-800">Edit</button>
                    <button onClick={() => handleDelete(loc.id)} className="text-red-600 hover:text-red-800">Delete</button>
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
