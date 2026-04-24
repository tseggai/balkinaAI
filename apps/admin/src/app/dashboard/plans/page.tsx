'use client';

import { useEffect, useState, useCallback } from 'react';

interface Plan {
  id: string;
  name: string;
  price_monthly: number;
  stripe_price_id: string | null;
  max_staff: number;
  max_locations: number;
  features: Record<string, unknown> | null;
  created_at: string;
  tenant_count: number;
}

export default function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState(0);
  const [formStripeId, setFormStripeId] = useState('');
  const [formMaxStaff, setFormMaxStaff] = useState(1);
  const [formMaxLocations, setFormMaxLocations] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPlans = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/plans');
    const json = await res.json();
    setPlans(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  function resetForm() {
    setFormName('');
    setFormPrice(0);
    setFormStripeId('');
    setFormMaxStaff(1);
    setFormMaxLocations(1);
    setEditingId(null);
    setShowForm(false);
    setError('');
  }

  function startEdit(plan: Plan) {
    setEditingId(plan.id);
    setFormName(plan.name);
    setFormPrice(plan.price_monthly);
    setFormStripeId(plan.stripe_price_id ?? '');
    setFormMaxStaff(plan.max_staff);
    setFormMaxLocations(plan.max_locations);
    setShowForm(true);
  }

  async function handleSave() {
    if (!formName.trim()) { setError('Name is required'); return; }

    setSaving(true);
    setError('');

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      name: formName.trim(),
      price_monthly: formPrice,
      stripe_price_id: formStripeId || null,
      max_staff: formMaxStaff,
      max_locations: formMaxLocations,
    };

    const res = await fetch('/api/admin/plans', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (json.error) { setError(json.error); setSaving(false); return; }

    setSaving(false);
    resetForm();
    fetchPlans();
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Subscription Plans</h1>
          <p className="mt-1 text-sm text-gray-500">Manage pricing tiers and plan limits.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add Plan
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Plan' : 'New Plan'}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Plan Name</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="e.g. Pro"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Price ($/month)</label>
              <input
                type="number"
                value={formPrice}
                onChange={(e) => setFormPrice(parseFloat(e.target.value) || 0)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Stripe Price ID</label>
              <input
                value={formStripeId}
                onChange={(e) => setFormStripeId(e.target.value)}
                placeholder="price_xxx"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Max Staff</label>
              <input
                type="number"
                value={formMaxStaff}
                onChange={(e) => setFormMaxStaff(parseInt(e.target.value, 10) || 1)}
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Max Locations</label>
              <input
                type="number"
                value={formMaxLocations}
                onChange={(e) => setFormMaxLocations(parseInt(e.target.value, 10) || 1)}
                min={1}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button onClick={resetForm}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Plans Grid */}
      {loading ? (
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plans.length > 0 ? (
            plans.map((plan) => (
              <div key={plan.id} className="relative rounded-xl border border-gray-200 bg-white p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
                    <p className="mt-1 text-3xl font-bold text-brand-600">
                      &euro;{plan.price_monthly}<span className="text-sm font-normal text-gray-400">/mo</span>
                    </p>
                  </div>
                  <button
                    onClick={() => startEdit(plan)}
                    className="text-sm font-medium text-brand-600 hover:text-brand-700"
                  >
                    Edit
                  </button>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Max Staff</span>
                    <span className="font-medium text-gray-900">{plan.max_staff}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Max Locations</span>
                    <span className="font-medium text-gray-900">{plan.max_locations}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Active Tenants</span>
                    <span className="font-semibold text-brand-700">{plan.tenant_count}</span>
                  </div>
                </div>

                {plan.stripe_price_id && (
                  <p className="mt-3 truncate text-xs text-gray-400" title={plan.stripe_price_id}>
                    Stripe: {plan.stripe_price_id}
                  </p>
                )}
              </div>
            ))
          ) : (
            <div className="col-span-full rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
              <p className="text-sm text-gray-500">No subscription plans yet.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
