'use client';

import { useEffect, useState, useCallback } from 'react';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  expires_at: string | null;
  usage_count: number;
  usage_limit: number | null;
  is_lifetime: boolean;
  scope: 'per_customer' | 'per_booking';
  applicable_service_ids: string[] | null;
  applicable_staff_ids: string[] | null;
  created_at: string;
}

interface Service {
  id: string;
  name: string;
}

interface Staff {
  id: string;
  name: string;
}

interface CouponForm {
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: string;
  expires_at: string;
  usage_limit: string;
  is_lifetime: boolean;
  scope: 'per_customer' | 'per_booking';
  applicable_service_ids: string[];
  applicable_staff_ids: string[];
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function generateCode(): string {
  return 'BALKINA' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

function emptyForm(): CouponForm {
  return {
    code: generateCode(),
    discount_type: 'percentage',
    discount_value: '',
    expires_at: '',
    usage_limit: '',
    is_lifetime: false,
    scope: 'per_booking',
    applicable_service_ids: [],
    applicable_staff_ids: [],
  };
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Related data for multi-selects
  const [services, setServices] = useState<Service[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  /* ── Data fetching ──────────────────────────────────────────────────── */

  const fetchCoupons = useCallback(async () => {
    const res = await fetch('/api/coupons');
    const json = await res.json();
    setCoupons(json.data ?? []);
    setLoading(false);
  }, []);

  const fetchRelatedData = useCallback(async () => {
    const [servicesRes, staffRes] = await Promise.all([
      fetch('/api/services'),
      fetch('/api/staff'),
    ]);
    const servicesJson = await servicesRes.json();
    const staffJson = await staffRes.json();
    setServices(
      ((servicesJson.data ?? []) as Service[]).map((s) => ({ id: s.id, name: s.name }))
    );
    setStaff(
      ((staffJson.data ?? []) as Staff[]).map((s) => ({ id: s.id, name: s.name }))
    );
  }, []);

  useEffect(() => {
    fetchCoupons();
    fetchRelatedData();
  }, [fetchCoupons, fetchRelatedData]);

  /* ── Selection handlers ──────────────────────────────────────────────── */

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === coupons.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(coupons.map((c) => c.id));
    }
  }

  /* ── Form handlers ──────────────────────────────────────────────────── */

  function openNew() {
    setEditing(null);
    setForm(emptyForm());
    setShowForm(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code,
      discount_type: c.discount_type,
      discount_value: String(c.discount_value),
      expires_at: c.expires_at ? c.expires_at.split('T')[0] ?? '' : '',
      usage_limit: c.usage_limit ? String(c.usage_limit) : '',
      is_lifetime: c.is_lifetime ?? false,
      scope: c.scope ?? 'per_booking',
      applicable_service_ids: c.applicable_service_ids ?? [],
      applicable_staff_ids: c.applicable_staff_ids ?? [],
    });
    setShowForm(true);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this coupon?')) return;
    await fetch(`/api/coupons?id=${id}`, { method: 'DELETE' });
    fetchCoupons();
  }

  function toggleServiceId(id: string) {
    setForm((prev) => {
      const ids = prev.applicable_service_ids.includes(id)
        ? prev.applicable_service_ids.filter((sid) => sid !== id)
        : [...prev.applicable_service_ids, id];
      return { ...prev, applicable_service_ids: ids };
    });
  }

  function toggleStaffId(id: string) {
    setForm((prev) => {
      const ids = prev.applicable_staff_ids.includes(id)
        ? prev.applicable_staff_ids.filter((sid) => sid !== id)
        : [...prev.applicable_staff_ids, id];
      return { ...prev, applicable_staff_ids: ids };
    });
  }

