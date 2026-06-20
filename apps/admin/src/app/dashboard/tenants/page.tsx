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
  category_id: string | null;
  created_at: string;
  subscription_plans: { id: string; name: string } | null;
  subscription_plan_id: string | null;
  categories: { id: string; name: string } | null;
  location_count: number;
  staff_count: number;
  service_count: number;
  cities: string[];
}

interface Plan { id: string; name: string; }
interface Category { id: string; name: string; }

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
  { value: 'name:asc', label: 'Name A\u2013Z' },
  { value: 'name', label: 'Name Z\u2013A' },
  { value: 'avg_rating', label: 'Highest rated' },
  { value: 'review_count', label: 'Most reviews' },
];

const COUNTRIES = [
  { code: 'us', name: 'United States' }, { code: 'gb', name: 'United Kingdom' }, { code: 'ca', name: 'Canada' },
  { code: 'au', name: 'Australia' }, { code: 'de', name: 'Germany' }, { code: 'fr', name: 'France' },
  { code: 'es', name: 'Spain' }, { code: 'it', name: 'Italy' }, { code: 'nl', name: 'Netherlands' },
  { code: 'be', name: 'Belgium' }, { code: 'at', name: 'Austria' }, { code: 'ch', name: 'Switzerland' },
  { code: 'se', name: 'Sweden' }, { code: 'no', name: 'Norway' }, { code: 'dk', name: 'Denmark' },
  { code: 'fi', name: 'Finland' }, { code: 'pt', name: 'Portugal' }, { code: 'ie', name: 'Ireland' },
  { code: 'pl', name: 'Poland' }, { code: 'cz', name: 'Czech Republic' }, { code: 'gr', name: 'Greece' },
  { code: 'tr', name: 'Turkey' }, { code: 'ae', name: 'UAE' }, { code: 'sa', name: 'Saudi Arabia' },
  { code: 'in', name: 'India' }, { code: 'jp', name: 'Japan' }, { code: 'kr', name: 'South Korea' },
  { code: 'cn', name: 'China' }, { code: 'sg', name: 'Singapore' }, { code: 'my', name: 'Malaysia' },
  { code: 'th', name: 'Thailand' }, { code: 'br', name: 'Brazil' }, { code: 'mx', name: 'Mexico' },
  { code: 'ar', name: 'Argentina' }, { code: 'co', name: 'Colombia' }, { code: 'cl', name: 'Chile' },
  { code: 'za', name: 'South Africa' }, { code: 'ng', name: 'Nigeria' }, { code: 'eg', name: 'Egypt' },
  { code: 'ke', name: 'Kenya' }, { code: 'ma', name: 'Morocco' }, { code: 'il', name: 'Israel' },
  { code: 'ro', name: 'Romania' }, { code: 'bg', name: 'Bulgaria' }, { code: 'hr', name: 'Croatia' },
  { code: 'rs', name: 'Serbia' }, { code: 'me', name: 'Montenegro' }, { code: 'ba', name: 'Bosnia' },
  { code: 'si', name: 'Slovenia' }, { code: 'hu', name: 'Hungary' }, { code: 'sk', name: 'Slovakia' },
  { code: 'nz', name: 'New Zealand' }, { code: 'ph', name: 'Philippines' }, { code: 'id', name: 'Indonesia' },
  { code: 'vn', name: 'Vietnam' }, { code: 'pk', name: 'Pakistan' }, { code: 'bd', name: 'Bangladesh' },
  { code: 'lk', name: 'Sri Lanka' }, { code: 'qa', name: 'Qatar' }, { code: 'kw', name: 'Kuwait' },
  { code: 'bh', name: 'Bahrain' }, { code: 'om', name: 'Oman' }, { code: 'jo', name: 'Jordan' },
  { code: 'lb', name: 'Lebanon' }, { code: 'ge', name: 'Georgia' }, { code: 'am', name: 'Armenia' },
].sort((a, b) => a.name.localeCompare(b.name));

