'use client';

import { useEffect, useState, useCallback } from 'react';
import { ImageUpload } from '@/components/image-upload';

interface ServiceExtra {
  id?: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface ServiceStaffMember {
  staff_id: string;
  staff_name: string;
}

interface Service {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  duration_minutes: number;
  price: number;
  deposit_enabled: boolean;
  deposit_type: 'fixed' | 'percentage' | null;
  deposit_amount: number | null;
  image_url: string | null;
  color: string;
  description: string | null;
  buffer_time_before: number;
  buffer_time_after: number;
  custom_duration: boolean;
  is_recurring: boolean;
  capacity: number;
  hide_price: boolean;
  hide_duration: boolean;
  visibility: string;
  min_booking_lead_time: number;
  max_booking_days_ahead: number;
  min_extras: number;
  max_extras: number | null;
  booking_limit_per_customer: number | null;
  booking_limit_per_customer_interval: string | null;
  booking_limit_per_slot: number | null;
  booking_limit_per_slot_interval: string | null;
  timesheet: Record<string, unknown> | null;
  service_extras?: ServiceExtra[];
  service_staff?: ServiceStaffMember[];
}

interface StaffOption {
  id: string;
  name: string;
}

interface DayTimesheet {
  enabled: boolean;
  start: string;
  end: string;
}

type TimesheetData = Record<string, DayTimesheet>;

type TabKey = 'details' | 'staff' | 'timesheet' | 'extras' | 'settings' | 'booking-limiter';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'staff', label: 'Staff' },
  { key: 'timesheet', label: 'Time Sheet' },
  { key: 'extras', label: 'Extras' },
  { key: 'settings', label: 'Settings' },
  { key: 'booking-limiter', label: 'Booking Limiter' },
];

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];

const BUFFER_OPTIONS = [0, 5, 10, 15, 20, 30, 45, 60];

const CAPACITY_OPTIONS = [
  { value: 1, label: '1 (Individual)' },
  ...Array.from({ length: 19 }, (_, i) => ({ value: i + 2, label: `${i + 2} (Group)` })),
];

const LEAD_TIME_OPTIONS = [
  { value: 0, label: 'Disabled' },
  { value: 60, label: '1 hour' },
  { value: 120, label: '2 hours' },
  { value: 240, label: '4 hours' },
  { value: 480, label: '8 hours' },
  { value: 1440, label: '24 hours' },
  { value: 2880, label: '48 hours' },
];

const INTERVAL_OPTIONS = ['hour', 'day', 'week', 'month'];

const TIMESHEET_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function buildDefaultTimesheet(): TimesheetData {
  const ts: TimesheetData = {};
  for (const day of TIMESHEET_DAYS) {
    const key = day.toLowerCase();
    ts[key] = {
      enabled: key !== 'saturday' && key !== 'sunday',
      start: '09:00',
      end: '17:00',
    };
  }
  return ts;
}

