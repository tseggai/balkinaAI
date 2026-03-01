'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface ServiceExtra {
  name: string;
  price: number;
  duration_minutes: number;
}

interface Service {
  id: string;
  name: string;
  category_id: string | null;
  duration_minutes: number;
  price: number;
  deposit_enabled: boolean;
  deposit_type: 'fixed' | 'percentage' | null;
  deposit_amount: number | null;
  service_extras?: ServiceExtra[];
}

interface Category {
  id: string;
  name: string;
}

export function ServiceForm({
  service,
  onClose,
}: {
  service: Service | null;
  onClose: () => void;
}) {
  const [name, setName] = useState(service?.name ?? '');
  const [categoryId, setCategoryId] = useState(service?.category_id ?? '');
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 60));
  const [price, setPrice] = useState(String(service?.price ?? ''));
  const [depositEnabled, setDepositEnabled] = useState(service?.deposit_enabled ?? false);
  const [depositType, setDepositType] = useState<'fixed' | 'percentage'>(service?.deposit_type ?? 'fixed');
  const [depositAmount, setDepositAmount] = useState(String(service?.deposit_amount ?? ''));
  const [extras, setExtras] = useState<ServiceExtra[]>(service?.service_extras ?? []);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const supabase = createClient();
    supabase.from('categories').select('id, name').order('display_order').then(({ data }) => {
      setCategories(data ?? []);
    });
  }, []);

  function addExtra() {
    setExtras([...extras, { name: '', price: 0, duration_minutes: 0 }]);
  }

  function updateExtra(index: number, field: keyof ServiceExtra, value: string | number) {
    const updated = [...extras];
    const item = updated[index];
    if (item) {
      (item as unknown as Record<string, string | number>)[field] = value;
    }
    setExtras(updated);
  }

  function removeExtra(index: number) {
    setExtras(extras.filter((_, i) => i !== index));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const body = {
      id: service?.id,
      name,
      category_id: categoryId || null,
      duration_minutes: Number(duration),
      price: Number(price),
      deposit_enabled: depositEnabled,
      deposit_type: depositEnabled ? depositType : null,
      deposit_amount: depositEnabled ? Number(depositAmount) : null,
      extras: extras.filter((e) => e.name.trim()),
    };

    const res = await fetch('/api/services', {
      method: service ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) {
      setError(json.error?.message ?? 'Failed to save');
      setSaving(false);
      return;
    }

    onClose();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {service ? 'Edit Service' : 'New Service'}
        </h1>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
      </div>

      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">No category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Duration (min)</label>
            <input
              type="number"
              required
              min="5"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Price ($)</label>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
        </div>

        {/* Deposit */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={depositEnabled}
              onChange={(e) => setDepositEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Require deposit</span>
          </label>

          {depositEnabled && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">Type</label>
                <select
                  value={depositType}
                  onChange={(e) => setDepositType(e.target.value as 'fixed' | 'percentage')}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                >
                  <option value="fixed">Fixed amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {depositType === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step={depositType === 'percentage' ? '1' : '0.01'}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
            </div>
          )}
        </div>

        {/* Service Extras */}
        <div>
          <div className="mb-2 flex items-center justify-between">
            <label className="text-sm font-medium text-gray-700">Add-ons / Extras</label>
            <button type="button" onClick={addExtra} className="text-sm font-medium text-brand-600 hover:text-brand-700">
              + Add extra
            </button>
          </div>
          {extras.map((extra, i) => (
            <div key={i} className="mb-2 grid grid-cols-[1fr_80px_80px_auto] gap-2">
              <input
                placeholder="Name"
                value={extra.name}
                onChange={(e) => updateExtra(i, 'name', e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <input
                type="number"
                placeholder="Price"
                min="0"
                step="0.01"
                value={extra.price || ''}
                onChange={(e) => updateExtra(i, 'price', Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <input
                type="number"
                placeholder="Min"
                min="0"
                value={extra.duration_minutes || ''}
                onChange={(e) => updateExtra(i, 'duration_minutes', Number(e.target.value))}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              <button type="button" onClick={() => removeExtra(i)} className="text-red-500 hover:text-red-700">
                &times;
              </button>
            </div>
          ))}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : service ? 'Update Service' : 'Create Service'}
        </button>
      </form>
    </div>
  );
}