  async function handleSubmit() {
    setError('');

    const discountNum = Number(form.discount_value);
    if (!discountNum || discountNum <= 0) {
      setError('Discount value must be greater than 0');
      return;
    }
    if (form.discount_type === 'percentage' && discountNum > 100) {
      setError('Percentage discount cannot exceed 100%');
      return;
    }

    setSaving(true);

    const body: Record<string, unknown> = {
      id: editing?.id,
      code: form.code.toUpperCase(),
      discount_type: form.discount_type,
      discount_value: discountNum,
      expires_at: form.is_lifetime ? null : form.expires_at ? new Date(form.expires_at).toISOString() : null,
      usage_limit: form.usage_limit ? Number(form.usage_limit) : null,
      is_lifetime: form.is_lifetime,
      scope: form.scope,
      applicable_service_ids: form.applicable_service_ids.length > 0 ? form.applicable_service_ids : null,
      applicable_staff_ids: form.applicable_staff_ids.length > 0 ? form.applicable_staff_ids : null,
    };

    const res = await fetch('/api/coupons', {
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
    fetchCoupons();
  }

  /* ── Shared form field classes ─────────────────────────────────────── */

  const inputClasses =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  /* ── List view ──────────────────────────────────────────────────────── */

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="mt-1 text-sm text-gray-500">Create and manage discount codes.</p>
        </div>
        <button
          onClick={openNew}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Create Coupon
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : coupons.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No coupons yet.</p>
            <button
              onClick={openNew}
              className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Create your first coupon
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.length === coupons.length && coupons.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                  />
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Code
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Discount
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Scope
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Services
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Usage
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                  Expires
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {coupons.map((c) => {
                const serviceCount = c.applicable_service_ids?.length ?? 0;
                return (
                  <tr
                    key={c.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openEdit(c)}
                  >
                    <td
                      className="whitespace-nowrap px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(c.id)}
                        onChange={() => toggleSelect(c.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 font-mono text-sm font-medium text-gray-900">
                      {c.code}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {c.discount_type === 'percentage'
                        ? `${c.discount_value}%`
                        : `$${c.discount_value.toFixed(2)}`}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          (c.scope ?? 'per_booking') === 'per_customer'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {(c.scope ?? 'per_booking') === 'per_customer' ? 'Per customer' : 'Per booking'}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {serviceCount === 0 ? (
                        <span className="text-gray-400">All</span>
                      ) : (
                        <span>
                          {serviceCount} service{serviceCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {c.usage_count}
                      {c.usage_limit ? ` / ${c.usage_limit}` : ''}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {c.is_lifetime
                        ? 'Lifetime'
                        : c.expires_at
                          ? new Date(c.expires_at).toLocaleDateString()
                          : 'Never'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Slide-in Panel */}
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setShowForm(false)} />
          <div
            className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[30%] sm:min-w-[380px]`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Coupon' : 'Create Coupon'}
              </h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="space-y-5">
                {editing ? (
                  /* ─── EDIT MODE: horizontal label-left, value-right, hover-to-edit ─── */
                  <>
                    {/* Code */}
                    <div className="group flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Code</span>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-900 group-hover:hidden">{form.code}</span>
                        <div className="hidden items-center gap-2 group-hover:flex">
                          <input
                            value={form.code}
                            onChange={(e) => setForm({ ...form, code: e.target.value })}
                            className="w-40 rounded-lg border border-gray-300 px-2 py-1 text-sm uppercase focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                          <button
                            type="button"
                            onClick={() => setForm({ ...form, code: generateCode() })}
                            className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-600 hover:bg-gray-50"
                          >
                            Generate
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Discount Type */}
                    <div className="group flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Discount Type</span>
                      <span className="text-sm text-gray-900 group-hover:hidden">
                        {form.discount_type === 'percentage' ? 'Percentage' : 'Fixed Amount'}
                      </span>
                      <div className="hidden group-hover:block">
                        <select
                          value={form.discount_type}
                          onChange={(e) =>
                            setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })
                          }
                          className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed Amount</option>
                        </select>
                      </div>
                    </div>

                    {/* Discount Value */}
                    <div className="group flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">
                        {form.discount_type === 'percentage' ? 'Discount (%)' : 'Discount ($)'}
                      </span>
                      <span className="text-sm text-gray-900 group-hover:hidden">
                        {form.discount_value || '0'}
                      </span>
                      <div className="hidden group-hover:block">
                        <input
                          type="number"
                          min="0"
                          step={form.discount_type === 'percentage' ? '1' : '0.01'}
                          value={form.discount_value}
                          onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                          className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    </div>

                    {/* Scope */}
                    <div className="group flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Scope</span>
                      <span className="text-sm text-gray-900 group-hover:hidden">
                        {form.scope === 'per_customer' ? 'Per customer' : 'Per booking'}
                      </span>
                      <div className="hidden items-center gap-4 group-hover:flex">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="edit-scope"
                            value="per_booking"
                            checked={form.scope === 'per_booking'}
                            onChange={() => setForm({ ...form, scope: 'per_booking' })}
                            className="h-3.5 w-3.5 border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-xs text-gray-700">Per booking</span>
                        </label>
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="radio"
                            name="edit-scope"
                            value="per_customer"
                            checked={form.scope === 'per_customer'}
                            onChange={() => setForm({ ...form, scope: 'per_customer' })}
                            className="h-3.5 w-3.5 border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-xs text-gray-700">Per customer</span>
                        </label>
                      </div>
                    </div>

                    {/* Lifetime / Expiry */}
                    <div className="group flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Expires</span>
                      <span className="text-sm text-gray-900 group-hover:hidden">
                        {form.is_lifetime
                          ? 'Lifetime'
                          : form.expires_at
                            ? new Date(form.expires_at).toLocaleDateString()
                            : 'Never'}
                      </span>
                      <div className="hidden items-center gap-2 group-hover:flex">
                        <label className="flex items-center gap-1.5 cursor-pointer">
                          <span className="text-xs text-gray-500">Lifetime</span>
                          <button
                            type="button"
                            role="switch"
                            aria-checked={form.is_lifetime}
                            onClick={() => setForm({ ...form, is_lifetime: !form.is_lifetime })}
                            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                              form.is_lifetime ? 'bg-brand-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                form.is_lifetime ? 'translate-x-4' : 'translate-x-0'
                              }`}
                            />
                          </button>
                        </label>
                        {!form.is_lifetime && (
                          <input
                            type="date"
                            value={form.expires_at}
                            onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                            className="rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                          />
                        )}
                      </div>
                    </div>

                    {/* Usage Limit */}
                    <div className="group flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-700">Usage Limit</span>
                      <span className="text-sm text-gray-900 group-hover:hidden">
                        {form.usage_limit || 'Unlimited'}
                      </span>
                      <div className="hidden group-hover:block">
                        <input
                          type="number"
                          min="1"
                          value={form.usage_limit}
                          onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                          placeholder="Unlimited"
                          className="w-28 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                        />
                      </div>
                    </div>

                    {/* Applicable Services */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Applicable Services{' '}
                        <span className="font-normal text-gray-400">
                          ({form.applicable_service_ids.length === 0 ? 'All services' : `${form.applicable_service_ids.length} selected`})
                        </span>
                      </label>
                      {services.length === 0 ? (
                        <p className="text-sm text-gray-400">No services found.</p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-3">
                          <div className="space-y-2">
                            {services.map((s) => (
                              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.applicable_service_ids.includes(s.id)}
                                  onChange={() => toggleServiceId(s.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                />
                                <span className="text-sm text-gray-700">{s.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Applicable Staff */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Applicable Staff{' '}
                        <span className="font-normal text-gray-400">
                          ({form.applicable_staff_ids.length === 0 ? 'All staff' : `${form.applicable_staff_ids.length} selected`})
                        </span>
                      </label>
                      {staff.length === 0 ? (
                        <p className="text-sm text-gray-400">No staff found.</p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-3">
                          <div className="space-y-2">
                            {staff.map((s) => (
                              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.applicable_staff_ids.includes(s.id)}
                                  onChange={() => toggleStaffId(s.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                />
                                <span className="text-sm text-gray-700">{s.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                  </>
                ) : (
                  /* ─── CREATE MODE: placeholders instead of labels ─── */
                  <>
                    {/* Code */}
                    <div>
                      <div className="flex gap-2">
                        <input
                          value={form.code}
                          onChange={(e) => setForm({ ...form, code: e.target.value })}
                          placeholder="Coupon Code"
                          className={`flex-1 uppercase ${inputClasses}`}
                        />
                        <button
                          type="button"
                          onClick={() => setForm({ ...form, code: generateCode() })}
                          className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
                        >
                          Generate
                        </button>
                      </div>
                    </div>

                    {/* Discount type + value */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <select
                          value={form.discount_type}
                          onChange={(e) =>
                            setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })
                          }
                          className={inputClasses}
                        >
                          <option value="percentage">Percentage</option>
                          <option value="fixed">Fixed Amount</option>
                        </select>
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          step={form.discount_type === 'percentage' ? '1' : '0.01'}
                          value={form.discount_value}
                          onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                          placeholder={form.discount_type === 'percentage' ? 'Discount (%)' : 'Discount ($)'}
                          className={inputClasses}
                        />
                      </div>
                    </div>

                    {/* Scope */}
                    <div>
                      <div className="flex items-center gap-6">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="panel-scope"
                            value="per_booking"
                            checked={form.scope === 'per_booking'}
                            onChange={() => setForm({ ...form, scope: 'per_booking' })}
                            className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-sm text-gray-700">Per booking</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name="panel-scope"
                            value="per_customer"
                            checked={form.scope === 'per_customer'}
                            onChange={() => setForm({ ...form, scope: 'per_customer' })}
                            className="h-4 w-4 border-gray-300 text-brand-600 focus:ring-brand-500"
                          />
                          <span className="text-sm text-gray-700">Per customer</span>
                        </label>
                      </div>
                    </div>

                    {/* Lifetime toggle + Expiry date + Usage limit */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="mb-2 flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <span className="text-xs text-gray-500">Lifetime</span>
                            <button
                              type="button"
                              role="switch"
                              aria-checked={form.is_lifetime}
                              onClick={() => setForm({ ...form, is_lifetime: !form.is_lifetime })}
                              className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 ${
                                form.is_lifetime ? 'bg-brand-600' : 'bg-gray-200'
                              }`}
                            >
                              <span
                                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                  form.is_lifetime ? 'translate-x-4' : 'translate-x-0'
                                }`}
                              />
                            </button>
                          </label>
                        </div>
                        {form.is_lifetime ? (
                          <div className="flex h-[38px] items-center rounded-lg border border-gray-200 bg-gray-50 px-3">
                            <span className="text-sm text-gray-400">Never expires</span>
                          </div>
                        ) : (
                          <input
                            type="date"
                            value={form.expires_at}
                            onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                            placeholder="Expiry Date"
                            className={inputClasses}
                          />
                        )}
                      </div>
                      <div>
                        <div className="mb-2 h-5" />
                        <input
                          type="number"
                          min="1"
                          value={form.usage_limit}
                          onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                          placeholder="Usage Limit (Unlimited)"
                          className={inputClasses}
                        />
                      </div>
                    </div>

                    {/* Applicable Services */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Applicable Services{' '}
                        <span className="font-normal text-gray-400">
                          ({form.applicable_service_ids.length === 0 ? 'All services' : `${form.applicable_service_ids.length} selected`})
                        </span>
                      </label>
                      {services.length === 0 ? (
                        <p className="text-sm text-gray-400">No services found.</p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-3">
                          <div className="space-y-2">
                            {services.map((s) => (
                              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.applicable_service_ids.includes(s.id)}
                                  onChange={() => toggleServiceId(s.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                />
                                <span className="text-sm text-gray-700">{s.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Applicable Staff */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Applicable Staff{' '}
                        <span className="font-normal text-gray-400">
                          ({form.applicable_staff_ids.length === 0 ? 'All staff' : `${form.applicable_staff_ids.length} selected`})
                        </span>
                      </label>
                      {staff.length === 0 ? (
                        <p className="text-sm text-gray-400">No staff found.</p>
                      ) : (
                        <div className="max-h-40 overflow-y-auto rounded-lg border border-gray-200 p-3">
                          <div className="space-y-2">
                            {staff.map((s) => (
                              <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={form.applicable_staff_ids.includes(s.id)}
                                  onChange={() => toggleStaffId(s.id)}
                                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                                />
                                <span className="text-sm text-gray-700">{s.name}</span>
                              </label>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    {error && <p className="text-sm text-red-600">{error}</p>}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex items-center border-t px-6 py-4">
              {editing && (
                <button
                  onClick={() => {
                    handleDelete(editing.id);
                    setShowForm(false);
                  }}
                  className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
              <div className={`flex gap-3 ${editing ? '' : 'ml-auto'}`}>
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update Coupon' : 'Create Coupon'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
