'use client';

import { useEffect, useState, useCallback } from 'react';

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
}

const STATUS_OPTIONS = ['active', 'inactive', 'suspended', 'pending_subscription', 'past_due'];
const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  suspended: 'bg-red-100 text-red-700',
  pending_subscription: 'bg-amber-100 text-amber-700',
  past_due: 'bg-orange-100 text-orange-700',
};

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const perPage = 20;

  const fetchTenants = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (search) params.set('search', search);
    if (statusFilter) params.set('status', statusFilter);

    const res = await fetch(`/api/admin/tenants?${params}`);
    const json = await res.json();
    setTenants(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page, search, statusFilter]);

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

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
        <p className="mt-1 text-sm text-gray-500">Manage all businesses on the platform.</p>
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
        {(search || statusFilter) && (
          <button onClick={() => { setSearch(''); setStatusFilter(''); setPage(1); }} className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Clear
          </button>
        )}
      </div>

      {/* Table */}
      {loading ? (
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
            {tenants.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Business</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
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
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {tenant.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-900">{tenant.name}</p>
                            <p className="text-xs text-gray-400">{tenant.email ?? '—'}</p>
                          </div>
                        </div>
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
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(tenant.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => { setEditingId(tenant.id); setEditStatus(tenant.status); }}
                          className="text-sm font-medium text-brand-600 hover:text-brand-700"
                        >
                          Edit
                        </button>
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
    </div>
  );
}
