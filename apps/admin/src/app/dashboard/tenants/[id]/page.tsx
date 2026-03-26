'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';

// ── Types ────────────────────────────────────────────────────────────────────

interface TenantDetail {
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
  stripe_customer_id: string | null;
  stripe_account_id: string | null;
  subscription_plans: { id: string; name: string; price_monthly: number; max_staff: number; max_locations: number } | null;
  categories: { id: string; name: string } | null;
}

interface Location {
  id: string;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  phone: string | null;
  description: string | null;
  image_url: string | null;
  created_at: string;
}

interface Staff {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  status: string | null;
  requires_approval: boolean;
  created_at: string;
}

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description: string | null;
  image_url: string | null;
  visibility: string;
  deposit_enabled: boolean;
  deposit_amount: number | null;
  deposit_type: string | null;
  service_category: string | null;
  service_subcategory: string | null;
  created_at: string;
}

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number | null;
  created_at: string;
  services: { name: string } | null;
  staff: { name: string } | null;
  customers: { display_name: string | null; email: string | null } | null;
  tenant_locations: { name: string } | null;
}

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  customers: { display_name: string | null } | null;
  staff: { name: string } | null;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: string;
  discount_value: number;
  expires_at: string | null;
  usage_count: number;
  usage_limit: number | null;
  created_at: string;
}

interface Stats {
  total_appointments: number;
  completed_appointments: number;
  total_revenue: number;
  pending_appointments: number;
  customer_count: number;
  location_count: number;
  staff_count: number;
  service_count: number;
  review_count: number;
}

interface TenantData {
  tenant: TenantDetail;
  locations: Location[];
  staff: Staff[];
  services: Service[];
  appointments: Appointment[];
  reviews: Review[];
  coupons: Coupon[];
  staff_locations: { staff_id: string; location_id: string }[];
  service_staff: { service_id: string; staff_id: string }[];
  service_locations: { service_id: string; location_id: string }[];
  stats: Stats;
}

const TABS = ['Overview', 'Locations', 'Staff', 'Services', 'Customers', 'Appointments', 'Reviews', 'Settings'] as const;
type Tab = typeof TABS[number];

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-700',
  suspended: 'bg-red-100 text-red-700',
  pending_subscription: 'bg-amber-100 text-amber-700',
  past_due: 'bg-orange-100 text-orange-700',
};

