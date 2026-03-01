'use client';

import { useEffect, useState, useCallback } from 'react';

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  expires_at: string | null;
  usage_count: number;
  usage_limit: number | null;
  created_at: string;
}

function generateCode(): string {
  return 'BALKINA' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState({
    code: generateCode(),
    discount_type: 'percentage' as 'percentage' | 'fixed',
    discount_value: '',
    expires_at: '',
    usage_limit: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCoupons = useCallback(async () => {
    const res = await fetch('/api/coupons');
    const json = await res.json();
    setCoupons(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchCoupons(); }, [fetchCoupons]);

  function openNew() {
    setEditing(null);
    setForm({ code: generateCode(), discount_type: 'percentage', discount_value: '', expires_at: '', usage_limit: '' });
    setShowForm(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      expires_at: c.expires_at ? c.expires_at.split('T')[0] : '',
      usage_limit: c.usage_limit ? String(c.usage_limit) : '',
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this coupon?')) return;
    await fetch(`/api/coupons?id=${id}`, { method: 'DELETE' });
    fetchCoupons();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const body = {
      id: editing?.id,
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: Number(form.discount_value),
      expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
    };

    const res = await fetch('/api/coupons', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error?.message ?? 'Failed to save'); setSaving(false); return; }
    setShowForm(false);
    setEditing(null);
    setSaving(false);
    fetchCoupons();
  }

  if (showForm) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{editing ? 'Edit Coupon' : 'Create Coupon'}</h1>
          <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
        <form onSubmit={handleSubmit} className="max-w-lg space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Code</label>
            <div className="flex gap-2">
              <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <button type="button" onClick={() => setForm({ ...form, code: generateCode() })}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50">Generate</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Discount Type</label>
              <select value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed Amount</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {form.discount_type === 'percentage' ? 'Discount (%)' : 'Discount ($)'}
              </label>
              <input type="number" required min="0" step={form.discount_type === 'percentage' ? '1' : '0.01'}
                value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Expiry Date</label>
              <input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Usage Limit</label>
              <input type="number" min="1" value={form.usage_limit}
                onChange={(e) => setForm({ ...form, usage_limit: e.target.value })} placeholder="Unlimited"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={saving}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {saving ? 'Saving...' : editing ? 'Update Coupon' : 'Create Coupon'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="mt-1 text-sm text-gray-500">Create and manage discount codes.</p>
        </div>
        <button onClick={openNew} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Create Coupon
        </button>
      </div>
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No coupons yet.</p>
            <button onClick={openNew} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">Create your first coupon</button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Code</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Discount</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Usage</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Expires</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-mono font-medium text-gray-900">{c.code}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value.toFixed(2)}`}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {c.usage_count}{c.usage_limit ? ` / ${c.usage_limit}` : ''}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {c.expires_at ? new Date(c.expires_at).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <button onClick={() => openEdit(c)} className="mr-3 text-brand-600 hover:text-brand-800">Edit</button>
                    <button onClick={() => handleDelete(c.id)} className="text-red-600 hover:text-red-800">Delete</button>
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
