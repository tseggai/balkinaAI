'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface Tenant {
  id: string;
  name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  status: string;
  payments_enabled: boolean;
  avg_rating: number | null;
  review_count: number;
  logo_url: string | null;
  created_at: string;
  subscription_plans: { id: string; name: string } | null;
  location_count: number;
  staff_count: number;
  service_count: number;
}

interface Plan {
  id: string;
  name: string;
}

const STATUS_OPTIONS = ['active', 'inactive', 'suspended', 'pending_subscription', 'past_due'];
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  suspended: 'bg-red-100 text-red-700',
  pending_subscription: 'bg-amber-100 text-amber-700',
  past_due: 'bg-orange-100 text-orange-700',
};

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Newest first' },
  { value: 'created_at:asc', label: 'Oldest first' },
  { value: 'name:asc', label: 'Name A–Z' },
  { value: 'name', label: 'Name Z–A' },
  { value: 'avg_rating', label: 'Highest rated' },
  { value: 'review_count', label: 'Most reviews' },
];

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [paymentsFilter, setPaymentsFilter] = useState('');
  const [sortOption, setSortOption] = useState('created_at');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [bulkCount, setBulkCount] = useState(10);
  const [bulking, setBulking] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [showBulkConfig, setShowBulkConfig] = useState(false);
  type BulkLoc = { name: string; lat: string; lng: string; tz: string; address: string };
  const [bulkLocations, setBulkLocations] = useState<BulkLoc[]>([
    { name: '', lat: '', lng: '', tz: '', address: '' },
  ]);
  const updateBulkLoc = (idx: number, field: keyof BulkLoc, value: string) => {
    setBulkLocations(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
  };
  const [newTenant, setNewTenant] = useState({
    name: '', owner_name: '', email: '', phone: '', category_id: '', subscription_plan_id: '', status: 'active', payments_enabled: false,
  });
  const perPage = 20;

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);
    if (planFilter) params.set('plan', planFilter);
    if (paymentsFilter) params.set('payments', paymentsFilter);

    // Parse sort option (e.g. "name:asc" or "created_at")
    const parts = sortOption.split(':');
    params.set('sort', parts[0] ?? 'created_at');
    if (parts[1]) params.set('dir', parts[1]);

    const res = await fetch(`/api/admin/tenants?${params}`);
    const json = await res.json();
    setTenants(json.data ?? []);
    setTotal(json.total ?? 0);
    if (json.plans) setPlans(json.plans);
    setLoading(false);
  }, [page, search, statusFilter, planFilter, paymentsFilter, sortOption]);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  async function handleStatusChange(id: string, newStatus: string) {
    setSaving(true);
    await fetch('/api/admin/tenants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status: newStatus }),
    });
    setEditingId(null);
    setSaving(false);
    fetchTenants();
  }

  async function togglePayments(id: string, current: boolean) {
    await fetch('/api/admin/tenants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, payments_enabled: !current }),
    });
    fetchTenants();
  }

  async function handleCreate() {
    if (!newTenant.name || !newTenant.owner_name || !newTenant.email) {
      setCreateError('Name, owner name, and email are required.');
      return;
    }
    setCreating(true);
    setCreateError('');
    const res = await fetch('/api/admin/tenants', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newTenant),
    });
    const json = await res.json();
    if (!res.ok) {
      setCreateError(json.error ?? 'Failed to create tenant');
      setCreating(false);
      return;
    }
    setShowCreate(false);
    setNewTenant({ name: '', owner_name: '', email: '', phone: '', category_id: '', subscription_plan_id: '', status: 'active', payments_enabled: false });
    setCreating(false);
    fetchTenants();
  }

  async function handleBulkCreate() {
    setBulking(true);
    setBulkResult(null);

    // Build locations array from non-empty entries
    const locations = bulkLocations
      .filter(l => l.name && l.lat && l.lng && l.tz)
      .map(l => ({ name: l.name, lat: parseFloat(l.lat), lng: parseFloat(l.lng), tz: l.tz, address: l.address || undefined }));

    const res = await fetch('/api/admin/tenants/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        count: bulkCount,
        with_staff: true,
        with_services: true,
        locations: locations.length > 0 ? locations : undefined,
      }),
    });
    const json = await res.json();
    setBulking(false);
    setShowBulkConfig(false);
    if (res.ok) {
      const locSummary = locations.length > 0
        ? ` in ${locations.map(l => l.name).join(', ')}`
        : ' with random locations';
      setBulkResult(`Created ${json.created} test tenants${locSummary}.`);
      fetchTenants();
    } else {
      setBulkResult(`Error: ${json.error}`);
    }
  }

  const hasFilters = search || statusFilter || planFilter || paymentsFilter || sortOption !== 'created_at';
  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">
            {total} business{total !== 1 ? 'es' : ''} on the platform
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowBulkConfig(true)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Bulk Create
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            Add Tenant
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, email, owner..."
          className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace('_', ' ')}</option>
          ))}
        </select>
        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All Plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
        <select
          value={paymentsFilter}
          onChange={(e) => { setPaymentsFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          <option value="">All Payment Status</option>
          <option value="true">Payments Enabled</option>
          <option value="false">Payments Disabled</option>
        </select>
        <select
          value={sortOption}
          onChange={(e) => { setSortOption(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        >
          {SORT_OPTIONS.map((s) => (
            <option key={s.value} value={s.value}>{s.label}</option>
          ))}
        </select>
        {hasFilters && (
          <button
            onClick={() => { setSearch(''); setStatusFilter(''); setPlanFilter(''); setPaymentsFilter(''); setSortOption('created_at'); setPage(1); }}
            className="text-sm font-medium text-brand-600 hover:text-brand-700"
          >
            Clear all
          </button>
        )}
      </div>

      {bulkResult && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
          <span>{bulkResult}</span>
          <button onClick={() => setBulkResult(null)} className="font-medium hover:text-blue-900">Dismiss</button>
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            {tenants.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Business</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Loc</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Staff</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Svc</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Payments</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Rating</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenants.map((tenant) => (
                    <tr key={tenant.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button onClick={() => router.push(`/dashboard/tenants/${tenant.id}`)} className="flex items-center gap-2 text-left">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {tenant.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900 hover:text-brand-600">{tenant.name}</p>
                            <p className="text-xs text-gray-400">{tenant.email ?? '—'}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{tenant.owner_name ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">
                          {tenant.subscription_plans?.name ?? 'No Plan'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === tenant.id ? (
                          <div className="flex items-center gap-1">
                            <select
                              value={editStatus}
                              onChange={(e) => setEditStatus(e.target.value)}
                              className="rounded border border-gray-300 px-2 py-1 text-xs"
                            >
                              {STATUS_OPTIONS.map((s) => (
                                <option key={s} value={s}>{s.replace('_', ' ')}</option>
                              ))}
                            </select>
                            <button
                              onClick={() => handleStatusChange(tenant.id, editStatus)}
                              disabled={saving}
                              className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-50"
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingId(null)}
                              className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[tenant.status] ?? 'bg-gray-100 text-gray-700'}`}>
                            {tenant.status.replace('_', ' ')}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{tenant.location_count}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{tenant.staff_count}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{tenant.service_count}</td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => togglePayments(tenant.id, tenant.payments_enabled)}
                          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                            tenant.payments_enabled ? 'bg-brand-600' : 'bg-gray-300'
                          }`}
                        >
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            tenant.payments_enabled ? 'translate-x-4.5' : 'translate-x-0.5'
                          }`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {tenant.avg_rating !== null ? (
                          <span>{tenant.avg_rating.toFixed(1)} ({tenant.review_count})</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400 whitespace-nowrap">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button
                            onClick={() => router.push(`/dashboard/tenants/${tenant.id}`)}
                            className="text-sm font-medium text-gray-600 hover:text-gray-800"
                          >
                            View
                          </button>
                          <button
                            onClick={() => { setEditingId(tenant.id); setEditStatus(tenant.status); }}
                            className="text-sm font-medium text-brand-600 hover:text-brand-700"
                          >
                            Edit
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-500">No tenants found.</p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total}
              </p>
              <div className="flex gap-2">
                <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Previous
                </button>
                <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Create Tenant Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl">
            <h2 className="text-lg font-bold text-gray-900">Add Tenant</h2>
            <p className="mt-1 text-sm text-gray-500">Create a new business on the platform.</p>

            {createError && (
              <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{createError}</div>
            )}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Business Name *</label>
                <input
                  type="text"
                  value={newTenant.name}
                  onChange={(e) => setNewTenant({ ...newTenant, name: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Owner Name *</label>
                  <input
                    type="text"
                    value={newTenant.owner_name}
                    onChange={(e) => setNewTenant({ ...newTenant, owner_name: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input
                    type="email"
                    value={newTenant.email}
                    onChange={(e) => setNewTenant({ ...newTenant, email: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input
                  type="tel"
                  value={newTenant.phone}
                  onChange={(e) => setNewTenant({ ...newTenant, phone: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Plan</label>
                  <select
                    value={newTenant.subscription_plan_id}
                    onChange={(e) => setNewTenant({ ...newTenant, subscription_plan_id: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    <option value="">No Plan</option>
                    {plans.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Status</label>
                  <select
                    value={newTenant.status}
                    onChange={(e) => setNewTenant({ ...newTenant, status: e.target.value })}
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>{s.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="payments_enabled"
                  checked={newTenant.payments_enabled}
                  onChange={(e) => setNewTenant({ ...newTenant, payments_enabled: e.target.checked })}
                  className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                />
                <label htmlFor="payments_enabled" className="text-sm text-gray-700">Enable payments</label>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => { setShowCreate(false); setCreateError(''); }}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Tenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">Bulk Create Test Tenants</h2>
            <p className="mt-1 text-sm text-gray-500">
              Create multiple test businesses with staff, services, and location assignments.
              Specify locations so testers in those areas can discover them.
            </p>

            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Number of tenants</label>
              <input
                type="number"
                min={1}
                max={50}
                value={bulkCount}
                onChange={(e) => setBulkCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                className="mt-1 w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>

            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">
                  Locations <span className="text-gray-400 font-normal">(each tenant gets all locations listed below)</span>
                </label>
                <button
                  type="button"
                  onClick={() => setBulkLocations([...bulkLocations, { name: '', lat: '', lng: '', tz: '', address: '' }])}
                  className="text-sm font-medium text-brand-600 hover:text-brand-700"
                >
                  + Add location
                </button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Leave empty to use random default cities. Fill in to target specific areas for testers.</p>

              <div className="mt-2 space-y-3">
                {bulkLocations.map((loc, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">Location {idx + 1}</span>
                      {bulkLocations.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setBulkLocations(bulkLocations.filter((_, i) => i !== idx))}
                          className="text-xs text-red-500 hover:text-red-700"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="City name (e.g. Valencia)"
                        value={loc.name}
                        onChange={(e) => updateBulkLoc(idx, 'name', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Timezone (e.g. Europe/Madrid)"
                        value={loc.tz}
                        onChange={(e) => updateBulkLoc(idx, 'tz', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Latitude (e.g. 39.4699)"
                        value={loc.lat}
                        onChange={(e) => updateBulkLoc(idx, 'lat', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                      />
                      <input
                        type="text"
                        placeholder="Longitude (e.g. -0.3763)"
                        value={loc.lng}
                        onChange={(e) => updateBulkLoc(idx, 'lng', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Address (optional, e.g. Carrer de Colón 42, Valencia)"
                      value={loc.address}
                      onChange={(e) => updateBulkLoc(idx, 'address', e.target.value)}
                      className="mt-2 w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                    />
                  </div>
                ))}
              </div>

              {/* Preset buttons for common test locations */}
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-gray-400 self-center">Quick add:</span>
                {[
                  { name: 'Valencia', lat: '39.4699', lng: '-0.3763', tz: 'Europe/Madrid', address: '' },
                  { name: 'Berlin', lat: '52.5200', lng: '13.4050', tz: 'Europe/Berlin', address: '' },
                  { name: 'Tivat', lat: '42.4357', lng: '18.6936', tz: 'Europe/Amsterdam', address: '' },
                  { name: 'San Francisco', lat: '37.7749', lng: '-122.4194', tz: 'America/Los_Angeles', address: '' },
                  { name: 'Dubai', lat: '25.2048', lng: '55.2708', tz: 'Asia/Dubai', address: '' },
                  { name: 'London', lat: '51.5074', lng: '-0.1278', tz: 'Europe/London', address: '' },
                ].map((preset) => (
                  <button
                    key={preset.name}
                    type="button"
                    onClick={() => {
                      const idx = bulkLocations.findIndex(l => !l.name && !l.lat && !l.lng && !l.tz);
                      if (idx >= 0) {
                        setBulkLocations(prev => prev.map((l, i) => i === idx ? preset : l));
                      } else {
                        setBulkLocations(prev => [...prev, preset]);
                      }
                    }}
                    className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:border-gray-400"
                  >
                    {preset.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowBulkConfig(false)}
                className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleBulkCreate}
                disabled={bulking}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {bulking ? 'Creating...' : `Create ${bulkCount} Tenants`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