const APPT_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  confirmed: 'bg-blue-100 text-blue-700',
  approved: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-700',
  no_show: 'bg-gray-100 text-gray-700',
};

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function formatDateTime(s: string) {
  return new Date(s).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

// ── Component ────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const tenantId = params.id as string;

  const [data, setData] = useState<TenantData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Overview');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/tenants/${tenantId}`);
      if (!res.ok) {
        setError('Tenant not found');
        setLoading(false);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setError('Failed to load tenant');
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-32">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center">
        <p className="text-lg text-gray-500">{error ?? 'Not found'}</p>
        <button onClick={() => router.push('/dashboard/tenants')} className="mt-4 text-brand-600 hover:underline">Back to tenants</button>
      </div>
    );
  }

  const { tenant, locations, staff, services, appointments, reviews, coupons, staff_locations, service_staff, service_locations, stats } = data;

  // Build lookup maps
  const locationMap = new Map(locations.map(l => [l.id, l]));
  const staffMap = new Map(staff.map(s => [s.id, s]));
  const _serviceMap = new Map(services.map(s => [s.id, s]));

  // Staff → locations
  const staffToLocations = new Map<string, string[]>();
  for (const sl of staff_locations) {
    const arr = staffToLocations.get(sl.staff_id) ?? [];
    arr.push(locationMap.get(sl.location_id)?.name ?? sl.location_id);
    staffToLocations.set(sl.staff_id, arr);
  }

  // Service → staff
  const serviceToStaff = new Map<string, string[]>();
  for (const ss of service_staff) {
    const arr = serviceToStaff.get(ss.service_id) ?? [];
    arr.push(staffMap.get(ss.staff_id)?.name ?? ss.staff_id);
    serviceToStaff.set(ss.service_id, arr);
  }

  // Service → locations
  const serviceToLocations = new Map<string, string[]>();
  for (const sl of service_locations) {
    const arr = serviceToLocations.get(sl.service_id) ?? [];
    arr.push(locationMap.get(sl.location_id)?.name ?? sl.location_id);
    serviceToLocations.set(sl.service_id, arr);
  }

  // Location → staff count
  const locationStaffCount = new Map<string, number>();
  for (const sl of staff_locations) {
    locationStaffCount.set(sl.location_id, (locationStaffCount.get(sl.location_id) ?? 0) + 1);
  }

  // Unique customers from appointments
  const customerMap = new Map<string, { name: string; email: string | null; bookings: number }>();
  for (const appt of appointments) {
    const name = appt.customers?.display_name ?? 'Unknown';
    const email = appt.customers?.email ?? null;
    const key = email ?? name;
    const existing = customerMap.get(key);
    if (existing) {
      existing.bookings++;
    } else {
      customerMap.set(key, { name, email, bookings: 1 });
    }
  }
  const uniqueCustomers = Array.from(customerMap.values()).sort((a, b) => b.bookings - a.bookings);

  return (
    <div className="p-6 lg:p-8">
      {/* Back button */}
      <button onClick={() => router.push('/dashboard/tenants')} className="mb-4 flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        Back to tenants
      </button>

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {tenant.logo_url ? (
            <img src={tenant.logo_url} alt="" className="h-14 w-14 rounded-xl object-cover" />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-brand-100 text-xl font-bold text-brand-700">
              {tenant.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{tenant.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
              {tenant.owner_name && <span>{tenant.owner_name}</span>}
              {tenant.email && <span>· {tenant.email}</span>}
              {tenant.categories && <span>· {tenant.categories.name}</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-sm font-medium capitalize ${STATUS_BADGE[tenant.status] ?? 'bg-gray-100 text-gray-700'}`}>
            {tenant.status.replace('_', ' ')}
          </span>
          {tenant.payments_enabled && (
            <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-700">
              Payments ON
            </span>
          )}
          {tenant.subscription_plans && (
            <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
              {tenant.subscription_plans.name}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-6 flex gap-1 overflow-x-auto border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t
                ? 'border-b-2 border-brand-600 text-brand-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t}
            {t === 'Locations' && ` (${stats.location_count})`}
            {t === 'Staff' && ` (${stats.staff_count})`}
            {t === 'Services' && ` (${stats.service_count})`}
            {t === 'Customers' && ` (${stats.customer_count})`}
            {t === 'Appointments' && ` (${stats.total_appointments})`}
            {t === 'Reviews' && ` (${stats.review_count})`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-6">
        {tab === 'Overview' && <OverviewTab stats={stats} tenant={tenant} />}
        {tab === 'Locations' && <LocationsTab locations={locations} locationStaffCount={locationStaffCount} />}
        {tab === 'Staff' && <StaffTab staff={staff} staffToLocations={staffToLocations} />}
        {tab === 'Services' && <ServicesTab services={services} serviceToStaff={serviceToStaff} serviceToLocations={serviceToLocations} />}
        {tab === 'Customers' && <CustomersTab customers={uniqueCustomers} />}
        {tab === 'Appointments' && <AppointmentsTab appointments={appointments} />}
        {tab === 'Reviews' && <ReviewsTab reviews={reviews} />}
        {tab === 'Settings' && <SettingsTab tenant={tenant} coupons={coupons} />}
      </div>
    </div>
  );
}

// ── Tab Components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-gray-400">{sub}</p>}
    </div>
  );
}

function OverviewTab({ stats, tenant }: { stats: Stats; tenant: TenantDetail }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total Appointments" value={stats.total_appointments} sub={`${stats.completed_appointments} completed`} />
      <StatCard label="Revenue" value={formatCurrency(stats.total_revenue)} sub="From completed bookings" />
      <StatCard label="Avg Rating" value={tenant.avg_rating?.toFixed(1) ?? '—'} sub={`${stats.review_count} reviews`} />
      <StatCard label="Customers" value={stats.customer_count} />
      <StatCard label="Locations" value={stats.location_count} />
      <StatCard label="Staff" value={stats.staff_count} />
      <StatCard label="Services" value={stats.service_count} />
      <StatCard label="Pending" value={stats.pending_appointments} sub="Awaiting action" />
    </div>
  );
}

function LocationsTab({ locations, locationStaffCount }: { locations: Location[]; locationStaffCount: Map<string, number> }) {
  if (locations.length === 0) return <EmptyState text="No locations configured." />;
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {locations.map((loc) => (
        <div key={loc.id} className="rounded-xl border border-gray-200 bg-white p-5">
          <h3 className="font-semibold text-gray-900">{loc.name}</h3>
          <p className="mt-1 text-sm text-gray-500">{loc.address}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-500">
            <span className="rounded bg-gray-100 px-2 py-0.5">{loc.timezone}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5">{locationStaffCount.get(loc.id) ?? 0} staff</span>
            {loc.phone && <span className="rounded bg-gray-100 px-2 py-0.5">{loc.phone}</span>}
          </div>
          {loc.latitude && loc.longitude && (
            <p className="mt-2 text-xs text-gray-400">{Number(loc.latitude).toFixed(4)}, {Number(loc.longitude).toFixed(4)}</p>
          )}
        </div>
      ))}
    </div>
  );
}

function StaffTab({ staff, staffToLocations }: { staff: Staff[]; staffToLocations: Map<string, string[]> }) {
  if (staff.length === 0) return <EmptyState text="No staff members." />;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Contact</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Locations</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Approval</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {staff.map((s) => {
            const locs = staffToLocations.get(s.id) ?? [];
            return (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {s.image_url ? (
                      <img src={s.image_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                        {s.name.charAt(0)}
                      </div>
                    )}
                    <span className="text-sm font-medium text-gray-900">{s.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {s.email && <div>{s.email}</div>}
                  {s.phone && <div className="text-xs text-gray-400">{s.phone}</div>}
                </td>
                <td className="px-4 py-3">
                  {locs.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {locs.map((l, i) => (
                        <span key={i} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{l}</span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">All locations</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${s.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {s.status ?? 'active'}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {s.requires_approval ? 'Required' : 'Auto'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ServicesTab({ services, serviceToStaff, serviceToLocations }: { services: Service[]; serviceToStaff: Map<string, string[]>; serviceToLocations: Map<string, string[]> }) {
  if (services.length === 0) return <EmptyState text="No services configured." />;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Service</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Duration</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Locations</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Deposit</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Visibility</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {services.map((svc) => {
            const staffNames = serviceToStaff.get(svc.id) ?? [];
            const locNames = serviceToLocations.get(svc.id) ?? [];
            return (
              <tr key={svc.id} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {svc.image_url && <img src={svc.image_url} alt="" className="h-8 w-8 rounded object-cover" />}
                    <div>
                      <p className="text-sm font-medium text-gray-900">{svc.name}</p>
                      {svc.service_category && <p className="text-xs text-gray-400">{svc.service_category}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(svc.price)}</td>
                <td className="px-4 py-3 text-sm text-gray-500">{svc.duration_minutes} min</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {staffNames.length > 0 ? staffNames.map((n, i) => (
                      <span key={i} className="rounded bg-purple-50 px-2 py-0.5 text-xs text-purple-700">{n}</span>
                    )) : <span className="text-xs text-gray-400">None</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {locNames.length > 0 ? locNames.map((n, i) => (
                      <span key={i} className="rounded bg-blue-50 px-2 py-0.5 text-xs text-blue-700">{n}</span>
                    )) : <span className="text-xs text-gray-400">All</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {svc.deposit_enabled ? `${svc.deposit_type === 'percentage' ? `${svc.deposit_amount}%` : formatCurrency(svc.deposit_amount ?? 0)}` : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${svc.visibility === 'public' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {svc.visibility}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function CustomersTab({ customers }: { customers: { name: string; email: string | null; bookings: number }[] }) {
  if (customers.length === 0) return <EmptyState text="No customers have booked with this tenant yet." />;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Bookings</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {customers.map((c, i) => (
            <tr key={i} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm font-medium text-gray-900">{c.name}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{c.email ?? '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{c.bookings}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AppointmentsTab({ appointments }: { appointments: Appointment[] }) {
  if (appointments.length === 0) return <EmptyState text="No appointments yet." />;
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Service</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Location</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
            <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {appointments.map((a) => (
            <tr key={a.id} className="hover:bg-gray-50">
              <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(a.start_time)}</td>
              <td className="px-4 py-3 text-sm text-gray-900">{a.services?.name ?? '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{a.customers?.display_name ?? '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{a.staff?.name ?? '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-500">{a.tenant_locations?.name ?? '—'}</td>
              <td className="px-4 py-3 text-sm text-gray-700">{a.total_price != null ? formatCurrency(a.total_price) : '—'}</td>
              <td className="px-4 py-3">
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${APPT_STATUS_BADGE[a.status] ?? 'bg-gray-100 text-gray-500'}`}>
                  {a.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ReviewsTab({ reviews }: { reviews: Review[] }) {
  if (reviews.length === 0) return <EmptyState text="No reviews yet." />;
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {reviews.map((r) => (
        <div key={r.id} className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <svg key={i} className={`h-4 w-4 ${i < r.rating ? 'text-amber-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-sm text-gray-400">{formatDate(r.created_at)}</span>
            </div>
          </div>
          {r.comment && <p className="mt-2 text-sm text-gray-700">{r.comment}</p>}
          <div className="mt-2 flex gap-2 text-xs text-gray-400">
            <span>By {r.customers?.display_name ?? 'Anonymous'}</span>
            {r.staff?.name && <span>· Staff: {r.staff.name}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function SettingsTab({ tenant, coupons }: { tenant: TenantDetail; coupons: Coupon[] }) {
  return (
    <div className="space-y-6">
      {/* Subscription */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Subscription</h3>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
          <div>
            <p className="text-gray-500">Plan</p>
            <p className="font-medium text-gray-900">{tenant.subscription_plans?.name ?? 'None'}</p>
          </div>
          <div>
            <p className="text-gray-500">Monthly Price</p>
            <p className="font-medium text-gray-900">{tenant.subscription_plans ? formatCurrency(tenant.subscription_plans.price_monthly) : '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Max Staff</p>
            <p className="font-medium text-gray-900">{tenant.subscription_plans?.max_staff ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Max Locations</p>
            <p className="font-medium text-gray-900">{tenant.subscription_plans?.max_locations ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Payment Settings */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Payments</h3>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm lg:grid-cols-4">
          <div>
            <p className="text-gray-500">Payments Enabled</p>
            <p className="font-medium text-gray-900">{tenant.payments_enabled ? 'Yes' : 'No'}</p>
          </div>
          <div>
            <p className="text-gray-500">Stripe Customer</p>
            <p className="font-medium text-gray-900 break-all">{tenant.stripe_customer_id ?? '—'}</p>
          </div>
          <div>
            <p className="text-gray-500">Stripe Connect</p>
            <p className="font-medium text-gray-900 break-all">{tenant.stripe_account_id ?? '—'}</p>
          </div>
        </div>
      </div>

      {/* Coupons */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Coupons ({coupons.length})</h3>
        {coupons.length > 0 ? (
          <div className="mt-3 overflow-hidden rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Code</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Discount</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Usage</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Expires</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {coupons.map((c) => (
                  <tr key={c.id}>
                    <td className="px-3 py-2 text-sm font-mono font-medium text-gray-900">{c.code}</td>
                    <td className="px-3 py-2 text-sm text-gray-700">
                      {c.discount_type === 'percentage' ? `${c.discount_value}%` : formatCurrency(c.discount_value)}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {c.usage_count}{c.usage_limit ? `/${c.usage_limit}` : ''}
                    </td>
                    <td className="px-3 py-2 text-sm text-gray-500">
                      {c.expires_at ? formatDate(c.expires_at) : 'Never'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-400">No coupons configured.</p>
        )}
      </div>

      {/* Metadata */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <h3 className="text-lg font-semibold text-gray-900">Metadata</h3>
        <div className="mt-3 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-gray-500">Tenant ID</p>
            <p className="font-mono text-xs text-gray-700 break-all">{tenant.id}</p>
          </div>
          <div>
            <p className="text-gray-500">Created</p>
            <p className="text-gray-700">{formatDate(tenant.created_at)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}