const selectCls = 'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const inputCls = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export default function TenantsPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [paymentsFilter, setPaymentsFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [sortOption, setSortOption] = useState('created_at');

  // Inline status edit (quick change)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);

  // Full edit modal
  const [editTenant, setEditTenant] = useState<Tenant | null>(null);
  const [editFields, setEditFields] = useState({ name: '', owner_name: '', email: '', phone: '', status: '', category_id: '', subscription_plan_id: '', payments_enabled: false });
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deleting, setDeleting] = useState<string | null>(null);

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkActing, setBulkActing] = useState(false);

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  function toggleSelectAll() {
    if (selectedIds.size === tenants.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(tenants.map(t => t.id)));
    }
  }
  async function handleBulkAction(action: string) {
    if (selectedIds.size === 0) return;
    const ids = Array.from(selectedIds);
    if (action === 'delete') {
      if (!confirm(`Delete ${ids.length} tenant(s) and ALL their data? This cannot be undone.`)) return;
      setBulkActing(true);
      for (const id of ids) {
        await fetch(`/api/admin/tenants?id=${id}`, { method: 'DELETE' });
      }
      setBulkActing(false);
      setSelectedIds(new Set());
      fetchTenants();
    } else {
      // Status change
      setBulkActing(true);
      for (const id of ids) {
        await fetch('/api/admin/tenants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: action }) });
      }
      setBulkActing(false);
      setSelectedIds(new Set());
      fetchTenants();
    }
  }

  // Bulk create
  const [bulkCount, setBulkCount] = useState(10);
  const [bulking, setBulking] = useState(false);
  const [bulkResult, setBulkResult] = useState<string | null>(null);
  const [showBulkConfig, setShowBulkConfig] = useState(false);
  type BulkLoc = { name: string; country: string; countryCode: string };
  const [bulkLocations, setBulkLocations] = useState<BulkLoc[]>([{ name: '', country: '', countryCode: '' }]);
  const [citySuggestions, setCitySuggestions] = useState<Record<number, { name: string; full: string }[]>>({});
  const [citySearchTimers, setCitySearchTimers] = useState<Record<number, ReturnType<typeof setTimeout>>>({});

  function updateBulkLoc(idx: number, field: keyof BulkLoc, value: string) {
    setBulkLocations(prev => prev.map((l, i) => i === idx ? { ...l, [field]: value } : l));
    // If changing country, clear city
    if (field === 'countryCode') {
      const entry = COUNTRIES.find(c => c.code === value);
      setBulkLocations(prev => prev.map((l, i) => i === idx ? { ...l, countryCode: value, country: entry?.name ?? '', name: '' } : l));
      setCitySuggestions(prev => ({ ...prev, [idx]: [] }));
    }
  }

  function handleCityInput(idx: number, value: string) {
    setBulkLocations(prev => prev.map((l, i) => i === idx ? { ...l, name: value } : l));
    // Debounce city autocomplete
    if (citySearchTimers[idx]) clearTimeout(citySearchTimers[idx]);
    if (value.length < 2) { setCitySuggestions(prev => ({ ...prev, [idx]: [] })); return; }
    const countryCode = bulkLocations[idx]?.countryCode ?? '';
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({ q: value });
      if (countryCode) params.set('country', countryCode);
      const res = await fetch(`/api/admin/geocode/cities?${params}`);
      const json = await res.json();
      setCitySuggestions(prev => ({ ...prev, [idx]: json.cities ?? [] }));
    }, 300);
    setCitySearchTimers(prev => ({ ...prev, [idx]: timer }));
  }

  function selectCity(idx: number, cityName: string) {
    setBulkLocations(prev => prev.map((l, i) => i === idx ? { ...l, name: cityName } : l));
    setCitySuggestions(prev => ({ ...prev, [idx]: [] }));
  }

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
    if (categoryFilter) params.set('category', categoryFilter);
    if (cityFilter) params.set('city', cityFilter);
    const parts = sortOption.split(':');
    params.set('sort', parts[0] ?? 'created_at');
    if (parts[1]) params.set('dir', parts[1]);

    const res = await fetch(`/api/admin/tenants?${params}`);
    const json = await res.json();
    if (!res.ok) {
      // Surface the real reason instead of silently showing an empty list
      // (e.g. 403 if the session isn't a platform_admin, or a 500 query error).
      setLoadError(json.error ? `${res.status}: ${json.error}` : `Failed to load tenants (HTTP ${res.status})`);
      setTenants([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoadError(null);
    setTenants(json.data ?? []);
    setTotal(json.total ?? 0);
    if (json.plans) setPlans(json.plans);
    if (json.categories) setCategories(json.categories);
    if (json.cities) setCities(json.cities);
    setLoading(false);
  }, [page, search, statusFilter, planFilter, paymentsFilter, categoryFilter, cityFilter, sortOption]);

  useEffect(() => { fetchTenants(); }, [fetchTenants]);

  // Quick status change (inline)
  async function handleStatusChange(id: string, newStatus: string) {
    setSaving(true);
    await fetch('/api/admin/tenants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: newStatus }) });
    setEditingId(null);
    setSaving(false);
    fetchTenants();
  }

  async function togglePayments(id: string, current: boolean) {
    await fetch('/api/admin/tenants', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, payments_enabled: !current }) });
    fetchTenants();
  }

  // Full edit modal
  function openEditModal(tenant: Tenant) {
    setEditTenant(tenant);
    setEditFields({
      name: tenant.name,
      owner_name: tenant.owner_name ?? '',
      email: tenant.email ?? '',
      phone: tenant.phone ?? '',
      status: tenant.status,
      category_id: tenant.category_id ?? '',
      subscription_plan_id: tenant.subscription_plan_id ?? '',
      payments_enabled: tenant.payments_enabled,
    });
    setEditError('');
  }

  async function handleEditSave() {
    if (!editTenant) return;
    if (!editFields.name || !editFields.owner_name || !editFields.email) {
      setEditError('Name, owner name, and email are required.');
      return;
    }
    setEditSaving(true);
    setEditError('');
    const res = await fetch('/api/admin/tenants', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editTenant.id,
        name: editFields.name,
        owner_name: editFields.owner_name,
        email: editFields.email,
        phone: editFields.phone || null,
        status: editFields.status,
        category_id: editFields.category_id || null,
        subscription_plan_id: editFields.subscription_plan_id || null,
        payments_enabled: editFields.payments_enabled,
      }),
    });
    const json = await res.json();
    setEditSaving(false);
    if (!res.ok) {
      setEditError(json.error ?? 'Failed to update tenant');
      return;
    }
    setEditTenant(null);
    fetchTenants();
  }

  // Delete tenant
  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}" and all its locations, staff, services, appointments, and reviews? This cannot be undone.`)) return;
    setDeleting(id);
    const res = await fetch(`/api/admin/tenants?id=${id}`, { method: 'DELETE' });
    setDeleting(null);
    if (res.ok) {
      fetchTenants();
    } else {
      const json = await res.json();
      alert(`Failed to delete: ${json.error}`);
    }
  }

  // Bulk create
  async function handleBulkCreate() {
    setBulking(true);
    setBulkResult(null);
    const locations = bulkLocations.filter(l => l.name).map(l => ({ name: l.name, country: l.country || undefined }));
    const res = await fetch('/api/admin/tenants/bulk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ count: bulkCount, with_staff: true, with_services: true, locations: locations.length > 0 ? locations : undefined }) });
    const json = await res.json();
    setBulking(false);
    setShowBulkConfig(false);
    if (res.ok) {
      setBulkResult(`Created ${json.created} test tenants${locations.length > 0 ? ` in ${locations.map(l => l.name).join(', ')}` : ' with random locations'}.`);
      fetchTenants();
    } else {
      setBulkResult(`Error: ${json.error}`);
    }
  }

  const hasFilters = search || statusFilter || planFilter || paymentsFilter || categoryFilter || cityFilter || sortOption !== 'created_at';
  const totalPages = Math.ceil(total / perPage);
  const clearFilters = () => { setSearch(''); setStatusFilter(''); setPlanFilter(''); setPaymentsFilter(''); setCategoryFilter(''); setCityFilter(''); setSortOption('created_at'); setPage(1); };

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Tenants</h1>
          <p className="mt-1 text-sm text-gray-500">{total} business{total !== 1 ? 'es' : ''} on the platform</p>
        </div>
        <button onClick={() => setShowBulkConfig(true)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Bulk Create Test Data</button>
      </div>

      {/* Filters — Row 1: search + dropdowns */}
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <input type="text" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} placeholder="Search by name, email, owner..." className="w-72 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
        </select>
        <select value={planFilter} onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All Plans</option>
          {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <select value={categoryFilter} onChange={(e) => { setCategoryFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All Categories</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select value={cityFilter} onChange={(e) => { setCityFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All Cities</option>
          {cities.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select value={paymentsFilter} onChange={(e) => { setPaymentsFilter(e.target.value); setPage(1); }} className={selectCls}>
          <option value="">All Payment Status</option>
          <option value="true">Payments Enabled</option>
          <option value="false">Payments Disabled</option>
        </select>
        <select value={sortOption} onChange={(e) => { setSortOption(e.target.value); setPage(1); }} className={selectCls}>
          {SORT_OPTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        {hasFilters && <button onClick={clearFilters} className="text-sm font-medium text-brand-600 hover:text-brand-700">Clear all</button>}
      </div>

      {bulkResult && (
        <div className="mt-4 flex items-center justify-between rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
          <span>{bulkResult}</span>
          <button onClick={() => setBulkResult(null)} className="font-medium hover:text-blue-900">Dismiss</button>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg bg-brand-50 border border-brand-200 px-4 py-2.5">
          <span className="text-sm font-medium text-brand-700">{selectedIds.size} selected</span>
          <div className="h-4 w-px bg-brand-200" />
          <button onClick={() => handleBulkAction('active')} disabled={bulkActing} className="rounded-md bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">Set Active</button>
          <button onClick={() => handleBulkAction('suspended')} disabled={bulkActing} className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50">Suspend</button>
          <button onClick={() => handleBulkAction('inactive')} disabled={bulkActing} className="rounded-md bg-gray-600 px-3 py-1 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50">Deactivate</button>
          <button onClick={() => handleBulkAction('delete')} disabled={bulkActing} className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50">Delete</button>
          <button onClick={() => setSelectedIds(new Set())} className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700">Clear selection</button>
          {bulkActing && <div className="h-4 w-4 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />}
        </div>
      )}

      {/* Table */}
      {loadError ? (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          Couldn&apos;t load tenants — {loadError}.
          {loadError.startsWith('403') ? ' Your session isn’t a platform_admin (this does not affect which tenants exist).' : ''}
          {loadError.startsWith('401') ? ' Your admin session expired — sign in again.' : ''}
        </div>
      ) : null}

      {loading ? (
        <div className="mt-8 flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" /></div>
      ) : (
        <>
          <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white">
            {tenants.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input type="checkbox" checked={selectedIds.size === tenants.length && tenants.length > 0} onChange={toggleSelectAll} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Business</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Owner</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Plan</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Cities</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Loc</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Staff</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Svc</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Pay</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Rating</th>
                    <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {tenants.map(t => (
                    <tr key={t.id} className={`hover:bg-gray-50 ${selectedIds.has(t.id) ? 'bg-brand-50' : ''}`}>
                      <td className="w-10 px-4 py-3">
                        <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggleSelect(t.id)} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                      </td>
                      <td className="px-4 py-3">
                        <button onClick={() => router.push(`/dashboard/tenants/${t.id}`)} className="flex items-center gap-2 text-left">
                          {t.logo_url ? (
                            <img src={t.logo_url} alt={t.name} className="h-8 w-8 shrink-0 rounded-full object-cover" />
                          ) : (
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">{t.name.charAt(0).toUpperCase()}</div>
                          )}
                          <div>
                            <p className="text-sm font-medium text-gray-900 hover:text-brand-600">{t.name}</p>
                            <p className="text-xs text-gray-400">{t.email ?? '\u2014'}</p>
                          </div>
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">{t.owner_name ?? '\u2014'}</td>
                      <td className="px-4 py-3">
                        {t.categories ? (
                          <span className="inline-flex rounded-full bg-purple-50 px-2 py-0.5 text-xs font-medium text-purple-700">{t.categories.name}</span>
                        ) : <span className="text-xs text-gray-400">\u2014</span>}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700">{t.subscription_plans?.name ?? 'No Plan'}</span>
                      </td>
                      <td className="px-4 py-3">
                        {editingId === t.id ? (
                          <div className="flex items-center gap-1">
                            <select value={editStatus} onChange={e => setEditStatus(e.target.value)} className="rounded border border-gray-300 px-2 py-1 text-xs">
                              {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                            </select>
                            <button onClick={() => handleStatusChange(t.id, editStatus)} disabled={saving} className="rounded bg-brand-600 px-2 py-1 text-xs text-white hover:bg-brand-700 disabled:opacity-50">Save</button>
                            <button onClick={() => setEditingId(null)} className="rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300">Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingId(t.id); setEditStatus(t.status); }} className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STATUS_BADGE[t.status] ?? 'bg-gray-100 text-gray-700'}`}>
                            {t.status.replace('_', ' ')}
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {t.cities.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {t.cities.slice(0, 2).map(c => <span key={c} className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{c}</span>)}
                            {t.cities.length > 2 && <span className="text-xs text-gray-400">+{t.cities.length - 2}</span>}
                          </div>
                        ) : <span className="text-xs text-gray-400">\u2014</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{t.location_count}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{t.staff_count}</td>
                      <td className="px-4 py-3 text-center text-sm text-gray-600">{t.service_count}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => togglePayments(t.id, t.payments_enabled)} className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${t.payments_enabled ? 'bg-brand-600' : 'bg-gray-300'}`}>
                          <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${t.payments_enabled ? 'translate-x-4.5' : 'translate-x-0.5'}`} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {t.avg_rating !== null ? <span>{t.avg_rating.toFixed(1)} ({t.review_count})</span> : '\u2014'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <button onClick={() => router.push(`/dashboard/tenants/${t.id}`)} className="text-sm font-medium text-gray-600 hover:text-gray-800">View</button>
                          <button onClick={() => openEditModal(t)} className="text-sm font-medium text-brand-600 hover:text-brand-700">Edit</button>
                          <button onClick={() => handleDelete(t.id, t.name)} disabled={deleting === t.id} className="text-sm font-medium text-red-500 hover:text-red-700 disabled:opacity-50">{deleting === t.id ? '...' : 'Delete'}</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="px-6 py-16 text-center"><p className="text-sm text-gray-500">No tenants found.</p></div>
            )}
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">Showing {(page - 1) * perPage + 1}\u2013{Math.min(page * perPage, total)} of {total}</p>
              <div className="flex gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Previous</button>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">Next</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Edit Tenant Modal */}
      {editTenant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">Edit Tenant</h2>
            <p className="mt-1 text-sm text-gray-500">Update business details. Changes take effect immediately.</p>

            {editError && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{editError}</div>}

            <div className="mt-4 space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Business Name *</label>
                <input type="text" value={editFields.name} onChange={e => setEditFields({ ...editFields, name: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Owner Name *</label>
                  <input type="text" value={editFields.owner_name} onChange={e => setEditFields({ ...editFields, owner_name: e.target.value })} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Email *</label>
                  <input type="email" value={editFields.email} onChange={e => setEditFields({ ...editFields, email: e.target.value })} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <input type="tel" value={editFields.phone} onChange={e => setEditFields({ ...editFields, phone: e.target.value })} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Category</label>
                  <select value={editFields.category_id} onChange={e => setEditFields({ ...editFields, category_id: e.target.value })} className={inputCls}>
                    <option value="">No Category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Plan</label>
                  <select value={editFields.subscription_plan_id} onChange={e => setEditFields({ ...editFields, subscription_plan_id: e.target.value })} className={inputCls}>
                    <option value="">No Plan</option>
                    {plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Status</label>
                <select value={editFields.status} onChange={e => setEditFields({ ...editFields, status: e.target.value })} className={inputCls}>
                  {STATUS_OPTIONS.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <input type="checkbox" id="edit_payments" checked={editFields.payments_enabled} onChange={e => setEditFields({ ...editFields, payments_enabled: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                <label htmlFor="edit_payments" className="text-sm text-gray-700">Enable payments</label>
              </div>
            </div>

            <div className="mt-6 flex justify-between">
              <button onClick={() => { if (editTenant) { handleDelete(editTenant.id, editTenant.name); setEditTenant(null); } }} className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50">Delete Tenant</button>
              <div className="flex gap-3">
                <button onClick={() => setEditTenant(null)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
                <button onClick={handleEditSave} disabled={editSaving} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Create Modal */}
      {showBulkConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-bold text-gray-900">Bulk Create Test Tenants</h2>
            <p className="mt-1 text-sm text-gray-500">Create multiple test businesses with staff, services, and location assignments.</p>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700">Number of tenants</label>
              <input type="number" min={1} max={50} value={bulkCount} onChange={e => setBulkCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))} className="mt-1 w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div className="mt-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium text-gray-700">Locations <span className="text-gray-400 font-normal">(each tenant gets all locations listed below)</span></label>
                <button type="button" onClick={() => setBulkLocations([...bulkLocations, { name: '', country: '', countryCode: '' }])} className="text-sm font-medium text-brand-600 hover:text-brand-700">+ Add location</button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Leave empty to use random default cities. Coordinates and timezone are auto-resolved.</p>
              <div className="mt-2 space-y-3">
                {bulkLocations.map((loc, idx) => (
                  <div key={idx} className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-500">Location {idx + 1}</span>
                      {bulkLocations.length > 1 && <button type="button" onClick={() => { setBulkLocations(bulkLocations.filter((_, i) => i !== idx)); setCitySuggestions(prev => { const n = { ...prev }; delete n[idx]; return n; }); }} className="text-xs text-red-500 hover:text-red-700">Remove</button>}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <select value={loc.countryCode} onChange={e => updateBulkLoc(idx, 'countryCode', e.target.value)} className="rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none">
                        <option value="">Select country</option>
                        {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                      <div className="relative">
                        <input
                          type="text"
                          placeholder={loc.countryCode ? 'Search city...' : 'Select country first'}
                          value={loc.name}
                          onChange={e => handleCityInput(idx, e.target.value)}
                          disabled={!loc.countryCode}
                          className="w-full rounded border border-gray-300 px-2 py-1.5 text-sm focus:border-brand-500 focus:outline-none disabled:bg-gray-100 disabled:text-gray-400"
                        />
                        {(citySuggestions[idx]?.length ?? 0) > 0 && (
                          <div className="absolute z-10 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-40 overflow-y-auto">
                            {citySuggestions[idx]?.map((s, i) => (
                              <button key={i} type="button" onClick={() => selectCity(idx, s.name)} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100">
                                <span className="font-medium">{s.name}</span>
                                <span className="ml-1 text-xs text-gray-400">{s.full}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="text-xs text-gray-400 self-center">Quick add:</span>
                {[
                  { name: 'Valencia', country: 'Spain', countryCode: 'es' },
                  { name: 'Berlin', country: 'Germany', countryCode: 'de' },
                  { name: 'Tivat', country: 'Montenegro', countryCode: 'me' },
                  { name: 'San Francisco', country: 'United States', countryCode: 'us' },
                  { name: 'Dubai', country: 'UAE', countryCode: 'ae' },
                  { name: 'London', country: 'United Kingdom', countryCode: 'gb' },
                ].map(preset => (
                  <button key={preset.name} type="button" onClick={() => { const idx = bulkLocations.findIndex(l => !l.name); if (idx >= 0) { setBulkLocations(prev => prev.map((l, i) => i === idx ? preset : l)); } else { setBulkLocations(prev => [...prev, preset]); } }} className="rounded-full border border-gray-300 bg-white px-2.5 py-1 text-xs text-gray-600 hover:bg-gray-100 hover:border-gray-400">{preset.name}</button>
                ))}
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowBulkConfig(false)} className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">Cancel</button>
              <button onClick={handleBulkCreate} disabled={bulking} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{bulking ? 'Creating...' : `Create ${bulkCount} Tenants`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