export function ServiceForm({
  service,
  onClose,
  onDelete,
}: {
  service: Service | null;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const isEditMode = Boolean(service?.id);
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  // --- Details tab state ---
  const [name, setName] = useState(service?.name ?? '');
  const [categoryName, setCategoryName] = useState(service?.category_name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [imageUrl, setImageUrl] = useState(service?.image_url ?? '');
  const [price, setPrice] = useState(String(service?.price ?? ''));
  const [depositEnabled, setDepositEnabled] = useState(service?.deposit_enabled ?? false);
  const [depositType, setDepositType] = useState<'fixed' | 'percentage'>(service?.deposit_type ?? 'fixed');
  const [depositAmount, setDepositAmount] = useState(String(service?.deposit_amount ?? ''));
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 60));
  const [bufferTime, setBufferTime] = useState(String(Math.max(service?.buffer_time_before ?? 0, service?.buffer_time_after ?? 0)));
  const [customDuration, setCustomDuration] = useState(service?.custom_duration ?? false);
  const [capacity, setCapacity] = useState(String(service?.capacity ?? 1));
  const [hidePrice, setHidePrice] = useState(service?.hide_price ?? false);
  const [hideDuration, setHideDuration] = useState(service?.hide_duration ?? false);
  const [isRecurring, setIsRecurring] = useState(service?.is_recurring ?? false);

  // --- Staff tab state ---
  const [allStaff, setAllStaff] = useState<StaffOption[]>([]);
  const [selectedStaff, setSelectedStaff] = useState<ServiceStaffMember[]>(
    service?.service_staff ?? []
  );

  // --- Timesheet tab state ---
  const [timesheetEnabled, setTimesheetEnabled] = useState(service?.timesheet != null);
  const [timesheet, setTimesheet] = useState<TimesheetData>(
    (service?.timesheet as TimesheetData | null) ?? buildDefaultTimesheet()
  );

  // --- Extras tab state ---
  const [extras, setExtras] = useState<ServiceExtra[]>(service?.service_extras ?? []);

  // --- Settings tab state ---
  const [visibility, setVisibility] = useState(service?.visibility ?? 'public');
  const [minBookingLeadTime, setMinBookingLeadTime] = useState(String(service?.min_booking_lead_time ?? 0));
  const [maxDaysEnabled, setMaxDaysEnabled] = useState((service?.max_booking_days_ahead ?? 0) > 0);
  const [maxBookingDaysAhead, setMaxBookingDaysAhead] = useState(String(service?.max_booking_days_ahead ?? 60));
  const [minExtrasEnabled, setMinExtrasEnabled] = useState((service?.min_extras ?? 0) > 0);
  const [minExtras, setMinExtras] = useState(String(service?.min_extras ?? 0));
  const [maxExtrasEnabled, setMaxExtrasEnabled] = useState(service?.max_extras != null);
  const [maxExtras, setMaxExtras] = useState(String(service?.max_extras ?? 5));

  // --- Booking Limiter tab state ---
  const [limitPerCustomerEnabled, setLimitPerCustomerEnabled] = useState(
    service?.booking_limit_per_customer != null
  );
  const [limitPerCustomer, setLimitPerCustomer] = useState(
    String(service?.booking_limit_per_customer ?? 1)
  );
  const [limitPerCustomerInterval, setLimitPerCustomerInterval] = useState(
    service?.booking_limit_per_customer_interval ?? 'day'
  );
  const [limitPerSlotEnabled, setLimitPerSlotEnabled] = useState(
    service?.booking_limit_per_slot != null
  );
  const [limitPerSlot, setLimitPerSlot] = useState(
    String(service?.booking_limit_per_slot ?? 1)
  );
  const [limitPerSlotInterval, setLimitPerSlotInterval] = useState(
    service?.booking_limit_per_slot_interval ?? 'day'
  );

  // --- Category state ---
  const [allCategories, setAllCategories] = useState<{ id: string; name: string }[]>([]);
  const [addingNewCategory, setAddingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);

  // --- Recurring state ---
  const [recurringInterval, setRecurringInterval] = useState('week');
  const [recurringCount, setRecurringCount] = useState('1');

  // --- Custom duration state ---
  interface CustomDurationOption {
    label: string;
    duration: number;
    price: number;
    deposit: number;
    deposit_type: 'fixed' | 'percentage';
  }
  const [customDurationTitle, setCustomDurationTitle] = useState('');
  const [customDurationShowLabels, setCustomDurationShowLabels] = useState(true);
  const [customDurations, setCustomDurations] = useState<CustomDurationOption[]>(
    (service as unknown as Record<string, unknown>)?.custom_durations
      ? ((service as unknown as Record<string, unknown>).custom_durations as CustomDurationOption[])
      : []
  );

  // --- General ---
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Fetch staff and categories on mount
  const fetchInitialData = useCallback(() => {
    fetch('/api/staff')
      .then((res) => res.json())
      .then((json) => {
        const data = json.data as StaffOption[] | null;
        setAllStaff(data ?? []);
      })
      .catch(() => {});

    fetch('/api/tenant-categories')
      .then((res) => res.json())
      .then((json) => {
        const cats = (json.data ?? []) as { id: string; name: string }[];
        setAllCategories(cats.sort((a, b) => a.name.localeCompare(b.name)));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [fetchInitialData]);

  // --- Helpers ---
  function toggleStaff(staffId: string, staffName: string) {
    setSelectedStaff((prev) => {
      const exists = prev.find((s) => s.staff_id === staffId);
      if (exists) return prev.filter((s) => s.staff_id !== staffId);
      return [...prev, { staff_id: staffId, staff_name: staffName }];
    });
  }

  function removeStaff(staffId: string) {
    setSelectedStaff((prev) => prev.filter((s) => s.staff_id !== staffId));
  }

  function updateTimesheetDay(day: string, field: keyof DayTimesheet, value: boolean | string) {
    setTimesheet((prev) => {
      const current = prev[day] ?? { enabled: false, start: '09:00', end: '17:00' };
      return { ...prev, [day]: { ...current, [field]: value } };
    });
  }

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

    const isEdit = Boolean(service?.id);
    const body = {
      id: isEdit ? service?.id : undefined,
      name,
      category_name: categoryName || null,
      description: description || null,
      image_url: imageUrl || null,
      color: service?.color ?? '#6366f1',
      price: Number(price),
      duration_minutes: Number(duration),
      deposit_enabled: depositEnabled,
      deposit_type: depositEnabled ? depositType : null,
      deposit_amount: depositEnabled ? Number(depositAmount) : null,
      buffer_time_before: Number(bufferTime),
      buffer_time_after: Number(bufferTime),
      custom_duration: customDuration,
      custom_durations: customDuration ? customDurations : [],
      is_recurring: isRecurring,
      capacity: Number(capacity),
      hide_price: hidePrice,
      hide_duration: hideDuration,
      visibility,
      min_booking_lead_time: Number(minBookingLeadTime),
      max_booking_days_ahead: maxDaysEnabled ? Number(maxBookingDaysAhead) : 0,
      min_extras: minExtrasEnabled ? Number(minExtras) : 0,
      max_extras: maxExtrasEnabled ? Number(maxExtras) : null,
      booking_limit_per_customer: limitPerCustomerEnabled ? Number(limitPerCustomer) : null,
      booking_limit_per_customer_interval: limitPerCustomerEnabled ? limitPerCustomerInterval : null,
      booking_limit_per_slot: limitPerSlotEnabled ? Number(limitPerSlot) : null,
      booking_limit_per_slot_interval: limitPerSlotEnabled ? limitPerSlotInterval : null,
      timesheet: timesheetEnabled ? timesheet : null,
      staff: selectedStaff.map((s) => s.staff_id),
      extras: extras.filter((ex) => ex.name.trim()),
    };

    const res = await fetch('/api/services', {
      method: isEdit ? 'PATCH' : 'POST',
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

  // =========================================================================
  // Shared field rendering helpers for edit mode (horizontal label + hover input)
  // =========================================================================

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const selectClass = inputClass;

  /** Wraps a field in horizontal label-left / value-right layout for edit mode */
  function EditField({
    label,
    children,
  }: {
    label: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="group flex items-start gap-4">
        <span className="mt-2 w-36 flex-shrink-0 text-sm font-medium text-gray-500">{label}</span>
        <div className="flex-1">{children}</div>
      </div>
    );
  }

  /** Input that shows as plain text and reveals input on hover (edit mode) */
  function HoverInput({
    value,
    onChange,
    placeholder,
    type = 'text',
    required,
    prefix,
    min,
    step,
  }: {
    value: string;
    onChange: (v: string) => void;
    placeholder?: string;
    type?: string;
    required?: boolean;
    prefix?: string;
    min?: string;
    step?: string;
  }) {
    return (
      <div className="group/field">
        <div className="group-hover/field:hidden flex min-h-[36px] items-center rounded-lg px-3 py-2 text-sm text-gray-900">
          {prefix && <span className="mr-0.5 text-gray-500">{prefix}</span>}
          {value || <span className="text-gray-400">{placeholder || 'Not set'}</span>}
        </div>
        <div className="hidden group-hover/field:block">
          <div className="relative">
            {prefix && (
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">{prefix}</span>
            )}
            <input
              type={type}
              required={required}
              min={min}
              step={step}
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={placeholder}
              className={`${inputClass}${prefix ? ' pl-7' : ''}`}
            />
          </div>
        </div>
      </div>
    );
  }

  /** Select that shows as plain text and reveals select on hover (edit mode) */
  function HoverSelect({
    value,
    onChange,
    displayValue,
    children,
  }: {
    value: string;
    onChange: (v: string) => void;
    displayValue: string;
    children: React.ReactNode;
  }) {
    return (
      <div className="group/field">
        <div className="group-hover/field:hidden flex min-h-[36px] items-center rounded-lg px-3 py-2 text-sm text-gray-900">
          {displayValue || <span className="text-gray-400">Not set</span>}
        </div>
        <div className="hidden group-hover/field:block">
          <select value={value} onChange={(e) => onChange(e.target.value)} className={selectClass}>
            {children}
          </select>
        </div>
      </div>
    );
  }

  // =========================================================================
  // RENDER
  // =========================================================================

  function renderDetailsTab() {
    // ----- EDIT MODE: horizontal labels, hover-to-edit -----
    if (isEditMode) {
      return (
        <div className="space-y-4">
          {/* Image Upload */}
          <EditField label="Image">
            <ImageUpload value={imageUrl} onChange={setImageUrl} label="" />
          </EditField>

          {/* Name */}
          <EditField label="Service Name">
            <HoverInput required value={name} onChange={setName} placeholder="Service name" />
          </EditField>

          {/* Category */}
          <EditField label="Category">
            {addingNewCategory ? (
              <div className="flex gap-2">
                <input
                  value={newCategoryInput}
                  onChange={(e) => setNewCategoryInput(e.target.value)}
                  placeholder="Enter new category name..."
                  className={inputClass}
                  autoFocus
                />
                <button
                  type="button"
                  disabled={savingCategory}
                  onClick={async () => {
                    const trimmed = newCategoryInput.trim();
                    if (!trimmed) return;
                    setSavingCategory(true);
                    try {
                      const res = await fetch('/api/tenant-categories', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ name: trimmed }),
                      });
                      if (res.ok) {
                        setCategoryName(trimmed);
                        const catRes = await fetch('/api/tenant-categories');
                        const catJson = await catRes.json();
                        const cats = (catJson.data ?? []) as { id: string; name: string }[];
                        setAllCategories(cats.sort((a, b) => a.name.localeCompare(b.name)));
                      }
                    } catch {
                      // ignore
                    }
                    setSavingCategory(false);
                    setAddingNewCategory(false);
                    setNewCategoryInput('');
                  }}
                  className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingCategory ? 'Saving...' : 'Add'}
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingNewCategory(false); setNewCategoryInput(''); }}
                  className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <HoverSelect
                value={categoryName}
                onChange={(v) => {
                  if (v === '__new__') {
                    setAddingNewCategory(true);
                  } else {
                    setCategoryName(v);
                  }
                }}
                displayValue={categoryName || 'No category'}
              >
                <option value="">Select a category...</option>
                {allCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
                <option value="__new__">+ Add new category</option>
              </HoverSelect>
            )}
          </EditField>

          {/* Description */}
          <EditField label="Description">
            <div className="group/field">
              <div className="group-hover/field:hidden flex min-h-[36px] items-center rounded-lg px-3 py-2 text-sm text-gray-900">
                {description || <span className="text-gray-400">No description</span>}
              </div>
              <div className="hidden group-hover/field:block">
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Service description"
                  className={inputClass}
                />
              </div>
            </div>
          </EditField>

          {/* Price & Capacity side by side */}
          <div className="grid grid-cols-2 gap-4">
            <EditField label="Price">
              <HoverInput type="number" required min="0" step="0.01" value={price} onChange={setPrice} placeholder="0.00" prefix="$" />
            </EditField>
            <EditField label="Capacity">
              <HoverSelect
                value={capacity}
                onChange={setCapacity}
                displayValue={CAPACITY_OPTIONS.find((o) => String(o.value) === capacity)?.label ?? capacity}
              >
                {CAPACITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </HoverSelect>
            </EditField>
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
              <span className="text-sm font-medium text-gray-700">Enable Deposit</span>
            </label>
            {depositEnabled && (
              <div className="mt-3 grid grid-cols-2 gap-4">
                <EditField label="Deposit Type">
                  <HoverSelect
                    value={depositType}
                    onChange={(v) => setDepositType(v as 'fixed' | 'percentage')}
                    displayValue={depositType === 'percentage' ? 'Percentage' : 'Fixed amount'}
                  >
                    <option value="fixed">Fixed amount</option>
                    <option value="percentage">Percentage</option>
                  </HoverSelect>
                </EditField>
                <EditField label={depositType === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}>
                  <HoverInput
                    type="number"
                    min="0"
                    step={depositType === 'percentage' ? '1' : '0.01'}
                    value={depositAmount}
                    onChange={setDepositAmount}
                    placeholder="0"
                  />
                </EditField>
              </div>
            )}
          </div>

          {/* Duration & Buffer side by side */}
          <div className="grid grid-cols-2 gap-4">
            <EditField label="Duration">
              <HoverSelect
                value={duration}
                onChange={setDuration}
                displayValue={
                  Number(duration) >= 60
                    ? `${Math.floor(Number(duration) / 60)}h${Number(duration) % 60 ? ` ${Number(duration) % 60}m` : ''}`
                    : `${duration} min`
                }
              >
                {DURATION_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ''}` : `${d} min`}
                  </option>
                ))}
              </HoverSelect>
            </EditField>
            <EditField label="Buffer">
              <HoverSelect
                value={bufferTime}
                onChange={setBufferTime}
                displayValue={Number(bufferTime) === 0 ? 'None' : `${bufferTime} min`}
              >
                {BUFFER_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b === 0 ? 'None' : `${b} min`}
                  </option>
                ))}
              </HoverSelect>
            </EditField>
          </div>

          {/* Custom Duration Toggle */}
          <div className="rounded-lg border border-gray-200 p-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={customDuration}
                onChange={(e) => setCustomDuration(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm font-medium text-gray-700">Allow Custom Duration</span>
            </label>
            <p className="ml-6 mt-0.5 text-xs text-gray-400">Let customers choose from predefined duration options</p>
            {customDuration && renderCustomDurationSection()}
          </div>

          {/* Toggles Row */}
          <div className="space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hidePrice}
                onChange={(e) => setHidePrice(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm font-medium text-gray-700">Hide price on the booking page</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={hideDuration}
                onChange={(e) => setHideDuration(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm font-medium text-gray-700">Hide duration on the booking page</span>
            </label>
          </div>

          {/* Recurring Service */}
          <div className="rounded-lg border border-gray-200 p-4">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={isRecurring}
                onChange={(e) => setIsRecurring(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-brand-600"
              />
              <span className="text-sm font-medium text-gray-700">Recurring Service</span>
            </label>
            <p className="ml-6 mt-0.5 text-xs text-gray-400">Automatically rebook this service at a regular interval</p>
            {isRecurring && (
              <div className="mt-3 flex items-center gap-3">
                <EditField label="Every">
                  <HoverInput type="number" min="1" value={recurringCount} onChange={setRecurringCount} />
                </EditField>
                <EditField label="Interval">
                  <HoverSelect
                    value={recurringInterval}
                    onChange={setRecurringInterval}
                    displayValue={recurringInterval.charAt(0).toUpperCase() + recurringInterval.slice(1) + '(s)'}
                  >
                    <option value="day">Day(s)</option>
                    <option value="week">Week(s)</option>
                    <option value="month">Month(s)</option>
                  </HoverSelect>
                </EditField>
              </div>
            )}
          </div>
        </div>
      );
    }

    // ----- CREATE MODE: placeholders instead of labels, compact layout -----
    return (
      <div className="space-y-5">
        {/* Image Upload */}
        <ImageUpload value={imageUrl} onChange={setImageUrl} label="" />

        {/* Name */}
        <div>
          <input required value={name} onChange={(e) => setName(e.target.value)} placeholder="Service Name *" className={inputClass} />
        </div>

        {/* Category */}
        <div>
          {addingNewCategory ? (
            <div className="flex gap-2">
              <input
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="Enter new category name..."
                className={inputClass}
                autoFocus
              />
              <button
                type="button"
                disabled={savingCategory}
                onClick={async () => {
                  const trimmed = newCategoryInput.trim();
                  if (!trimmed) return;
                  setSavingCategory(true);
                  try {
                    const res = await fetch('/api/tenant-categories', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ name: trimmed }),
                    });
                    if (res.ok) {
                      setCategoryName(trimmed);
                      const catRes = await fetch('/api/tenant-categories');
                      const catJson = await catRes.json();
                      const cats = (catJson.data ?? []) as { id: string; name: string }[];
                      setAllCategories(cats.sort((a, b) => a.name.localeCompare(b.name)));
                    }
                  } catch {
                    // ignore
                  }
                  setSavingCategory(false);
                  setAddingNewCategory(false);
                  setNewCategoryInput('');
                }}
                className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {savingCategory ? 'Saving...' : 'Add'}
              </button>
              <button
                type="button"
                onClick={() => { setAddingNewCategory(false); setNewCategoryInput(''); }}
                className="whitespace-nowrap rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <select
                value={categoryName}
                onChange={(e) => {
                  if (e.target.value === '__new__') {
                    setAddingNewCategory(true);
                  } else {
                    setCategoryName(e.target.value);
                  }
                }}
                className={selectClass}
              >
                <option value="">Select a category...</option>
                {allCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>{cat.name}</option>
                ))}
                <option value="__new__">+ Add new category</option>
              </select>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Description"
            className={inputClass}
          />
        </div>

        {/* Price & Capacity side by side */}
        <div className="grid grid-cols-2 gap-4">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              className={`${inputClass} pl-7`}
            />
          </div>
          <select value={capacity} onChange={(e) => setCapacity(e.target.value)} className={selectClass}>
            {CAPACITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
            <span className="text-sm font-medium text-gray-700">Enable Deposit</span>
          </label>
          {depositEnabled && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <select
                  value={depositType}
                  onChange={(e) => setDepositType(e.target.value as 'fixed' | 'percentage')}
                  className={selectClass}
                >
                  <option value="fixed">Fixed amount</option>
                  <option value="percentage">Percentage</option>
                </select>
              </div>
              <div>
                <input
                  type="number"
                  min="0"
                  step={depositType === 'percentage' ? '1' : '0.01'}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  placeholder={depositType === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>

        {/* Duration & Buffer side by side */}
        <div className="grid grid-cols-2 gap-4">
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className={selectClass}>
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ''}` : `${d} min`}
              </option>
            ))}
          </select>
          <select value={bufferTime} onChange={(e) => setBufferTime(e.target.value)} className={selectClass}>
            <option value="0">Buffer: None</option>
            {BUFFER_OPTIONS.filter((b) => b > 0).map((b) => (
              <option key={b} value={b}>
                Buffer: {b} min
              </option>
            ))}
          </select>
        </div>

        {/* Custom Duration Toggle */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={customDuration}
              onChange={(e) => setCustomDuration(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Allow Custom Duration</span>
          </label>
          <p className="ml-6 mt-0.5 text-xs text-gray-400">Let customers choose from predefined duration options</p>
          {customDuration && renderCustomDurationSection()}
        </div>

        {/* Toggles Row */}
        <div className="space-y-3">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hidePrice}
              onChange={(e) => setHidePrice(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Hide price on the booking page</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={hideDuration}
              onChange={(e) => setHideDuration(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Hide duration on the booking page</span>
          </label>
        </div>

        {/* Recurring Service */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRecurring}
              onChange={(e) => setIsRecurring(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Recurring Service</span>
          </label>
          <p className="ml-6 mt-0.5 text-xs text-gray-400">Automatically rebook this service at a regular interval</p>
          {isRecurring && (
            <div className="mt-3 flex items-center gap-3">
              <div>
                <input
                  type="number"
                  min="1"
                  value={recurringCount}
                  onChange={(e) => setRecurringCount(e.target.value)}
                  placeholder="Every"
                  className={`${inputClass} w-20`}
                />
              </div>
              <div>
                <select
                  value={recurringInterval}
                  onChange={(e) => setRecurringInterval(e.target.value)}
                  className={selectClass}
                >
                  <option value="day">Day(s)</option>
                  <option value="week">Week(s)</option>
                  <option value="month">Month(s)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  /** Shared custom duration section used by both create and edit modes */
  function renderCustomDurationSection() {
    return (
      <div className="mt-4 space-y-4">
        {/* Title */}
        <div>
          <input
            value={customDurationTitle}
            onChange={(e) => setCustomDurationTitle(e.target.value)}
            placeholder="e.g. Choose your session length"
            className={inputClass}
          />
        </div>

        {/* Show Labels toggle */}
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={customDurationShowLabels}
            onChange={(e) => setCustomDurationShowLabels(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600"
          />
          <span className="text-sm text-gray-700">Show option labels to customers</span>
        </label>

        {/* Duration Options Table */}
        {customDurations.length > 0 && (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Label</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Duration (min)</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Price ($)</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Deposit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                  <th className="px-3 py-2 text-right text-xs font-medium uppercase text-gray-500" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {customDurations.map((opt, i) => {
                  function updateField(field: string, value: string | number) {
                    setCustomDurations((prev) => prev.map((item, j) =>
                      j === i ? { ...item, [field]: value } : item
                    ));
                  }
                  return (
                  <tr key={i}>
                    <td className="px-3 py-2">
                      <input
                        value={opt.label}
                        onChange={(e) => updateField('label', e.target.value)}
                        placeholder="e.g. Quick"
                        className="w-full rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="5"
                        step="5"
                        value={opt.duration || ''}
                        onChange={(e) => updateField('duration', Number(e.target.value))}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={opt.price || ''}
                        onChange={(e) => updateField('price', Number(e.target.value))}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={opt.deposit || ''}
                        onChange={(e) => updateField('deposit', Number(e.target.value))}
                        className="w-20 rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                      />
                    </td>
                    <td className="px-3 py-2">
                      <select
                        value={opt.deposit_type}
                        onChange={(e) => updateField('deposit_type', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none"
                      >
                        <option value="fixed">Fixed</option>
                        <option value="percentage">%</option>
                      </select>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setCustomDurations(customDurations.filter((_, j) => j !== i))}
                        className="text-red-500 hover:text-red-700"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <button
          type="button"
          onClick={() => setCustomDurations([...customDurations, { label: '', duration: 30, price: 0, deposit: 0, deposit_type: 'fixed' }])}
          className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-brand-600 hover:border-brand-400 hover:text-brand-700"
        >
          + Add Duration Option
        </button>
      </div>
    );
  }

  function renderStaffTab() {
    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-500">Select staff members who can perform this service.</p>

        {/* Selected staff chips */}
        {selectedStaff.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedStaff.map((s) => (
              <span
                key={s.staff_id}
                className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700"
              >
                {s.staff_name}
                <button
                  type="button"
                  onClick={() => removeStaff(s.staff_id)}
                  className="ml-1 text-brand-400 hover:text-brand-600"
                >
                  &times;
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Staff checkboxes */}
        <div className="space-y-2 rounded-lg border border-gray-200 p-4">
          {allStaff.length === 0 ? (
            <p className="text-sm text-gray-400">No staff members found. Add staff from the Staff page first.</p>
          ) : (
            allStaff.map((s) => {
              const checked = selectedStaff.some((sel) => sel.staff_id === s.id);
              return (
                <label key={s.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStaff(s.id, s.name)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                  />
                  <span className="text-sm text-gray-700">{s.name}</span>
                </label>
              );
            })
          )}
        </div>
      </div>
    );
  }

  function renderTimesheetTab() {
    return (
      <div className="space-y-5">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={timesheetEnabled}
            onChange={(e) => setTimesheetEnabled(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 text-brand-600"
          />
          <span className="text-sm font-medium text-gray-700">
            Configure specific timesheet for this service
          </span>
        </label>

        {timesheetEnabled && (
          <div className="space-y-2 rounded-lg border border-gray-200 p-4">
            {TIMESHEET_DAYS.map((day) => {
              const key = day.toLowerCase();
              const ds = timesheet[key] ?? { enabled: false, start: '09:00', end: '17:00' };
              return (
                <div key={day} className="flex items-center gap-3">
                  <label className="flex w-28 items-center gap-2">
                    <input
                      type="checkbox"
                      checked={ds.enabled}
                      onChange={(e) => updateTimesheetDay(key, 'enabled', e.target.checked)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    <span className="text-sm text-gray-700">{day}</span>
                  </label>
                  {ds.enabled && (
                    <>
                      <input
                        type="time"
                        value={ds.start}
                        onChange={(e) => updateTimesheetDay(key, 'start', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <span className="text-sm text-gray-400">to</span>
                      <input
                        type="time"
                        value={ds.end}
                        onChange={(e) => updateTimesheetDay(key, 'end', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  function renderExtrasTab() {
    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-500">Add optional extras / add-ons that customers can select.</p>

        {extras.length > 0 && (
          <div className="space-y-2">
            {/* Header */}
            <div className="grid grid-cols-[1fr_100px_100px_40px] gap-2 px-1">
              <span className="text-xs font-medium uppercase text-gray-500">Name</span>
              <span className="text-xs font-medium uppercase text-gray-500">Price ($)</span>
              <span className="text-xs font-medium uppercase text-gray-500">Duration (min)</span>
              <span />
            </div>
            {extras.map((extra, i) => (
              <div key={i} className="grid grid-cols-[1fr_100px_100px_40px] gap-2">
                <input
                  placeholder="Extra name"
                  value={extra.name}
                  onChange={(e) => updateExtra(i, 'name', e.target.value)}
                  className={inputClass}
                />
                <input
                  type="number"
                  placeholder="0.00"
                  min="0"
                  step="0.01"
                  value={extra.price || ''}
                  onChange={(e) => updateExtra(i, 'price', Number(e.target.value))}
                  className={inputClass}
                />
                <input
                  type="number"
                  placeholder="0"
                  min="0"
                  value={extra.duration_minutes || ''}
                  onChange={(e) => updateExtra(i, 'duration_minutes', Number(e.target.value))}
                  className={inputClass}
                />
                <button
                  type="button"
                  onClick={() => removeExtra(i)}
                  className="flex items-center justify-center text-red-500 hover:text-red-700"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path
                      fillRule="evenodd"
                      d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addExtra}
          className="rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm font-medium text-brand-600 hover:border-brand-400 hover:text-brand-700"
        >
          + Add Extra
        </button>
      </div>
    );
  }

  function renderSettingsTab() {
    return (
      <div className="space-y-5">
        {/* Visibility */}
        <div>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => setVisibility('public')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                visibility === 'public'
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Public
            </button>
            <button
              type="button"
              onClick={() => setVisibility('staff_only')}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                visibility === 'staff_only'
                  ? 'bg-brand-600 text-white'
                  : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              Staff Only
            </button>
          </div>
        </div>

        {/* Min Booking Lead Time */}
        <div>
          <select
            value={minBookingLeadTime}
            onChange={(e) => setMinBookingLeadTime(e.target.value)}
            className={selectClass}
          >
            {LEAD_TIME_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Max Booking Days Ahead */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={maxDaysEnabled}
              onChange={(e) => setMaxDaysEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Limit how far ahead customers can book</span>
          </label>
          {maxDaysEnabled && (
            <div className="mt-3">
              <input
                type="number"
                min="1"
                value={maxBookingDaysAhead}
                onChange={(e) => setMaxBookingDaysAhead(e.target.value)}
                placeholder="Maximum days ahead"
                className={`${inputClass} w-32`}
              />
            </div>
          )}
        </div>

        {/* Min Service Extras */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={minExtrasEnabled}
              onChange={(e) => setMinExtrasEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Require minimum number of extras</span>
          </label>
          {minExtrasEnabled && (
            <div className="mt-3">
              <input
                type="number"
                min="1"
                value={minExtras}
                onChange={(e) => setMinExtras(e.target.value)}
                placeholder="Minimum extras"
                className={`${inputClass} w-32`}
              />
            </div>
          )}
        </div>

        {/* Max Service Extras */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={maxExtrasEnabled}
              onChange={(e) => setMaxExtrasEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Limit maximum number of extras</span>
          </label>
          {maxExtrasEnabled && (
            <div className="mt-3">
              <input
                type="number"
                min="1"
                value={maxExtras}
                onChange={(e) => setMaxExtras(e.target.value)}
                placeholder="Maximum extras"
                className={`${inputClass} w-32`}
              />
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderBookingLimiterTab() {
    return (
      <div className="space-y-5">
        {/* Limit per customer */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={limitPerCustomerEnabled}
              onChange={(e) => setLimitPerCustomerEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Limit appointments per customer</span>
          </label>
          {limitPerCustomerEnabled && (
            <div className="mt-3 flex items-center gap-3">
              <div>
                <input
                  type="number"
                  min="1"
                  value={limitPerCustomer}
                  onChange={(e) => setLimitPerCustomer(e.target.value)}
                  placeholder="Max bookings"
                  className={`${inputClass} w-24`}
                />
              </div>
              <div>
                <select
                  value={limitPerCustomerInterval}
                  onChange={(e) => setLimitPerCustomerInterval(e.target.value)}
                  className={selectClass}
                >
                  {INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Limit per time slot */}
        <div className="rounded-lg border border-gray-200 p-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={limitPerSlotEnabled}
              onChange={(e) => setLimitPerSlotEnabled(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300 text-brand-600"
            />
            <span className="text-sm font-medium text-gray-700">Limit bookings per time slot</span>
          </label>
          {limitPerSlotEnabled && (
            <div className="mt-3 flex items-center gap-3">
              <div>
                <input
                  type="number"
                  min="1"
                  value={limitPerSlot}
                  onChange={(e) => setLimitPerSlot(e.target.value)}
                  placeholder="Max bookings"
                  className={`${inputClass} w-24`}
                />
              </div>
              <div>
                <select
                  value={limitPerSlotInterval}
                  onChange={(e) => setLimitPerSlotInterval(e.target.value)}
                  className={selectClass}
                >
                  {INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  function renderActiveTab() {
    switch (activeTab) {
      case 'details':
        return renderDetailsTab();
      case 'staff':
        return renderStaffTab();
      case 'timesheet':
        return renderTimesheetTab();
      case 'extras':
        return renderExtrasTab();
      case 'settings':
        return renderSettingsTab();
      case 'booking-limiter':
        return renderBookingLimiterTab();
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex h-full w-full flex-col">
      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-1">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`whitespace-nowrap px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? 'border-b-2 border-brand-600 text-brand-600'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Scrollable Tab Content */}
      <div className="flex-1 overflow-y-auto px-1 py-5">
        <div className="w-full">
          {renderActiveTab()}
          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="flex items-center gap-3 border-t border-gray-200 px-1 py-4">
        {/* Delete button (left-aligned, only in edit mode) */}
        {isEditMode && onDelete && service?.id && (
          <button
            type="button"
            onClick={() => onDelete(service.id)}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
          >
            Delete
          </button>
        )}
        <div className="flex-1" />
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : service?.id ? 'Update Service' : 'Create Service'}
        </button>
      </div>
    </form>
  );
}
