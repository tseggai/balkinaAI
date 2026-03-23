'use client';

import { useEffect, useState, useCallback } from 'react';

interface Customer {
  id: string;
  user_id: string | null;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  gender: string | null;
  profile_image_url: string | null;
  created_at: string;
}

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const perPage = 20;

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (search) params.set('search', search);

    const res = await fetch(`/api/admin/customers?${params}`);
    const json = await res.json();
    setCustomers(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [page, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const totalPages = Math.ceil(total / perPage);

  function getDisplayName(c: Customer): string {
    if (c.first_name || c.last_name) {
      return [c.first_name, c.last_name].filter(Boolean).join(' ');
    }
    return c.display_name ?? 'Unknown';
  }

  return (
    <div className="p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Customers</h1>
        <p className="mt-1 text-sm text-gray-500">All customers across the platform.</p>
      </div>

      {/* Search */}
      <div className="mt-6 flex items-center gap-3">
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, email, or phone..."
          className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
        {search && (
          <button onClick={() => { setSearch(''); setPage(1); }} className="text-sm font-medium text-brand-600 hover:text-brand-700">
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
            {customers.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Gender</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Auth</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {customers.map((customer) => (
                    <tr key={customer.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {customer.profile_image_url ? (
                            <img src={customer.profile_image_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                              {getDisplayName(customer).charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span className="text-sm font-medium text-gray-900">{getDisplayName(customer)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{customer.email ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-gray-600">{customer.phone ?? '—'}</td>
                      <td className="px-4 py-3">
                        {customer.gender ? (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium capitalize text-gray-600">
                            {customer.gender.replace('-', ' ')}
                          </span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {customer.user_id ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">Linked</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">Chat Only</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-400">
                        {new Date(customer.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-500">No customers found.</p>
              </div>
            )}
          </div>

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
