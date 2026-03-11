'use client';

import { useEffect, useState, useCallback } from 'react';

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

interface ProductItem {
  id: string;
  name: string;
  sell_price: number;
  quantity_on_hand: number;
  display_in_booking: boolean;
  is_active: boolean;
  product_services?: { service_id: string }[];
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

const addInputClass =
  'w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const editInputClass =
  'w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';
const addTextareaClass =
  'w-full rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const editTextareaClass =
  'w-full rounded-[.3rem] border border-transparent bg-transparent px-0 py-2 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';

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

function formatTimeInput(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatHumanDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
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
  const [productList, setProductList] = useState<ProductItem[]>([]);
  const [_customFields] = useState<CustomField[]>([]);

  // Panel state
  const [panelOpen, setPanelOpen] = useState(false);
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
  const [formSelectedProducts, setFormSelectedProducts] = useState<Map<string, number>>(new Map());

  // New customer inline creation
  const [isNewCustomer, setIsNewCustomer] = useState(false);
  const [newCustName, setNewCustName] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [newCustFirstName, setNewCustFirstName] = useState('');
  const [newCustLastName, setNewCustLastName] = useState('');
  const [newCustDob, setNewCustDob] = useState('');
  const [newCustGender, setNewCustGender] = useState('');
  const [newCustNote, setNewCustNote] = useState('');

  // Edit panel: status picker popover
  const [showStatusPicker, setShowStatusPicker] = useState(false);

  // Bulk action state
  const [bulkStatusPickerOpen, setBulkStatusPickerOpen] = useState(false);
  const [bulkActing, setBulkActing] = useState(false);

  // Available time slots for new appointment form
  const [availableSlots, setAvailableSlots] = useState<{ time: string; staff: { id: string; name: string }[] }[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);

  // (editingField state removed — edit panel now uses direct inputs)

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
    const [staffRes, servicesRes, locationsRes, customersRes, couponsRes, productsRes] = await Promise.all([
      fetch('/api/staff'),
      fetch('/api/services'),
      fetch('/api/locations'),
      fetch('/api/customers'),
      fetch('/api/coupons'),
      fetch('/api/inventory'),
    ]);
    const staffJson = await staffRes.json() as { data: StaffMember[] | null };
    const servicesJson = await servicesRes.json() as { data: ServiceItem[] | null };
    const locationsJson = await locationsRes.json() as { data: LocationItem[] | null };
    const customersJson = await customersRes.json() as { data: CustomerItem[] | null };
    const couponsJson = await couponsRes.json() as { data: Coupon[] | null };
    const productsJson = await productsRes.json() as { data: ProductItem[] | null };

    setStaffList(staffJson.data ?? []);
    setServiceList(servicesJson.data ?? []);
    setLocationList(locationsJson.data ?? []);
    setCustomerList(customersJson.data ?? []);
    setCouponList(couponsJson.data ?? []);
    setProductList(productsJson.data ?? []);
  }, []);

  useEffect(() => { fetchAppointments(); }, [fetchAppointments]);
  useEffect(() => { fetchDropdownData(); }, [fetchDropdownData]);

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
    setFormSelectedProducts(new Map());
    setFormCustomFieldValues({});
    setFormCouponId('');
    setIsNewCustomer(false);
    setNewCustName('');
    setNewCustEmail('');
    setNewCustPhone('');
    setNewCustFirstName('');
    setNewCustLastName('');
    setNewCustDob('');
    setNewCustGender('');
    setNewCustNote('');
    setFormError('');
    setPanelOpen(true);
  }

  async function openEditPanel(appt: Appointment) {
    setEditing(appt);
    setFormLocationId(appt.location_id ?? '');
    setFormServiceId(appt.service_id ?? '');
    setFormStaffId(appt.staff_id ?? '');
    setFormDate(formatDateInput(appt.start_time));
    setFormTime(formatTimeInput(appt.start_time));
    setFormCustomerId(appt.customer_id ?? '');
    setFormStatus(appt.status);
    setFormNotes(appt.notes ?? '');
    setFormSelectedExtras(new Set());
    setFormSelectedProducts(new Map());
    setFormCustomFieldValues({});
    setFormCouponId('');
    setIsNewCustomer(false);
    setNewCustName('');
    setNewCustEmail('');
    setNewCustPhone('');
    setNewCustFirstName('');
    setNewCustLastName('');
    setNewCustDob('');
    setNewCustGender('');
    setNewCustNote('');
    setShowStatusPicker(false);
    setFormError('');
    setPanelOpen(true);

    // Fetch saved line items (extras, products, coupons) for this appointment
    try {
      const res = await fetch(`/api/appointments/line-items?appointment_id=${appt.id}`);
      const json = await res.json() as {
        data: {
          extras: { extra_id: string }[];
          products: { product_id: string; quantity: number }[];
          coupons: { coupon_id: string }[];
        } | null;
      };
      if (json.data) {
        if (json.data.extras.length > 0) {
          setFormSelectedExtras(new Set(json.data.extras.map((e) => e.extra_id)));
        }
        if (json.data.products.length > 0) {
          const prodMap = new Map<string, number>();
          for (const p of json.data.products) {
            prodMap.set(p.product_id, p.quantity);
          }
          setFormSelectedProducts(prodMap);
        }
        if (json.data.coupons.length > 0) {
          setFormCouponId(json.data.coupons[0]!.coupon_id);
        }
      }
    } catch {
      // Silently fail — line items will just appear empty
    }
  }

  function closePanel() {
    setPanelOpen(false);
    setEditing(null);
    setFormError('');
  }

  // Get selected service for extras / pricing
  const selectedService = serviceList.find((s) => s.id === formServiceId) ?? null;
  const serviceExtras = selectedService?.service_extras ?? [];

  // Filter products: active, display_in_booking, and optionally linked to selected service
  const availableProducts = productList.filter((p) => {
    if (!p.is_active || !p.display_in_booking) return false;
    if (p.quantity_on_hand <= 0) return false;
    // If product has service links, only show if it matches selected service
    if (p.product_services && p.product_services.length > 0 && formServiceId) {
      return p.product_services.some((ps) => ps.service_id === formServiceId);
    }
    return true;
  });

  // Filter coupons: valid (not expired, not maxed out)
  const validCoupons = couponList.filter((c) => {
    if (c.expires_at && new Date(c.expires_at) < new Date()) return false;
    if (c.usage_limit && c.usage_count >= c.usage_limit) return false;
    return true;
  });

  // Calculate coupon discount
  const selectedCoupon = couponList.find((c) => c.id === formCouponId) ?? null;

  // Calculate products total
  function calcProductsTotal(): number {
    let total = 0;
    formSelectedProducts.forEach((qty, productId) => {
      const product = productList.find((p) => p.id === productId);
      if (product) total += product.sell_price * qty;
    });
    return total;
  }

  function calcCouponDiscount(): { discount: number; final: number; productsTotal: number; extrasTotal: number } {
    const basePrice = selectedService?.price ?? 0;
    const extrasTotal = serviceExtras
      .filter((e) => formSelectedExtras.has(e.id))
      .reduce((sum, e) => sum + e.price, 0);
    const productsTotal = calcProductsTotal();
    const subtotal = basePrice + extrasTotal + productsTotal;

    if (!selectedCoupon) return { discount: 0, final: subtotal, productsTotal, extrasTotal };
    const disc = selectedCoupon.discount_type === 'percentage'
      ? subtotal * (selectedCoupon.discount_value / 100)
      : selectedCoupon.discount_value;
    const finalPrice = Math.max(0, subtotal - disc);
    return { discount: disc, final: finalPrice, productsTotal, extrasTotal };
  }

  // ----------------------------------------------------------
  // CRUD
  // ----------------------------------------------------------

  async function handleSave() {
    setFormError('');

    // If new customer mode, validate those fields
    if (!editing && isNewCustomer) {
      if (!newCustFirstName.trim() && !newCustName.trim() && !newCustEmail.trim()) {
        setFormError('Please provide at least a first name or email for the new customer.');
        return;
      }
    } else if (!formCustomerId) {
      setFormError('Please select a customer.');
      return;
    }

    if (!formServiceId) { setFormError('Please select a service.'); return; }
    if (!formDate) { setFormError('Please select a date.'); return; }
    if (!formTime) { setFormError('Please select a time.'); return; }

    setSaving(true);

    let customerId = formCustomerId;

    // Create new customer first if needed
    if (!editing && isNewCustomer) {
      try {
        const custRes = await fetch('/api/customers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            display_name: (newCustFirstName.trim() + ' ' + newCustLastName.trim()).trim() || newCustName.trim() || null,
            email: newCustEmail.trim() || null,
            phone: newCustPhone.trim() || null,
          }),
        });
        const custJson = await custRes.json() as { data: { id: string } | null; error: { message: string } | null };
        if (!custRes.ok || !custJson.data) {
          setFormError(custJson.error?.message ?? 'Failed to create customer.');
          setSaving(false);
          return;
        }
        customerId = custJson.data.id;
        // Refresh customer list so new customer appears
        const refreshRes = await fetch('/api/customers');
        const refreshJson = await refreshRes.json() as { data: CustomerItem[] | null };
        setCustomerList(refreshJson.data ?? []);
      } catch {
        setFormError('Failed to create customer.');
        setSaving(false);
        return;
      }
    }

    const duration = selectedService?.duration_minutes ?? 60;
    const startDateTime = new Date(`${formDate}T${formTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);
    const { final: totalPrice } = calcCouponDiscount();

    const customFieldValuesArr = Object.entries(formCustomFieldValues)
      .filter(([, v]) => v !== '')
      .map(([cfId, value]) => ({ custom_field_id: cfId, value }));

    // Build extras array from selected extras
    const extrasArr = serviceExtras
      .filter((e) => formSelectedExtras.has(e.id))
      .map((e) => ({
        extra_id: e.id,
        name: e.name,
        price: e.price,
        duration_minutes: e.duration_minutes,
      }));

    // Build products array from selected products
    const productsArr: { product_id: string; name: string; price: number; quantity: number }[] = [];
    formSelectedProducts.forEach((qty, productId) => {
      const product = productList.find((p) => p.id === productId);
      if (product && qty > 0) {
        productsArr.push({
          product_id: product.id,
          name: product.name,
          price: product.sell_price,
          quantity: qty,
        });
      }
    });

    // Build coupon object if selected
    const { discount } = calcCouponDiscount();
    const couponObj = selectedCoupon ? {
      coupon_id: selectedCoupon.id,
      code: selectedCoupon.code,
      discount_type: selectedCoupon.discount_type,
      discount_value: selectedCoupon.discount_value,
      discount_amount: discount,
    } : null;

    const body: Record<string, unknown> = {
      customer_id: customerId,
      service_id: formServiceId,
      staff_id: formStaffId || null,
      location_id: formLocationId || null,
      start_time: startDateTime.toISOString(),
      end_time: endDateTime.toISOString(),
      status: formStatus,
      total_price: totalPrice,
      notes: formNotes || null,
      extras: extrasArr,
      products: productsArr,
      coupon: couponObj,
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
    if (editing) {
      // Don't close modal on update — just refresh the list so the table reflects the change
      fetchAppointments();
    } else {
      closePanel();
      fetchAppointments();
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this appointment?')) return;
    await fetch(`/api/appointments?id=${id}`, { method: 'DELETE' });
    closePanel();
    fetchAppointments();
  }

  // ----------------------------------------------------------
  // Bulk actions
  // ----------------------------------------------------------

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.size} appointment(s)?`)) return;
    setBulkActing(true);
    await fetch(`/api/appointments?ids=${Array.from(selectedIds).join(',')}`, { method: 'DELETE' });
    setSelectedIds(new Set());
    setBulkActing(false);
    fetchAppointments();
  }

  async function handleBulkStatusChange(status: AppointmentStatus) {
    if (selectedIds.size === 0) return;
    setBulkActing(true);
    setBulkStatusPickerOpen(false);
    await fetch('/api/appointments', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids: Array.from(selectedIds), status }),
    });
    setSelectedIds(new Set());
    setBulkActing(false);
    fetchAppointments();
  }

  // ----------------------------------------------------------
  // Available time slots fetching
  // ----------------------------------------------------------

  useEffect(() => {
    if (!formServiceId || !formDate || editing) {
      setAvailableSlots([]);
      return;
    }
    let cancelled = false;
    async function fetchSlots() {
      setLoadingSlots(true);
      const params = new URLSearchParams({
        service_id: formServiceId,
        date: formDate,
      });
      if (formStaffId) params.set('staff_id', formStaffId);
      try {
        const res = await fetch(`/api/appointments/available-slots?${params}`);
        const json = await res.json() as { data: { time: string; staff: { id: string; name: string }[] }[] | null };
        if (!cancelled) {
          setAvailableSlots(json.data ?? []);
        }
      } catch {
        if (!cancelled) setAvailableSlots([]);
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    }
    fetchSlots();
    return () => { cancelled = true; };
  }, [formServiceId, formDate, formStaffId, editing]);

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

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="mt-4 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
            <span className="text-sm font-medium text-brand-700">
              {selectedIds.size} selected
            </span>
            <div className="h-4 w-px bg-brand-200" />
            <div className="relative">
              <button
                onClick={() => setBulkStatusPickerOpen(!bulkStatusPickerOpen)}
                disabled={bulkActing}
                className="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
              >
                Change Status
              </button>
              {bulkStatusPickerOpen && (
                <div className="absolute left-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {STATUS_OPTIONS.map((s) => {
                    const sc = statusConfig[s];
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => handleBulkStatusChange(s)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                      >
                        <span className={`inline-block h-2 w-2 rounded-full ${sc.dot}`} />
                        {sc.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              onClick={handleBulkDelete}
              disabled={bulkActing}
              className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              Delete
            </button>
            <div className="flex-1" />
            <button
              onClick={() => { setSelectedIds(new Set()); setBulkStatusPickerOpen(false); }}
              className="text-sm text-brand-600 hover:text-brand-800"
            >
              Clear selection
            </button>
          </div>
        )}

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
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Start Date</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Customer</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Service</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Payment</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Duration</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created At</th>
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
                      <tr
                        key={appt.id}
                        className="group cursor-pointer hover:bg-gray-50"
                        onClick={() => openEditPanel(appt)}
                      >
                        {/* Checkbox */}
                        <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={selectedIds.has(appt.id)}
                            onChange={() => toggleSelect(appt.id)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-600"
                          />
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
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]">
            {/* Panel header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
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

            {/* Panel body */}
            <div className="flex-1 overflow-y-auto px-8 py-3">
              {/* ====================================================== */}
              {/* NEW APPOINTMENT PANEL */}
              {/* ====================================================== */}
              {!editing && (
                <div className="space-y-3">
                  {/* Location */}
                  <select
                    value={formLocationId}
                    onChange={(e) => setFormLocationId(e.target.value)}
                    className={addInputClass}
                  >
                    <option value="">Select location...</option>
                    {locationList.map((l) => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>

                  {/* Service & Staff side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={formServiceId}
                      onChange={(e) => setFormServiceId(e.target.value)}
                      className={addInputClass}
                      required
                    >
                      <option value="">Select service... *</option>
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
                    <select
                      value={formStaffId}
                      onChange={(e) => setFormStaffId(e.target.value)}
                      className={addInputClass}
                    >
                      <option value="">Select staff...</option>
                      {staffList.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Date & Time */}
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => { setFormDate(e.target.value); setFormTime(''); }}
                      className={addInputClass}
                      required
                      placeholder="Date *"
                    />
                    {formServiceId && formDate ? (
                      <select
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className={addInputClass}
                        required
                      >
                        <option value="">
                          {loadingSlots ? 'Loading slots...' : availableSlots.length === 0 ? 'No slots available' : 'Select time... *'}
                        </option>
                        {availableSlots.map((slot) => {
                          // Format time for display (e.g. "09:00" -> "9:00 AM")
                          const [h, m] = slot.time.split(':').map(Number);
                          const ampm = (h ?? 0) >= 12 ? 'PM' : 'AM';
                          const displayHour = (h ?? 0) === 0 ? 12 : (h ?? 0) > 12 ? (h ?? 0) - 12 : h;
                          const staffNames = slot.staff.map(s => s.name).join(', ');
                          return (
                            <option key={slot.time} value={slot.time}>
                              {displayHour}:{String(m).padStart(2, '0')} {ampm}{staffNames ? ` (${staffNames})` : ''}
                            </option>
                          );
                        })}
                      </select>
                    ) : (
                      <input
                        type="time"
                        value={formTime}
                        onChange={(e) => setFormTime(e.target.value)}
                        className={addInputClass}
                        required
                        placeholder="Time *"
                      />
                    )}
                  </div>

                  {/* Customer & Status side by side */}
                  <div className="grid grid-cols-2 gap-3">
                    <select
                      value={isNewCustomer ? '__new__' : formCustomerId}
                      onChange={(e) => {
                        if (e.target.value === '__new__') {
                          setIsNewCustomer(true);
                          setFormCustomerId('');
                        } else {
                          setIsNewCustomer(false);
                          setFormCustomerId(e.target.value);
                        }
                      }}
                      className={addInputClass}
                      required={!isNewCustomer}
                    >
                      <option value="">Select customer... *</option>
                      <option value="__new__">+ New Customer</option>
                      {customerList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.display_name ?? c.email ?? 'Unknown'}{c.email ? ` (${c.email})` : ''}
                        </option>
                      ))}
                    </select>
                    <select
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value as AppointmentStatus)}
                      className={addInputClass}
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s} value={s}>{statusConfig[s].label}</option>
                      ))}
                    </select>
                  </div>

                  {/* New Customer expanded fields */}
                  {isNewCustomer && (
                    <div className="space-y-3 rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] p-4">
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">New Customer</p>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="text" value={newCustFirstName} onChange={(e) => setNewCustFirstName(e.target.value)} className={addInputClass} placeholder="First Name *" />
                        <input type="text" value={newCustLastName} onChange={(e) => setNewCustLastName(e.target.value)} className={addInputClass} placeholder="Last Name" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="email" value={newCustEmail} onChange={(e) => setNewCustEmail(e.target.value)} className={addInputClass} placeholder="Email" />
                        <input type="tel" value={newCustPhone} onChange={(e) => setNewCustPhone(e.target.value)} className={addInputClass} placeholder="Phone" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <input type="date" value={newCustDob} onChange={(e) => setNewCustDob(e.target.value)} className={addInputClass} placeholder="Date of Birth" />
                        <select value={newCustGender} onChange={(e) => setNewCustGender(e.target.value)} className={addInputClass}>
                          <option value="">Gender...</option>
                          <option value="male">Male</option>
                          <option value="female">Female</option>
                          <option value="other">Other</option>
                          <option value="prefer_not_to_say">Prefer not to say</option>
                        </select>
                      </div>
                      <textarea value={newCustNote} onChange={(e) => setNewCustNote(e.target.value)} rows={2} className={addTextareaClass} placeholder="Note..." />
                    </div>
                  )}

                  {/* Extras section — only shown when service has extras */}
                  {formServiceId && serviceExtras.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Extras</h4>
                      <div className="flex flex-wrap items-center gap-2 rounded-[.3rem] border border-[#f1f1f1] p-3 min-h-[46px]">
                        {serviceExtras
                          .filter((e) => formSelectedExtras.has(e.id))
                          .map((extra) => (
                            <span key={extra.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                              {extra.name} (+${extra.price.toFixed(2)})
                              <button
                                type="button"
                                onClick={() => {
                                  setFormSelectedExtras((prev) => {
                                    const next = new Set(prev);
                                    next.delete(extra.id);
                                    return next;
                                  });
                                }}
                                className="ml-1 text-brand-400 hover:text-brand-700"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        {serviceExtras.filter((e) => !formSelectedExtras.has(e.id)).length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                setFormSelectedExtras((prev) => new Set([...prev, e.target.value]));
                              }
                            }}
                            className="h-8 rounded-full border border-dashed border-gray-300 bg-transparent px-3 text-sm text-gray-500 hover:border-brand-500 focus:outline-none"
                          >
                            <option value="">+ Add</option>
                            {serviceExtras
                              .filter((e) => !formSelectedExtras.has(e.id))
                              .map((e) => (
                                <option key={e.id} value={e.id}>{e.name} (+${e.price.toFixed(2)})</option>
                              ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Products section — only shown when products are available */}
                  {availableProducts.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Products</h4>
                      <div className="space-y-2">
                        {availableProducts.map((product) => {
                          const qty = formSelectedProducts.get(product.id) ?? 0;
                          return (
                            <div
                              key={product.id}
                              className="flex items-center gap-3 rounded-[.3rem] border border-[#f1f1f1] p-3 hover:bg-[#f9fafb]"
                            >
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">{product.name}</span>
                                <span className="ml-2 text-xs text-gray-500">({product.quantity_on_hand} in stock)</span>
                              </div>
                              <span className="text-sm font-medium text-gray-700">${product.sell_price.toFixed(2)}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormSelectedProducts((prev) => {
                                      const next = new Map(prev);
                                      if (qty <= 1) next.delete(product.id);
                                      else next.set(product.id, qty - 1);
                                      return next;
                                    });
                                  }}
                                  disabled={qty === 0}
                                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-sm font-medium">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormSelectedProducts((prev) => {
                                      const next = new Map(prev);
                                      const newQty = Math.min(qty + 1, product.quantity_on_hand);
                                      next.set(product.id, newQty);
                                      return next;
                                    });
                                  }}
                                  disabled={qty >= product.quantity_on_hand}
                                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Coupon — only shown when valid coupons exist */}
                  {validCoupons.length > 0 && (
                    <div>
                      <h4 className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Coupon</h4>
                      <select
                        value={formCouponId}
                        onChange={(e) => setFormCouponId(e.target.value)}
                        className={addInputClass}
                      >
                        <option value="">No coupon</option>
                        {validCoupons.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} ({c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value.toFixed(2)}`} off)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Notes */}
                  <textarea
                    value={formNotes}
                    onChange={(e) => setFormNotes(e.target.value)}
                    rows={3}
                    className={addTextareaClass}
                    placeholder="Add notes about this appointment..."
                  />

                  {/* Price breakdown */}
                  {formServiceId && (
                    <div className="rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] p-4">
                      <h4 className="mb-3 text-sm font-medium text-gray-900">Price Breakdown</h4>
                      {(() => {
                        const breakdown = calcCouponDiscount();
                        return (
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
                            {Array.from(formSelectedProducts.entries()).map(([productId, qty]) => {
                              const product = productList.find((p) => p.id === productId);
                              if (!product || qty <= 0) return null;
                              return (
                                <div key={productId} className="flex justify-between">
                                  <span className="text-gray-600">+ {product.name} x{qty}</span>
                                  <span className="text-gray-900">${(product.sell_price * qty).toFixed(2)}</span>
                                </div>
                              );
                            })}
                            {selectedCoupon && (
                              <div className="flex justify-between text-green-600">
                                <span>Discount ({selectedCoupon.code})</span>
                                <span>-${breakdown.discount.toFixed(2)}</span>
                              </div>
                            )}
                            <div className="border-t border-gray-300 pt-2">
                              <div className="flex justify-between font-semibold">
                                <span className="text-gray-900">Total</span>
                                <span className="text-gray-900">${breakdown.final.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  )}
                </div>
              )}


              {/* ====================================================== */}
              {/* VIEW / EDIT APPOINTMENT PANEL */}
              {/* ====================================================== */}
              {editing && (
                <div className="space-y-3">
                  {/* Row 1: Location */}
                  <div>
                    <span className="text-xs text-gray-400">Location</span>
                    <select
                      value={formLocationId}
                      onChange={(e) => setFormLocationId(e.target.value)}
                      className={editInputClass}
                    >
                      <option value="">No location</option>
                      {locationList.map((l) => (
                        <option key={l.id} value={l.id}>{l.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Row 2: Service 50% + Staff 50% */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-400">Service</span>
                      <div className="flex items-center gap-2">
                        {editing.services && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                            {getInitials(editing.services.name)}
                          </div>
                        )}
                        <select
                          value={formServiceId}
                          onChange={(e) => setFormServiceId(e.target.value)}
                          className={editInputClass}
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
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">Staff</span>
                      <div className="flex items-center gap-2">
                        {editing.staff && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-purple-100 text-xs font-bold text-purple-700">
                            {getInitials(editing.staff.name)}
                          </div>
                        )}
                        <select
                          value={formStaffId}
                          onChange={(e) => setFormStaffId(e.target.value)}
                          className={editInputClass}
                        >
                          <option value="">No staff</option>
                          {staffList.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Date & Time — human readable */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-xs text-gray-400">Date</span>
                      <div className="flex h-[46px] items-center text-sm text-gray-900">
                        {formatHumanDate(editing.start_time)}
                      </div>
                      <input type="hidden" value={formDate} />
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">Time</span>
                      <div className="flex h-[46px] items-center text-sm text-gray-900">
                        {formatTime(editing.start_time)} — {formatTime(editing.end_time)}
                      </div>
                    </div>
                  </div>

                  {/* Row 3: Customer 80% + Status indicator 20% */}
                  <div className="flex gap-3">
                    <div className="flex-[4]">
                      <span className="text-xs text-gray-400">Customer</span>
                      <div className="flex items-center gap-2">
                        {editing.customers && (
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
                            {getInitials(editing.customers.display_name)}
                          </div>
                        )}
                        <select
                          value={formCustomerId}
                          onChange={(e) => setFormCustomerId(e.target.value)}
                          className={editInputClass}
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
                    </div>
                    <div className="flex-[1] relative">
                      <span className="text-xs text-gray-400">Status</span>
                      <button
                        type="button"
                        onClick={() => setShowStatusPicker(!showStatusPicker)}
                        className="flex h-[46px] w-full items-center justify-center"
                      >
                        {(() => {
                          const sc = statusConfig[formStatus] ?? statusConfig.pending;
                          return (
                            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium ${sc.bg} ${sc.text} cursor-pointer`}>
                              <span className={`inline-block h-2.5 w-2.5 rounded-full ${sc.dot}`} />
                              {sc.label}
                            </span>
                          );
                        })()}
                      </button>
                      {showStatusPicker && (
                        <div className="absolute right-0 top-full z-10 mt-1 w-44 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                          {STATUS_OPTIONS.map((s) => {
                            const sc = statusConfig[s];
                            return (
                              <button
                                key={s}
                                type="button"
                                onClick={() => { setFormStatus(s); setShowStatusPicker(false); }}
                                className={`flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${formStatus === s ? 'bg-gray-50 font-medium' : ''}`}
                              >
                                <span className={`inline-block h-2 w-2 rounded-full ${sc.dot}`} />
                                {sc.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Extras — only shown when service has extras */}
                  {formServiceId && serviceExtras.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-400">Extras</span>
                      <div className="mt-1 flex flex-wrap items-center gap-2 rounded-[.3rem] border border-[#f1f1f1] p-3 min-h-[46px]">
                        {serviceExtras
                          .filter((e) => formSelectedExtras.has(e.id))
                          .map((extra) => (
                            <span key={extra.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                              {extra.name} (+${extra.price.toFixed(2)})
                              <button
                                type="button"
                                onClick={() => {
                                  setFormSelectedExtras((prev) => {
                                    const next = new Set(prev);
                                    next.delete(extra.id);
                                    return next;
                                  });
                                }}
                                className="ml-1 text-brand-400 hover:text-brand-700"
                              >
                                &times;
                              </button>
                            </span>
                          ))}
                        {/* Add more extras dropdown */}
                        {serviceExtras.filter((e) => !formSelectedExtras.has(e.id)).length > 0 && (
                          <select
                            value=""
                            onChange={(e) => {
                              if (e.target.value) {
                                setFormSelectedExtras((prev) => new Set([...prev, e.target.value]));
                              }
                            }}
                            className="h-8 rounded-full border border-dashed border-gray-300 bg-transparent px-3 text-sm text-gray-500 hover:border-brand-500 focus:outline-none"
                          >
                            <option value="">+ Add</option>
                            {serviceExtras
                              .filter((e) => !formSelectedExtras.has(e.id))
                              .map((e) => (
                                <option key={e.id} value={e.id}>{e.name} (+${e.price.toFixed(2)})</option>
                              ))}
                          </select>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Row 5: Products — only shown when products are available */}
                  {availableProducts.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-400">Products</span>
                      <div className="mt-1 space-y-2">
                        {availableProducts.map((product) => {
                          const qty = formSelectedProducts.get(product.id) ?? 0;
                          return (
                            <div
                              key={product.id}
                              className="flex items-center gap-3 rounded-[.3rem] border border-[#f1f1f1] p-3 hover:bg-[#f9fafb]"
                            >
                              <div className="flex-1">
                                <span className="text-sm font-medium text-gray-900">{product.name}</span>
                                <span className="ml-2 text-xs text-gray-500">({product.quantity_on_hand} in stock)</span>
                              </div>
                              <span className="text-sm font-medium text-gray-700">${product.sell_price.toFixed(2)}</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormSelectedProducts((prev) => {
                                      const next = new Map(prev);
                                      if (qty <= 1) next.delete(product.id);
                                      else next.set(product.id, qty - 1);
                                      return next;
                                    });
                                  }}
                                  disabled={qty === 0}
                                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                                >
                                  -
                                </button>
                                <span className="w-6 text-center text-sm font-medium">{qty}</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setFormSelectedProducts((prev) => {
                                      const next = new Map(prev);
                                      const newQty = Math.min(qty + 1, product.quantity_on_hand);
                                      next.set(product.id, newQty);
                                      return next;
                                    });
                                  }}
                                  disabled={qty >= product.quantity_on_hand}
                                  className="flex h-7 w-7 items-center justify-center rounded border border-gray-300 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-30"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Row 6: Coupon — only shown when valid coupons exist */}
                  {validCoupons.length > 0 && (
                    <div>
                      <span className="text-xs text-gray-400">Coupon</span>
                      <select
                        value={formCouponId}
                        onChange={(e) => setFormCouponId(e.target.value)}
                        className={editInputClass}
                      >
                        <option value="">No coupon</option>
                        {validCoupons.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.code} ({c.discount_type === 'percentage' ? `${c.discount_value}%` : `$${c.discount_value.toFixed(2)}`} off)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {/* Row 7: Notes */}
                  <div>
                    <span className="text-xs text-gray-400">Notes</span>
                    <textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      rows={3}
                      className={editTextareaClass}
                      placeholder="Add notes about this appointment..."
                    />
                  </div>

                  {/* Price Breakdown — same format as New Appointment panel */}
                  <div className="rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] p-4">
                    <h4 className="mb-3 text-sm font-medium text-gray-900">Price Breakdown</h4>
                    {(() => {
                      const breakdown = calcCouponDiscount();
                      const hasExtras = formSelectedExtras.size > 0;
                      const hasProducts = formSelectedProducts.size > 0;
                      return (
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-gray-600">Service: {selectedService?.name ?? editing.services?.name ?? ''}</span>
                            <span className="text-gray-900">${(selectedService?.price ?? editing.services?.price ?? editing.total_price ?? 0).toFixed(2)}</span>
                          </div>
                          {hasExtras && serviceExtras
                            .filter((e) => formSelectedExtras.has(e.id))
                            .map((e) => (
                              <div key={e.id} className="flex justify-between">
                                <span className="text-gray-600">+ {e.name}</span>
                                <span className="text-gray-900">${e.price.toFixed(2)}</span>
                              </div>
                            ))}
                          {hasProducts && Array.from(formSelectedProducts.entries()).map(([productId, qty]) => {
                            const product = productList.find((p) => p.id === productId);
                            if (!product || qty <= 0) return null;
                            return (
                              <div key={productId} className="flex justify-between">
                                <span className="text-gray-600">+ {product.name} x{qty}</span>
                                <span className="text-gray-900">${(product.sell_price * qty).toFixed(2)}</span>
                              </div>
                            );
                          })}
                          {selectedCoupon && (
                            <div className="flex justify-between text-green-600">
                              <span>Discount ({selectedCoupon.code})</span>
                              <span>-${breakdown.discount.toFixed(2)}</span>
                            </div>
                          )}
                          {editing.deposit_paid && editing.deposit_amount_paid != null && editing.deposit_amount_paid > 0 && (
                            <div className="flex justify-between text-blue-600">
                              <span>Deposit paid</span>
                              <span>-${editing.deposit_amount_paid.toFixed(2)}</span>
                            </div>
                          )}
                          <div className="border-t border-gray-300 pt-2">
                            <div className="flex justify-between font-semibold">
                              <span className="text-gray-900">Total</span>
                              <span className="text-gray-900">${breakdown.final.toFixed(2)}</span>
                            </div>
                            <div className="flex justify-between text-xs text-gray-500 mt-1">
                              <span>Duration</span>
                              <span>{calcDuration(editing.start_time, editing.end_time)} min</span>
                            </div>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                </div>
              )}
            </div>

            {/* Panel footer */}
            <div className="border-t border-gray-200 px-8 py-4">
              {formError && <p className="mb-3 text-sm text-red-600">{formError}</p>}
              <div className="flex gap-3">
                {editing && (
                  <button
                    onClick={() => handleDelete(editing.id)}
                    className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
                <div className="flex-1" />
                <button
                  onClick={closePanel}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
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
