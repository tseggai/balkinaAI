'use client';

import { useEffect, useState, useCallback } from 'react';

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

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

const DURATION_OPTIONS = [5, 10, 15, 20, 30, 45, 60, 90, 120, 150, 180, 240, 300, 360, 420, 480];

const BUFFER_OPTIONS = [0, 5, 10, 15, 30, 45, 60];

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
}: {
  service: Service | null;
  onClose: () => void;
}) {
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  // --- Details tab state ---
  const [name, setName] = useState(service?.name ?? '');
  const [categoryName, setCategoryName] = useState(service?.category_name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [color, setColor] = useState(service?.color ?? '#6366f1');
  const [customColorInput, setCustomColorInput] = useState(
    service?.color && !PRESET_COLORS.includes(service.color) ? service.color : ''
  );
  const [price, setPrice] = useState(String(service?.price ?? ''));
  const [depositEnabled, setDepositEnabled] = useState(service?.deposit_enabled ?? false);
  const [depositType, setDepositType] = useState<'fixed' | 'percentage'>(service?.deposit_type ?? 'fixed');
  const [depositAmount, setDepositAmount] = useState(String(service?.deposit_amount ?? ''));
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 60));
  const [bufferBefore, setBufferBefore] = useState(String(service?.buffer_time_before ?? 0));
  const [bufferAfter, setBufferAfter] = useState(String(service?.buffer_time_after ?? 0));
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
  const [allCategories, setAllCategories] = useState<string[]>([]);
  const [addingNewCategory, setAddingNewCategory] = useState(false);
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // --- Recurring state ---
  const [recurringInterval, setRecurringInterval] = useState('week');
  const [recurringCount, setRecurringCount] = useState('1');

  // --- Custom duration state ---
  const [customDurationMin, setCustomDurationMin] = useState('');
  const [customDurationMax, setCustomDurationMax] = useState('');

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

    fetch('/api/services')
      .then((res) => res.json())
      .then((json) => {
        const services = (json.data ?? []) as { category_name: string | null }[];
        const cats = [...new Set(
          services
            .map((s) => s.category_name)
            .filter((c): c is string => c != null && c.trim() !== '')
        )].sort();
        setAllCategories(cats);
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
      color,
      price: Number(price),
      duration_minutes: Number(duration),
      deposit_enabled: depositEnabled,
      deposit_type: depositEnabled ? depositType : null,
      deposit_amount: depositEnabled ? Number(depositAmount) : null,
      buffer_time_before: Number(bufferBefore),
      buffer_time_after: Number(bufferAfter),
      custom_duration: customDuration,
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
  // RENDER
  // =========================================================================

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const selectClass = inputClass;
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

  function renderDetailsTab() {
    return (
      <div className="space-y-5">
        {/* Name */}
        <div>
          <label className={labelClass}>Service Name *</label>
          <input required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        {/* Category */}
        <div>
          <label className={labelClass}>Category</label>
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
                onClick={() => {
                  if (newCategoryInput.trim()) {
                    setCategoryName(newCategoryInput.trim());
                    if (!allCategories.includes(newCategoryInput.trim())) {
                      setAllCategories((prev) => [...prev, newCategoryInput.trim()].sort());
                    }
                  }
                  setAddingNewCategory(false);
                  setNewCategoryInput('');
                }}
                className="whitespace-nowrap rounded-lg bg-brand-600 px-3 py-2 text-sm font-medium text-white hover:bg-brand-700"
              >
                Add
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
                  <option key={cat} value={cat}>{cat}</option>
                ))}
                <option value="__new__">+ Add new category</option>
              </select>
            </div>
          )}
        </div>

        {/* Description */}
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className={inputClass}
          />
        </div>

        {/* Color Picker */}
        <div>
          <label className={labelClass}>Color</label>
          <div className="flex items-center gap-3">
            {PRESET_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => {
                  setColor(c);
                  setCustomColorInput('');
                }}
                className={`h-8 w-8 rounded-full border-2 transition-all ${
                  color === c ? 'border-gray-900 scale-110' : 'border-transparent'
                }`}
                style={{ backgroundColor: c }}
              />
            ))}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Custom:</span>
              <input
                type="text"
                placeholder="#hex"
                maxLength={7}
                value={customColorInput}
                onChange={(e) => {
                  setCustomColorInput(e.target.value);
                  if (/^#[0-9a-fA-F]{6}$/.test(e.target.value)) {
                    setColor(e.target.value);
                  }
                }}
                className="w-24 rounded-lg border border-gray-300 px-2 py-1 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
              {color && (
                <div
                  className="h-8 w-8 rounded-full border border-gray-300"
                  style={{ backgroundColor: color }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Price */}
        <div>
          <label className={labelClass}>Price</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">$</span>
            <input
              type="number"
              required
              min="0"
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className={`${inputClass} pl-7`}
            />
          </div>
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
                <label className={labelClass}>Deposit Type</label>
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
                <label className={labelClass}>
                  {depositType === 'percentage' ? 'Percentage (%)' : 'Amount ($)'}
                </label>
                <input
                  type="number"
                  min="0"
                  step={depositType === 'percentage' ? '1' : '0.01'}
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>

        {/* Duration */}
        <div>
          <label className={labelClass}>Duration</label>
          <select value={duration} onChange={(e) => setDuration(e.target.value)} className={selectClass}>
            {DURATION_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d >= 60 ? `${Math.floor(d / 60)}h${d % 60 ? ` ${d % 60}m` : ''}` : `${d} min`}
              </option>
            ))}
          </select>
        </div>

        {/* Buffer Times */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Buffer Time Before</label>
            <select value={bufferBefore} onChange={(e) => setBufferBefore(e.target.value)} className={selectClass}>
              {BUFFER_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b === 0 ? 'None' : `${b} min`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Buffer Time After</label>
            <select value={bufferAfter} onChange={(e) => setBufferAfter(e.target.value)} className={selectClass}>
              {BUFFER_OPTIONS.map((b) => (
                <option key={b} value={b}>
                  {b === 0 ? 'None' : `${b} min`}
                </option>
              ))}
            </select>
          </div>
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
          <p className="ml-6 mt-0.5 text-xs text-gray-400">Let customers choose a duration within a range</p>
          {customDuration && (
            <div className="mt-3 grid grid-cols-2 gap-4">
              <div>
                <label className={labelClass}>Min Duration (min)</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={customDurationMin}
                  onChange={(e) => setCustomDurationMin(e.target.value)}
                  placeholder="e.g. 15"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Max Duration (min)</label>
                <input
                  type="number"
                  min="5"
                  step="5"
                  value={customDurationMax}
                  onChange={(e) => setCustomDurationMax(e.target.value)}
                  placeholder="e.g. 120"
                  className={inputClass}
                />
              </div>
            </div>
          )}
        </div>

        {/* Capacity */}
        <div>
          <label className={labelClass}>Capacity</label>
          <select value={capacity} onChange={(e) => setCapacity(e.target.value)} className={selectClass}>
            {CAPACITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
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
                <label className={labelClass}>Every</label>
                <input
                  type="number"
                  min="1"
                  value={recurringCount}
                  onChange={(e) => setRecurringCount(e.target.value)}
                  className={`${inputClass} w-20`}
                />
              </div>
              <div>
                <label className={labelClass}>Interval</label>
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
          <label className={labelClass}>Visibility</label>
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
          <label className={labelClass}>Minimum Booking Lead Time</label>
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
              <label className={labelClass}>Maximum days ahead</label>
              <input
                type="number"
                min="1"
                value={maxBookingDaysAhead}
                onChange={(e) => setMaxBookingDaysAhead(e.target.value)}
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
              <label className={labelClass}>Minimum extras</label>
              <input
                type="number"
                min="1"
                value={minExtras}
                onChange={(e) => setMinExtras(e.target.value)}
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
              <label className={labelClass}>Maximum extras</label>
              <input
                type="number"
                min="1"
                value={maxExtras}
                onChange={(e) => setMaxExtras(e.target.value)}
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
                <label className={labelClass}>Max bookings</label>
                <input
                  type="number"
                  min="1"
                  value={limitPerCustomer}
                  onChange={(e) => setLimitPerCustomer(e.target.value)}
                  className={`${inputClass} w-24`}
                />
              </div>
              <div>
                <label className={labelClass}>Per</label>
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
                <label className={labelClass}>Max bookings</label>
                <input
                  type="number"
                  min="1"
                  value={limitPerSlot}
                  onChange={(e) => setLimitPerSlot(e.target.value)}
                  className={`${inputClass} w-24`}
                />
              </div>
              <div>
                <label className={labelClass}>Per</label>
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
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {service?.id ? 'Edit Service' : 'New Service'}
        </h1>
        <button onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </button>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 overflow-x-auto border-b border-gray-200">
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

      {/* Tab Content */}
      <form onSubmit={handleSubmit} className="max-w-2xl">
        {renderActiveTab()}

        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

        <div className="mt-6 flex gap-3 border-t border-gray-200 pt-6">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : service?.id ? 'Update Service' : 'Create Service'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
