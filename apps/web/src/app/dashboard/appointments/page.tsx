'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'rescheduled'
  | 'rejected'
  | 'emergency';

interface Appointment {
  id: string;
  customer_id: string;
  service_id: string;
  staff_id: string | null;
  location_id: string | null;
  start_time: string;
  end_time: string;
  status: AppointmentStatus;
  total_price: number;
  deposit_paid: boolean;
  deposit_amount_paid: number | null;
  balance_due: number | null;
  notes: string | null;
  created_at: string;
  services: { name: string; duration_minutes: number; price: number } | null;
  customers: { id: string; display_name: string | null; email: string | null; phone: string | null } | null;
  staff: { id: string; name: string } | null;
  tenant_locations: { id: string; name: string } | null;
}

interface StaffMember {
  id: string;
  name: string;
}

interface ServiceItem {
  id: string;
  name: string;
  duration_minutes: number;
  price: number;
  service_category?: string | null;
  category_name?: string | null;
  service_extras?: ServiceExtra[];
}

interface ServiceExtra {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface LocationItem {
  id: string;
  name: string;
}

interface CustomerItem {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
}

interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  expires_at: string | null;
  usage_count: number;
  usage_limit: number | null;
}

interface CustomField {
  id: string;
  label: string;
  field_type: 'text' | 'number' | 'select' | 'checkbox' | 'date';
  options?: string[];
  required: boolean;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_OPTIONS: AppointmentStatus[] = [
  'pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled', 'rejected', 'emergency',
];

const statusConfig: Record<AppointmentStatus, { bg: string; text: string; dot: string; label: string }> = {
  pending:     { bg: 'bg-amber-50',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Pending' },
  confirmed:   { bg: 'bg-blue-50',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Confirmed' },
  completed:   { bg: 'bg-green-50',   text: 'text-green-700',   dot: 'bg-green-500',   label: 'Completed' },
  cancelled:   { bg: 'bg-red-50',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Cancelled' },
  no_show:     { bg: 'bg-gray-50',    text: 'text-gray-700',    dot: 'bg-gray-400',    label: 'No Show' },
  rescheduled: { bg: 'bg-purple-50',  text: 'text-purple-700',  dot: 'bg-purple-500',  label: 'Rescheduled' },
  rejected:    { bg: 'bg-orange-50',  text: 'text-orange-700',  dot: 'bg-orange-500',  label: 'Rejected' },
  emergency:   { bg: 'bg-rose-50',    text: 'text-rose-700',    dot: 'bg-rose-500',    label: 'Emergency' },
};

const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm h-9 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getInitials(name: string | null | undefined): string {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  return (parts[0]![0] ?? '?').toUpperCase();
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function calcDuration(start: string, end: string): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000);
}

function formatDateInput(iso: string | null): string {
  if (!iso) return '';
  return iso.split('T')[0] ?? '';
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

export default function AppointmentsPage() {
  // Data state
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  // Filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [staffFilter, setStaffFilter] = useState('');
  const [serviceFilter, setServiceFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Dropdown data
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [serviceList, setServiceList] = useState<ServiceItem[]>([]);
  const [locationList, setLocationList] = useState<LocationItem[]>([]);
  const [customerList, setCustomerList] = useState<CustomerItem[]>([]);
  const [couponList, setCouponList] = useState<Coupon[]>([]);
  const [customFields] = useState<CustomField[]>([]);

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelTab, setPanelTab] = useState<'details' | 'extras' | 'custom_fields' | 'coupons'>('details');
  const [editing, setEditing] = useState<Appointment | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Form state
  const [formLocationId, setFormLocationId] = useState('');
  const [formServiceId, setFormServiceId] = useState('');
  const [formStaffId, setFormStaffId] = useState('');
  const [formDate, setFormDate] = useState('');
  const [formTime, setFormTime] = useState('');
  const [formCustomerId, setFormCustomerId] = useState('');
  const [formStatus, setFormStatus] = useState<AppointmentStatus>('pending');
  const [formNotes, setFormNotes] = useState('');
  const [formSelectedExtras, setFormSelectedExtras] = useState<Set<string>>(new Set());
  const [formCustomFieldValues, setFormCustomFieldValues] = useState<Record<string, string>>({});
  const [formCouponId, setFormCouponId] = useState('');

  // Row menu
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // ----------------------------------------------------------
  // Data fetching
  // ----------------------------------------------------------

  const fetchAppointments = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (staffFilter) params.set('staff_id', staffFilter);
    if (serviceFilter) params.set('service_id', serviceFilter);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (search.trim()) params.set('search', search.trim());
    params.set('page', String(page));
    params.set('limit', String(limit));

    const res = await fetch(`/api/appointments?${params}`);
    const json = await res.json() as { data: Appointment[] | null; total: number };
    setAppointments(json.data ?? []);
    setTotal(json.total ?? 0);
    setLoading(false);
  }, [statusFilter, staffFilter, serviceFilter, dateFrom, dateTo, search, page, limit]);

  const fetchDropdownData = useCallback(async () => {
    const [staffRes, servicesRes, locationsRes, customersRes, couponsRes] = await Promise.all([
      fetch('/api/staff'),
      fetch('/api/services'),
      fetch('/api/locations'),
      fetch('/api/customers'),
      fetch('/api/coupons'),
    ]);
    const staffJson = await staffRes.json() as { data: StaffMember[] | null };
    const servicesJson = await servicesRes.json() as { data: ServiceItem[] | null };
    const locationsJson = await locationsRes.json() as { data: LocationItem[] | null };
    const customersJson = await customersRes.json() as { data: CustomerItem[] | null };
    const couponsJson = await couponsRes.json() as { data: Coupon[] | null };

    setStaffList(staffJson.data ?? []);
    setServiceList(servicesJson.data ?? []);
    setLocationList(locationsJson.data ?? []);
    setCustomerList(customersJson.data ?? []);
    setCouponList(couponsJson.data ?? []);
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);
  useEffect(() => { fetchDropdownData(); }, [fetchDropdownData]);

  // Close row menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpenId(null);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // ----------------------------------------------------------
  // Selection
  // ----------------------------------------------------------

  function toggleSelectAll() {
    if (selectedIds.size === appointments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(appointments.map((a) => a.id)));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // ----------------------------------------------------------
  // Panel form helpers
  // ----------------------------------------------------------

  function openNewPanel() {
    setEditing(null);
    setFormLocationId('');
    setFormServiceId('');
    setFormStaffId('');
    setFormDate('');
    setFormTime('');
    setFormCustomerId('');
    setFormStatus('pending');
    setFormNotes('');
    setFormSelectedExtras(new Set());
    setFormCustomFieldValues({});
    setFormCouponId('');
    setPanelTab('details');
    setFormError('');
    setPanelOpen(true);
  }

  function openEditPanel(appt: Appointment) {
    setEditing(appt);
    setFormLocationId(appt.location_id ?? '');
    setFormServiceId(appt.service_id ?? '');
    setFormStaffId(appt.staff_id ?? '');
    setFormDate(formatDateInput(appt.start_time));
    setFormTime(formatTime(appt.start_time));
    setFormCustomerId(appt.customer_id ?? '');
    setFormStatus(appt.status);
    setFormNotes(appt.notes ?? '');
    setFormSelectedExtras(new Set());
    setFormCustomFieldValues({});
    setFormCouponId('');
    setPanelTab('details');
    setFormError('');
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    setEditing(null);
    setFormError('');
  }

  // Get selected service for extras / pricing
  const selectedService = serviceList.find((s) => s.id === formServiceId) ?? null;
  const serviceExtras = selectedService?.service_extras ?? [];

  // Calculate coupon discount
  const selectedCoupon = couponList.find((c) => c.id === formCouponId) ?? null;
  function calcCouponDiscount(): { discount: number; final: number } {
    const basePrice = selectedService?.price ?? 0;
    const extrasTotal = serviceExtras
      .filter((e) => formSelectedExtras.has(e.id))
      .reduce((sum, e) => sum + e.price, 0);
    const subtotal = basePrice + extrasTotal;

    if (!selectedCoupon) return { discount: 0, final: subtotal };
    const disc = selectedCoupon.discount_type === 'percentage'
      ? subtotal * (selectedCoupon.discount_value / 100)
      : selectedCoupon.discount_value;
    const finalPrice = Math.max(0, subtotal - disc);
    return { discount: disc, final: finalPrice };
  }

  // ----------------------------------------------------------
  // CRUD
  // ----------------------------------------------------------

  async function handleSave() {
    setFormError('');
    if (!formCustomerId) { setFormError('Please select a customer.'); return; }
    if (!formServiceId) { setFormError('Please select a service.'); return; }
    if (!formDate) { setFormError('Please select a date.'); return; }
    if (!formTime) { setFormError('Please select a time.'); return; }

    setSaving(true);

    const duration = selectedService?.duration_minutes ?? 60;
    const startDateTime = new Date(`${formDate}T${formTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
    const { final: totalPrice } = calcCouponDiscount();

    const customFieldValuesArr = Object.entries(formCustomFieldValues)
      .filter(([, v]) => v !== '')
      .map(([cfId, value]) => ({ custom_field_id: cfId, value }));

    const body: Record<string, unknown> = {
      customer_id: formCustomerId,
      service_id: formServiceId,
      staff_id: formStaffId || null,
      location_id: formLocationId || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      status: formStatus,
      total_price: totalPrice,
      notes: formNotes || null,
    };

    if (!editing) {
      body.custom_field_values = customFieldValuesArr;
    }

    if (editing) {
      body.id = editing.id;
    }

    const res = await fetch('/api/appointments', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json() as { error: { message: string } | null };
    if (!res.ok) {
      setFormError(json.error?.message ?? 'Failed to save appointment');
      setSaving(false);
      return;
    }

    setSaving(false);
    closePanel();
    fetchAppointments();
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    await fetch(`/api/appointments?id=${id}`, { method: 'DELETE' });
    setMenuOpenId(null);
    fetchAppointments();
  }

  const hasActiveFilters = search || statusFilter || staffFilter || serviceFilter || dateFrom || dateTo;

  function clearFilters() {
    setSearch('');
    setStatusFilter('');
    setStaffFilter('');
    setServiceFilter('');
    setDateFrom('');
    setDateTo('');
    setPage(1);
  }

  function handleExportCSV() {
    window.open('/api/appointments/export', '_blank');
  }

  // ----------------------------------------------------------
  // Pagination
  // ----------------------------------------------------------

  const totalPages = Math.max(1, Math.ceil(total / limit));

  function renderPagination() {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      const start = Math.max(2, page - 1);
      const end = Math.min(totalPages - 1, page + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  }

  // ----------------------------------------------------------
  // Render
  // ----------------------------------------------------------

  return (
    <div className="relative flex h-full">
      {/* Main content */}
      <div className="flex-1 overflow-auto p-6 lg:p-8">
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">Appointments</h1>
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
              {total}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <span className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                Export CSV
              </span>
            </button>
            <button
              onClick={openNewPanel}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
            >
              + New Appointment
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-4 flex flex-wrap gap-2 items-center">
          <input
            type="text"
            placeholder="Search customer..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48 rounded-lg border border-gray-300 px-3 py-1.5 text-sm h-9 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          />
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm h-9 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            title="From date"
          />
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm h-9 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            title="To date"
          />
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm h-9 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Services</option>
            {serviceList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={staffFilter}
            onChange={(e) => setStaffFilter(e.target.value)}
            className="w-36 rounded-lg border border-gray-300 px-3 py-1.5 text-sm h-9 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Staff</option>
            {staffList.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-32 rounded-lg border border-gray-300 px-3 py-1.5 text-sm h-9 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
          >
            <option value="">All Statuses</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{statusConfig[s].label}</option>
            ))}
          </select>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50"
            >
              Clear
            </button>
          )}
        </div>

        {/* Table */}
        <div className="mt-6 overflow-visible rounded-xl border border-gray-200 bg-white">
          {loading ? (
            <div className="p-12 text-center text-sm text-gray-500">Loading appointments...</div>
          ) : appointments.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-sm text-gray-500">No appointments found.</p>
              <button onClick={openNewPanel} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
                Create your first appointment
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto overflow-y-visible">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selectedIds.size === appointments.length && appointments.length > 0}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created At</th>
                    <th className="w-10 px-3 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {appointments.map((appt) => {
                    const sc = statusConfig[appt.status] ?? statusConfig.pending;
                    const custName = appt.customers?.display_name ?? 'Unknown';
                    const custEmail = appt.customers?.email ?? '';
                    const staffName = appt.staff?.name ?? '—';
                    const duration = calcDuration(appt.start_time, appt.end_time);

                    return (
                      <tr key={appt.id} className="group hover:bg-gray-50">
                        {/* Checkbox */}
                        <td className="px-3 py-3">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(appt.id)}
                            onChange={() => toggleSelect(appt.id)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-600"
                          />
                        </td>

                        {/* ID */}
                        <td className="whitespace-nowrap px-4 py-3 font-mono text-xs text-gray-500">
                          {appt.id.substring(0, 8)}
                        </td>

                        {/* Start Date */}
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                          <div>{formatDate(appt.start_time)}</div>
                          <div className="text-xs text-gray-500">{formatTime(appt.start_time)}</div>
                        </td>

                        {/* Customer */}
                        <td className="whitespace-nowrap px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                              {getInitials(custName)}
                            </div>
                            <div>
                              <div className="text-sm font-medium text-gray-900">{custName}</div>
                              {custEmail && <div className="text-xs text-gray-500">{custEmail}</div>}
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="whitespace-nowrap px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.bg} ${sc.text}`}>
                            <span className={`inline-block h-1.5 w-1.5 rounded-full ${sc.dot}`} />
                            {sc.label}
                          </span>
                        </td>

                        {/* Staff */}
                        <td className="whitespace-nowrap px-4 py-3">
                          {appt.staff ? (
                            <div className="flex items-center gap-2">
                              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-[10px] font-semibold text-gray-600">
                                {getInitials(staffName)}
                              </div>
                              <span className="text-sm text-gray-700">{staffName}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-gray-400">—</span>
                          )}
                        </td>

                        {/* Service */}
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                          {appt.services?.name ?? '—'}
                        </td>

                        {/* Payment */}
                        <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                          <span className="flex items-center gap-1">
                            <svg className="h-3.5 w-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                            </svg>
                            ${(appt.total_price ?? 0).toFixed(2)}
                          </span>
                        </td>

                        {/* Duration */}
                        <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                          {duration} min
                        </td>

                        {/* Created At */}
                        <td className="whitespace-nowrap px-4 py-3 text-xs text-gray-500">
                          {formatDate(appt.created_at)}
                        </td>

                        {/* 3-dot menu */}
                        <td className="relative px-3 py-3">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setMenuOpenId(menuOpenId === appt.id ? null : appt.id);
                            }}
                            className="rounded p-1 text-gray-400 opacity-0 hover:bg-gray-100 hover:text-gray-600 group-hover:opacity-100"
                          >
                            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
                            </svg>
                          </button>
                          {menuOpenId === appt.id && (
                            <div
                              ref={menuRef}
                              className="absolute right-4 top-10 z-50 w-36 rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
                            >
                              <button
                                onClick={() => { openEditPanel(appt); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.64 0 8.577 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.64 0-8.577-3.007-9.963-7.178Z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                                </svg>
                                View
                              </button>
                              <button
                                onClick={() => { openEditPanel(appt); setMenuOpenId(null); }}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" />
                                </svg>
                                Edit
                              </button>
                              <button
                                onClick={() => handleDelete(appt.id)}
                                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                              >
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                                </svg>
                                Delete
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Showing {(page - 1) * limit + 1} to {Math.min(page * limit, total)} of {total} results
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Previous
              </button>
              {renderPagination().map((p, i) =>
                typeof p === 'string' ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-sm text-gray-400">...</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                      p === page
                        ? 'bg-brand-600 text-white'
                        : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Sliding panel overlay */}
      {panelOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closePanel} />

          {/* Panel */}
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[50%] sm:min-w-[480px]">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Appointment' : 'New Appointment'}
              </h2>
              <button
                onClick={closePanel}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200">
              {(['details', 'extras', 'custom_fields', 'coupons'] as const).map((tab) => {
                const labels: Record<string, string> = {
                  details: 'Details',
                  extras: 'Extras',
                  custom_fields: 'Custom Fields',
                  coupons: 'Coupons',
                };
                return (
                  <button
                    key={tab}
                    onClick={() => setPanelTab(tab)}
                    className={`flex-1 border-b-2 px-4 py-2.5 text-sm font-medium ${
                      panelTab === tab
                        ? 'border-brand-600 text-brand-600'
                        : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    {labels[tab]}
                  </button>
                );
              })}
            </div>

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {/* Tab: Details */}
              {panelTab === 'details' && (
                <div className="space-y-4">
                  {/* Location */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Location</label>
                    <select
                      value={formLocationId}
                      onChange={(e) => setFormLocationId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select location...</option>
                      {locationList.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Service */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Service *</label>
                    <select
                      value={formServiceId}
                      onChange={(e) => setFormServiceId(e.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="">Select service...</option>
                      {(() => {
                        const grouped = new Map<string, ServiceItem[]>();
                        for (const s of serviceList) {
                          const cat = s.service_category || s.category_name || 'Uncategorized';
                          if (!grouped.has(cat)) grouped.set(cat, []);
                          grouped.get(cat)!.push(s);
                        }
                        return Array.from(grouped.entries()).map(([cat, svcs]) => (
                          <optgroup key={cat} label={cat}>
                            {svcs.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name} (${s.price.toFixed(2)}, {s.duration_minutes} min)
                              </option>
                            ))}
                          </optgroup>
                        ));
                      })()}
                    </select>
                  </div>

                  {/* Staff */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Staff</label>
                    <select
                      value={formStaffId}
                      onChange={(e) => setFormStaffId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">Select staff...</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Date *</label>
                      <input
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className={inputClass}
                        required
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-sm font-medium text-gray-700">Time *</label>
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className={inputClass}
                        required
                      />
                    </div>
                  </div>

                  {/* Customer */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Customer *</label>
                    <select
                      value={formCustomerId}
                      onChange={(e) => setFormCustomerId(e.target.value)}
                      className={inputClass}
                      required
                    >
                      <option value="">Select customer...</option>
                      {customerList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_name ?? c.email ?? 'Unknown'}{c.email ? ` (${c.email})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Status */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Status</label>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as AppointmentStatus)}
                      className={inputClass}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{statusConfig[s].label}</option>
                      ))}
                    </select>
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      rows={3}
                      className={inputClass}
                      placeholder="Add notes about this appointment..."
                    />
                  </div>
                </div>
              )}

              {/* Tab: Extras */}
              {panelTab === 'extras' && (
                <div>
                  {!formServiceId ? (
                    <p className="text-sm text-gray-500">Please select a service first to view available extras.</p>
                  ) : serviceExtras.length === 0 ? (
                    <p className="text-sm text-gray-500">No extras available for this service.</p>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-sm text-gray-600">Select extras to add to this appointment:</p>
                      {serviceExtras.map((extra) => (
                        <label
                          key={extra.id}
                          className="flex items-center gap-3 rounded-lg border border-gray-200 p-3 hover:bg-gray-50"
                        >
                          <input
                            type="checkbox"
                            checked={formSelectedExtras.has(extra.id)}
                            onChange={() => {
                              setFormSelectedExtras((prev) => {
                                const next = new Set(prev);
                                if (next.has(extra.id)) next.delete(extra.id);
                                else next.add(extra.id);
                                return next;
                              });
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-brand-600"
                          />
                          <div className="flex-1">
                            <span className="text-sm font-medium text-gray-900">{extra.name}</span>
                            {extra.duration_minutes > 0 && (
                              <span className="ml-2 text-xs text-gray-500">+{extra.duration_minutes} min</span>
                            )}
                          </div>
                          <span className="text-sm font-medium text-gray-700">+${extra.price.toFixed(2)}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Custom Fields */}
              {panelTab === 'custom_fields' && (
                <div>
                  {customFields.length === 0 ? (
                    <p className="text-sm text-gray-500">No custom fields configured for this tenant.</p>
                  ) : (
                    <div className="space-y-4">
                      {customFields.map((field) => (
                        <div key={field.id}>
                          <label className="mb-1 block text-sm font-medium text-gray-700">
                            {field.label}
                            {field.required && <span className="ml-1 text-red-500">*</span>}
                          </label>
                          {field.field_type === 'text' && (
                            <input
                              type="text"
                              value={formCustomFieldValues[field.id] ?? ''}
                              onChange={(e) => setFormCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                              className={inputClass}
                              required={field.required}
                            />
                          )}
                          {field.field_type === 'number' && (
                            <input
                              type="number"
                              value={formCustomFieldValues[field.id] ?? ''}
                              onChange={(e) => setFormCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                              className={inputClass}
                              required={field.required}
                            />
                          )}
                          {field.field_type === 'select' && (
                            <select
                              value={formCustomFieldValues[field.id] ?? ''}
                              onChange={(e) => setFormCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                              className={inputClass}
                              required={field.required}
                            >
                              <option value="">Select...</option>
                              {(field.options ?? []).map((opt) => (
                                <option key={opt} value={opt}>{opt}</option>
                              ))}
                            </select>
                          )}
                          {field.field_type === 'checkbox' && (
                            <label className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={formCustomFieldValues[field.id] === 'true'}
                                onChange={(e) => setFormCustomFieldValues((prev) => ({ ...prev, [field.id]: String(e.target.checked) }))}
                                className="h-4 w-4 rounded border-gray-300 text-brand-600"
                              />
                              <span className="text-sm text-gray-600">Yes</span>
                            </label>
                          )}
                          {field.field_type === 'date' && (
                            <input
                              type="date"
                              value={formCustomFieldValues[field.id] ?? ''}
                              onChange={(e) => setFormCustomFieldValues((prev) => ({ ...prev, [field.id]: e.target.value }))}
                              className={inputClass}
                              required={field.required}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Coupons */}
              {panelTab === 'coupons' && (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-gray-700">Apply Coupon</label>
                    <select
                      value={formCouponId}
                      onChange={(e) => setFormCouponId(e.target.value)}
                      className={inputClass}
                    >
                      <option value="">No coupon</option>
                      {couponList
                        .filter((c) => {
                          if (c.expires_at && new Date(c.expires_at) < new Date()) return false;
                          if (c.usage_limit && c.usage_count >= c.usage_limit) return false;
                          return true;
                        })
                        .map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} ({c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value.toFixed(2)}`} off)
                          </option>
                        ))}
                    </select>
                  </div>

                  {/* Price breakdown */}
                  {formServiceId && (
                    <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                      <h4 className="mb-3 text-sm font-medium text-gray-900">Price Breakdown</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Service: {selectedService?.name ?? ''}</span>
                          <span className="text-gray-900">${(selectedService?.price ?? 0).toFixed(2)}</span>
                        </div>
                        {serviceExtras
                          .filter((e) => formSelectedExtras.has(e.id))
                          .map((e) => (
                            <div key={e.id} className="flex justify-between">
                              <span className="text-gray-600">+ {e.name}</span>
                              <span className="text-gray-900">${e.price.toFixed(2)}</span>
                            </div>
                          ))}
                        {selectedCoupon && (
                          <div className="flex justify-between text-green-600">
                            <span>Discount ({selectedCoupon.code})</span>
                            <span>-${calcCouponDiscount().discount.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="border-t border-gray-300 pt-2">
                          <div className="flex justify-between font-semibold">
                            <span className="text-gray-900">Total</span>
                            <span className="text-gray-900">${calcCouponDiscount().final.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="border-t border-gray-200 px-6 py-4">
              {formError && <p className="mb-3 text-sm text-red-600">{formError}</p>}
              <div className="flex gap-3">
                <button
                  onClick={closePanel}
                  className="flex-1 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex-1 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update Appointment' : 'Create Appointment'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
