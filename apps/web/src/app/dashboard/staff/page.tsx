'use client';

import { useEffect, useState, useCallback } from 'react';
import { ImageUpload } from '@/components/image-upload';

// ── Constants ──────────────────────────────────────────────────────────────────

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const INTERVAL_OPTIONS = ['hour', 'day', 'week', 'month'];

type TabKey = 'details' | 'schedule' | 'special-days' | 'holidays' | 'booking-limiter';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'details', label: 'Details' },
  { key: 'schedule', label: 'Weekly Schedule' },
  { key: 'special-days', label: 'Special Days' },
  { key: 'holidays', label: 'Holidays' },
  { key: 'booking-limiter', label: 'Booking Limiter' },
];

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface BreakSlot {
  start: string;
  end: string;
}

interface DaySchedule {
  enabled: boolean;
  start: string;
  end: string;
  breaks: BreakSlot[];
}

type WeekSchedule = Record<string, DaySchedule>;

interface StaffHoliday {
  id?: string;
  date: string;
  note: string;
}

interface SpecialDay {
  id?: string;
  date: string;
  start_time: string;
  end_time: string;
  is_day_off: boolean;
  breaks: BreakSlot[];
}

interface LocationOption {
  id: string;
  name: string;
}

interface ServiceOption {
  id: string;
  name: string;
}

interface StaffMember {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  profession: string | null;
  notes: string | null;
  is_active: boolean;
  status: string;
  image_url: string | null;
  availability_schedule: WeekSchedule;
  booking_limit_capacity: number | null;
  booking_limit_interval: string | null;
  services_count: number;
  service_ids: string[];
  location_ids: string[];
  staff_holidays: StaffHoliday[];
  staff_special_days: SpecialDay[];
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function defaultSchedule(): WeekSchedule {
  const schedule: WeekSchedule = {};
  for (const day of DAYS) {
    const key = day.toLowerCase();
    schedule[key] = {
      enabled: key !== 'saturday' && key !== 'sunday',
      start: '09:00',
      end: '17:00',
      breaks: [],
    };
  }
  return schedule;
}

const addInputClass =
  'w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const addTextareaClass =
  'w-full rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const editInputClass =
  'w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';
const editTextareaClass =
  'w-full rounded-[.3rem] border border-transparent bg-transparent px-0 py-1.5 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';

// ── SVG Icons ──────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function StaffPage() {
  // List state
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Panel state
  const [showPanel, setShowPanel] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('details');

  // Details tab state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [profession, setProfession] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [selectedLocationIds, setSelectedLocationIds] = useState<string[]>([]);
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  // Tag-pill dropdown state
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [showServiceDropdown, setShowServiceDropdown] = useState(false);

  // Schedule tab state
  const [schedule, setSchedule] = useState<WeekSchedule>(defaultSchedule());

  // Special days tab state
  const [specialDays, setSpecialDays] = useState<SpecialDay[]>([]);
  const [newSpecialDate, setNewSpecialDate] = useState('');

  // Holidays tab state
  const [holidays, setHolidays] = useState<StaffHoliday[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');

  // Booking limiter tab state
  const [bookingLimitEnabled, setBookingLimitEnabled] = useState(false);
  const [bookingLimitCapacity, setBookingLimitCapacity] = useState('1');
  const [bookingLimitInterval, setBookingLimitInterval] = useState('day');

  // Dropdowns data
  const [allLocations, setAllLocations] = useState<LocationOption[]>([]);
  const [allServices, setAllServices] = useState<ServiceOption[]>([]);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActing, setBulkActing] = useState(false);
  const [bulkStatusPickerOpen, setBulkStatusPickerOpen] = useState(false);

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteStaffName, setInviteStaffName] = useState('');
  const [inviteEmailSent, setInviteEmailSent] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);

  // General state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/staff');
    const json = await res.json();
    setStaff(json.data ?? []);
    setLoading(false);
  }, []);

  const fetchLocations = useCallback(async () => {
    const res = await fetch('/api/locations');
    const json = await res.json();
    setAllLocations(
      ((json.data ?? []) as { id: string; name: string }[]).map((l) => ({
        id: l.id,
        name: l.name,
      }))
    );
  }, []);

  const fetchServices = useCallback(async () => {
    const res = await fetch('/api/services');
    const json = await res.json();
    setAllServices(
      ((json.data ?? []) as { id: string; name: string }[]).map((s) => ({
        id: s.id,
        name: s.name,
      }))
    );
  }, []);

  useEffect(() => {
    fetchStaff();
    fetchLocations();
    fetchServices();
  }, [fetchStaff, fetchLocations, fetchServices]);

  // ── Invite handler ───────────────────────────────────────────────────────

  async function handleInvite(staffId: string, staffName: string) {
    setInviteLoading(true);
    setInviteCode('');
    setInviteStaffName(staffName);
    setInviteEmailSent(false);
    setInviteModalOpen(true);

    try {
      const res = await fetch('/api/staff/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staff_id: staffId }),
      });
      const json = await res.json() as { data?: { token: string; email_sent: boolean } | null; error?: { message: string } | null };
      if (json.error) {
        setError(json.error.message);
        setInviteModalOpen(false);
      } else if (json.data) {
        setInviteCode(json.data.token);
        setInviteEmailSent(json.data.email_sent);
      }
    } catch {
      setError('Failed to generate invite');
      setInviteModalOpen(false);
    } finally {
      setInviteLoading(false);
    }
  }

  // ── Panel open/close ───────────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setActiveTab('details');
    setFirstName('');
    setLastName('');
    setProfession('');
    setEmail('');
    setPhone('');
    setImageUrl('');
    setNotes('');
    setIsActive(true);
    setSelectedLocationIds([]);
    setSelectedServiceIds([]);
    setShowLocationDropdown(false);
    setShowServiceDropdown(false);
    setSchedule(defaultSchedule());
    setSpecialDays([]);
    setHolidays([]);
    setBookingLimitEnabled(false);
    setBookingLimitCapacity('1');
    setBookingLimitInterval('day');
    setError('');
    setShowPanel(true);
  }

  function openEdit(s: StaffMember) {
    setEditing(s);
    setActiveTab('details');
    const nameParts = (s.name || '').trim().split(/\s+/);
    setFirstName(nameParts[0] ?? '');
    setLastName(nameParts.slice(1).join(' '));
    setProfession(s.profession ?? '');
    setEmail(s.email);
    setPhone(s.phone ?? '');
    setImageUrl(s.image_url ?? '');
    setNotes(s.notes ?? '');
    setIsActive(s.is_active ?? s.status !== 'inactive');
    setSelectedLocationIds(s.location_ids ?? []);
    setSelectedServiceIds(s.service_ids ?? []);
    setShowLocationDropdown(false);
    setShowServiceDropdown(false);

    // Parse schedule - ensure breaks array exists on each day
    const parsed: WeekSchedule = defaultSchedule();
    if (typeof s.availability_schedule === 'object' && s.availability_schedule) {
      for (const day of DAYS) {
        const key = day.toLowerCase();
        const src = (s.availability_schedule as WeekSchedule)[key];
        if (src) {
          parsed[key] = {
            enabled: src.enabled ?? false,
            start: src.start ?? '09:00',
            end: src.end ?? '17:00',
            breaks: Array.isArray(src.breaks) ? src.breaks : [],
          };
        }
      }
    }
    setSchedule(parsed);

    // Holidays
    setHolidays(
      (s.staff_holidays ?? []).map((h) => ({
        id: h.id,
        date: h.date,
        note: (h as StaffHoliday).note ?? '',
      }))
    );

    // Special days
    setSpecialDays(
      (s.staff_special_days ?? []).map((sd) => ({
        id: sd.id,
        date: sd.date,
        start_time: sd.start_time ?? '09:00',
        end_time: sd.end_time ?? '17:00',
        is_day_off: sd.is_day_off ?? false,
        breaks: Array.isArray(sd.breaks) ? sd.breaks as BreakSlot[] : [],
      }))
    );

    // Booking limiter
    const hasLimit = s.booking_limit_capacity != null && s.booking_limit_capacity > 0;
    setBookingLimitEnabled(hasLimit);
    setBookingLimitCapacity(String(s.booking_limit_capacity ?? 1));
    setBookingLimitInterval(s.booking_limit_interval ?? 'day');

    setError('');
    setShowPanel(true);
  }

  function closePanel() {
    setShowPanel(false);
    setEditing(null);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this staff member?')) return;
    await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    closePanel();
    fetchStaff();
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} staff member(s)?`)) return;
    setBulkActing(true);
    for (const id of selectedIds) {
      await fetch(`/api/staff?id=${id}`, { method: 'DELETE' });
    }
    setSelectedIds([]);
    setBulkActing(false);
    fetchStaff();
  }

  async function handleBulkStatusChange(active: boolean) {
    if (selectedIds.length === 0) return;
    setBulkActing(true);
    setBulkStatusPickerOpen(false);
    for (const id of selectedIds) {
      await fetch('/api/staff', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, is_active: active }),
      });
    }
    setSelectedIds([]);
    setBulkActing(false);
    fetchStaff();
  }

  function toggleSelectAll() {
    if (selectedIds.length === filteredStaff.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredStaff.map((s) => s.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      return [...prev, id];
    });
  }

  function getInitials(name: string): string {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
    return (parts[0]![0] ?? '?').toUpperCase();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const isEdit = Boolean(editing?.id);

    const combinedName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const body: Record<string, unknown> = {
      id: isEdit ? editing?.id : undefined,
      name: combinedName,
      email,
      phone: phone || null,
      profession: profession || null,
      notes: notes || null,
      is_active: isActive,
      image_url: imageUrl || null,
      availability_schedule: schedule,
      booking_limit_capacity: bookingLimitEnabled ? Number(bookingLimitCapacity) : null,
      booking_limit_interval: bookingLimitEnabled ? bookingLimitInterval : null,
      staff_holidays: holidays.map((h) => ({ date: h.date, note: h.note || null })),
      service_ids: selectedServiceIds,
      location_ids: selectedLocationIds,
      staff_special_days: specialDays.map((sd) => ({
        date: sd.date,
        start_time: sd.start_time,
        end_time: sd.end_time,
        is_day_off: sd.is_day_off,
        breaks: sd.breaks,
      })),
    };

    const res = await fetch('/api/staff', {
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

    setSaving(false);
    // Refresh the list without closing the panel
    const refreshRes = await fetch('/api/staff');
    const refreshJson = await refreshRes.json();
    const refreshedStaff = refreshJson.data ?? [];
    setStaff(refreshedStaff);

    // If we just created a new staff member, switch to edit mode with the new data
    if (!isEdit && json.data?.id) {
      const newStaff = refreshedStaff.find((s: StaffMember) => s.id === json.data.id);
      if (newStaff) {
        openEdit(newStaff);
      }
    } else if (isEdit && editing) {
      // Update the editing state with refreshed data
      const updatedStaff = refreshedStaff.find((s: StaffMember) => s.id === editing.id);
      if (updatedStaff) {
        setEditing(updatedStaff);
        // Re-populate location and service IDs from refreshed data
        setSelectedLocationIds(updatedStaff.location_ids ?? []);
        setSelectedServiceIds(updatedStaff.service_ids ?? []);
      }
    }
  }

  // ── Schedule helpers ───────────────────────────────────────────────────────

  function updateDay(day: string, field: keyof Omit<DaySchedule, 'breaks'>, value: boolean | string) {
    setSchedule((prev) => {
      const current = prev[day] ?? { enabled: false, start: '09:00', end: '17:00', breaks: [] };
      return { ...prev, [day]: { ...current, [field]: value } };
    });
  }

  function addBreak(day: string) {
    setSchedule((prev) => {
      const current = prev[day] ?? { enabled: false, start: '09:00', end: '17:00', breaks: [] };
      return {
        ...prev,
        [day]: {
          ...current,
          breaks: [...current.breaks, { start: '12:00', end: '13:00' }],
        },
      };
    });
  }

  function updateBreak(day: string, index: number, field: 'start' | 'end', value: string) {
    setSchedule((prev) => {
      const current = prev[day] ?? { enabled: false, start: '09:00', end: '17:00', breaks: [] };
      const breaks = [...current.breaks];
      const brk = breaks[index];
      if (brk) {
        breaks[index] = { ...brk, [field]: value };
      }
      return { ...prev, [day]: { ...current, breaks } };
    });
  }

  function removeBreak(day: string, index: number) {
    setSchedule((prev) => {
      const current = prev[day] ?? { enabled: false, start: '09:00', end: '17:00', breaks: [] };
      return {
        ...prev,
        [day]: {
          ...current,
          breaks: current.breaks.filter((_, i) => i !== index),
        },
      };
    });
  }

  // ── Special Days helpers ───────────────────────────────────────────────────

  function addSpecialDay() {
    if (!newSpecialDate) return;
    if (specialDays.some((sd) => sd.date === newSpecialDate)) return;
    setSpecialDays([
      ...specialDays,
      { date: newSpecialDate, start_time: '09:00', end_time: '17:00', is_day_off: false, breaks: [] },
    ]);
    setNewSpecialDate('');
  }

  function updateSpecialDay(index: number, field: string, value: unknown) {
    const updated = [...specialDays];
    const item = updated[index];
    if (item) {
      (item as unknown as Record<string, unknown>)[field] = value;
    }
    setSpecialDays(updated);
  }

  function addSpecialDayBreak(index: number) {
    const updated = [...specialDays];
    const item = updated[index];
    if (item) {
      item.breaks = [...item.breaks, { start: '12:00', end: '13:00' }];
    }
    setSpecialDays(updated);
  }

  function removeSpecialDayBreak(dayIndex: number, breakIndex: number) {
    const updated = [...specialDays];
    const item = updated[dayIndex];
    if (item) {
      item.breaks = item.breaks.filter((_, i) => i !== breakIndex);
    }
    setSpecialDays(updated);
  }

  function removeSpecialDay(index: number) {
    setSpecialDays(specialDays.filter((_, i) => i !== index));
  }

  // ── Holidays helpers ───────────────────────────────────────────────────────

  function addHoliday() {
    if (!newHolidayDate) return;
    if (holidays.some((h) => h.date === newHolidayDate)) return;
    setHolidays([...holidays, { date: newHolidayDate, note: '' }]);
    setNewHolidayDate('');
  }

  function updateHolidayNote(index: number, note: string) {
    const updated = [...holidays];
    const item = updated[index];
    if (item) {
      updated[index] = { ...item, note };
    }
    setHolidays(updated);
  }

  function removeHoliday(index: number) {
    setHolidays(holidays.filter((_, i) => i !== index));
  }

  // ── Multi-select tag helpers ───────────────────────────────────────────────

  function removeLocation(id: string) {
    setSelectedLocationIds((prev) => prev.filter((x) => x !== id));
  }

  function addLocation(id: string) {
    setSelectedLocationIds((prev) => [...prev, id]);
    setShowLocationDropdown(false);
  }

  function removeService(id: string) {
    setSelectedServiceIds((prev) => prev.filter((x) => x !== id));
  }

  function addService(id: string) {
    setSelectedServiceIds((prev) => [...prev, id]);
    setShowServiceDropdown(false);
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filteredStaff = search.trim()
    ? staff.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : staff;

  // ── Tag pill renderer (shared between locations and services) ──────────────

  function renderTagPillSelect(
    label: string,
    allItems: { id: string; name: string }[],
    selectedItemIds: string[],
    onRemove: (id: string) => void,
    onAdd: (id: string) => void,
    showDropdown: boolean,
    setShowDropdownFn: (v: boolean) => void,
    emptyMessage: string,
  ) {
    const unselected = allItems.filter((item) => !selectedItemIds.includes(item.id));
    const selectedItems = allItems.filter((item) => selectedItemIds.includes(item.id));

    return (
      <div>
        {editing && <span className="text-xs text-gray-400">{label}</span>}
        {!editing && selectedItems.length === 0 && (
          <label className="mb-1 block text-sm font-medium text-gray-700">{label}</label>
        )}
        {!editing && selectedItems.length > 0 && (
          <label className="mb-1 block text-sm font-medium text-gray-700">
            {label} <span className="font-normal text-gray-400">({selectedItems.length} selected)</span>
          </label>
        )}
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-3 min-h-[42px]">
          {selectedItems.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700"
            >
              {item.name}
              <button
                type="button"
                onClick={() => onRemove(item.id)}
                className="ml-0.5 text-brand-400 hover:text-brand-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
          {allItems.length > 0 && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowDropdownFn(!showDropdown)}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
                Add
              </button>
              {showDropdown && (
                <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                  {unselected.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onAdd(item.id)}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50"
                    >
                      {item.name}
                    </button>
                  ))}
                  {unselected.length === 0 && (
                    <div className="px-3 py-2 text-sm text-gray-400">All {label.toLowerCase()} selected</div>
                  )}
                </div>
              )}
            </div>
          )}
          {allItems.length === 0 && (
            <span className="text-sm text-gray-400">{emptyMessage}</span>
          )}
        </div>
      </div>
    );
  }

  // ── Tab Renderers ──────────────────────────────────────────────────────────

  function renderDetailsTab() {
    const isEdit = Boolean(editing);

    if (isEdit) {
      // ── Edit mode: horizontal label + hover-to-edit fields ──
      return (
        <div className="space-y-5">
          {/* Image Upload */}
          <ImageUpload
            value={imageUrl}
            onChange={setImageUrl}
          />

          {/* First Name + Last Name */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-400">First Name *</span>
              <input
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="First Name *"
                className={editInputClass}
              />
            </div>
            <div>
              <span className="text-xs text-gray-400">Last Name</span>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Last Name"
                className={editInputClass}
              />
            </div>
          </div>

          {/* Profession */}
          <div>
            <span className="text-xs text-gray-400">Profession</span>
            <input
              value={profession}
              onChange={(e) => setProfession(e.target.value)}
              placeholder="e.g. Hair Stylist, Massage Therapist..."
              className={editInputClass}
            />
          </div>

          {/* Email + Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-xs text-gray-400">Email *</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email *"
                className={editInputClass}
              />
            </div>
            <div>
              <span className="text-xs text-gray-400">Phone</span>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Phone"
                className={editInputClass}
              />
            </div>
          </div>

          {/* Locations - tag pills */}
          {renderTagPillSelect(
            'Locations',
            allLocations,
            selectedLocationIds,
            removeLocation,
            addLocation,
            showLocationDropdown,
            setShowLocationDropdown,
            'No locations available. Add locations first.',
          )}

          {/* Services - tag pills */}
          {renderTagPillSelect(
            'Services',
            allServices,
            selectedServiceIds,
            removeService,
            addService,
            showServiceDropdown,
            setShowServiceDropdown,
            'No services available. Add services first.',
          )}

          {/* Notes */}
          <div>
            <span className="text-xs text-gray-400">Notes</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes"
              className={editTextareaClass}
            />
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Status</p>
              <p className="text-xs text-gray-500">{isActive ? 'Active' : 'Inactive'}</p>
            </div>
            <button
              type="button"
              onClick={() => setIsActive(!isActive)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                isActive ? 'bg-brand-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                  isActive ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>
      );
    }

    // ── Add mode: placeholders instead of labels ──
    return (
      <div className="space-y-5">
        {/* Image Upload */}
        <ImageUpload
          value={imageUrl}
          onChange={setImageUrl}
        />

        {/* First Name + Last Name */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <input
              required
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First Name *"
              className={addInputClass}
            />
          </div>
          <div>
            <input
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last Name"
              className={addInputClass}
            />
          </div>
        </div>

        {/* Profession */}
        <div>
          <input
            value={profession}
            onChange={(e) => setProfession(e.target.value)}
            placeholder="Profession (e.g. Hair Stylist, Massage Therapist...)"
            className={addInputClass}
          />
        </div>

        {/* Email + Phone */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email *"
              className={addInputClass}
            />
          </div>
          <div>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Phone"
              className={addInputClass}
            />
          </div>
        </div>

        {/* Locations - tag pills */}
        {renderTagPillSelect(
          'Locations',
          allLocations,
          selectedLocationIds,
          removeLocation,
          addLocation,
          showLocationDropdown,
          setShowLocationDropdown,
          'No locations available. Add locations first.',
        )}

        {/* Services - tag pills */}
        {renderTagPillSelect(
          'Services',
          allServices,
          selectedServiceIds,
          removeService,
          addService,
          showServiceDropdown,
          setShowServiceDropdown,
          'No services available. Add services first.',
        )}

        {/* Notes */}
        <div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Notes"
            className={addTextareaClass}
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
          <div>
            <p className="text-sm font-medium text-gray-900">Status</p>
            <p className="text-xs text-gray-500">{isActive ? 'Active' : 'Inactive'}</p>
          </div>
          <button
            type="button"
            onClick={() => setIsActive(!isActive)}
            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
              isActive ? 'bg-brand-600' : 'bg-gray-200'
            }`}
          >
            <span
              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
                isActive ? 'translate-x-5' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
      </div>
    );
  }

  function renderScheduleTab() {
    return (
      <div className="space-y-2">
        <p className="mb-3 text-sm text-gray-500">
          Set availability for each day of the week, including break periods.
        </p>
        <div className="space-y-3 rounded-lg border border-gray-200 p-4">
          {DAYS.map((day) => {
            const key = day.toLowerCase();
            const ds = schedule[key] ?? { enabled: false, start: '09:00', end: '17:00', breaks: [] };
            return (
              <div key={day} className="rounded-lg border border-gray-100 p-3">
                <div className="flex items-center gap-3">
                  <label className="relative inline-flex w-28 cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={ds.enabled} onChange={(e) => updateDay(key, 'enabled', e.target.checked)} className="peer sr-only" />
                    <div className="peer h-5 w-9 shrink-0 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                    <span className="text-sm font-medium text-gray-700">{day}</span>
                  </label>
                  {ds.enabled && (
                    <>
                      <input
                        type="time"
                        value={ds.start}
                        onChange={(e) => updateDay(key, 'start', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <span className="text-sm text-gray-400">to</span>
                      <input
                        type="time"
                        value={ds.end}
                        onChange={(e) => updateDay(key, 'end', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => addBreak(key)}
                        className="ml-auto text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        + Add Break
                      </button>
                    </>
                  )}
                </div>
                {/* Breaks */}
                {ds.enabled && ds.breaks.length > 0 && (
                  <div className="ml-32 mt-2 space-y-2">
                    {ds.breaks.map((brk, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Break:</span>
                        <input
                          type="time"
                          value={brk.start}
                          onChange={(e) => updateBreak(key, bIdx, 'start', e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                          type="time"
                          value={brk.end}
                          onChange={(e) => updateBreak(key, bIdx, 'end', e.target.value)}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => removeBreak(key, bIdx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  function renderSpecialDaysTab() {
    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          Add special days with custom hours or mark days off.
        </p>

        {/* Add special day */}
        <div className="flex items-end gap-3">
          <div>
            <input
              type="date"
              value={newSpecialDate}
              onChange={(e) => setNewSpecialDate(e.target.value)}
              placeholder="Date"
              className={addInputClass}
            />
          </div>
          <button
            type="button"
            onClick={addSpecialDay}
            disabled={!newSpecialDate}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {/* Special days list */}
        {specialDays.length === 0 ? (
          <p className="text-sm text-gray-400">No special days added.</p>
        ) : (
          <div className="space-y-3">
            {specialDays.map((sd, idx) => (
              <div key={idx} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-900">{sd.date}</span>
                  <button
                    type="button"
                    onClick={() => removeSpecialDay(idx)}
                    className="text-sm text-red-600 hover:text-red-800"
                  >
                    Delete
                  </button>
                </div>
                <div className="mt-3 flex items-center gap-4">
                  <label className="relative inline-flex cursor-pointer items-center gap-2">
                    <input type="checkbox" checked={sd.is_day_off} onChange={(e) => updateSpecialDay(idx, 'is_day_off', e.target.checked)} className="peer sr-only" />
                    <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                    <span className="text-sm text-gray-700">Day Off</span>
                  </label>
                  {!sd.is_day_off && (
                    <>
                      <input
                        type="time"
                        value={sd.start_time}
                        onChange={(e) => updateSpecialDay(idx, 'start_time', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <span className="text-sm text-gray-400">to</span>
                      <input
                        type="time"
                        value={sd.end_time}
                        onChange={(e) => updateSpecialDay(idx, 'end_time', e.target.value)}
                        className="rounded border border-gray-300 px-2 py-1 text-sm"
                      />
                      <button
                        type="button"
                        onClick={() => addSpecialDayBreak(idx)}
                        className="text-xs font-medium text-brand-600 hover:text-brand-700"
                      >
                        + Break
                      </button>
                    </>
                  )}
                </div>
                {/* Special day breaks */}
                {!sd.is_day_off && sd.breaks.length > 0 && (
                  <div className="mt-2 ml-4 space-y-2">
                    {sd.breaks.map((brk, bIdx) => (
                      <div key={bIdx} className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">Break:</span>
                        <input
                          type="time"
                          value={brk.start}
                          onChange={(e) => {
                            const updated = [...specialDays];
                            const item = updated[idx];
                            if (item) {
                              const breaks = [...item.breaks];
                              const b = breaks[bIdx];
                              if (b) {
                                breaks[bIdx] = { ...b, start: e.target.value };
                                item.breaks = breaks;
                              }
                            }
                            setSpecialDays(updated);
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                        <span className="text-xs text-gray-400">to</span>
                        <input
                          type="time"
                          value={brk.end}
                          onChange={(e) => {
                            const updated = [...specialDays];
                            const item = updated[idx];
                            if (item) {
                              const breaks = [...item.breaks];
                              const b = breaks[bIdx];
                              if (b) {
                                breaks[bIdx] = { ...b, end: e.target.value };
                                item.breaks = breaks;
                              }
                            }
                            setSpecialDays(updated);
                          }}
                          className="rounded border border-gray-300 px-2 py-1 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => removeSpecialDayBreak(idx, bIdx)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderHolidaysTab() {
    return (
      <div className="space-y-5">
        <p className="text-sm text-gray-500">
          Add dates when this staff member is unavailable (holidays, leave, etc).
        </p>

        {/* Add holiday */}
        <div className="flex items-end gap-3">
          <div>
            <input
              type="date"
              value={newHolidayDate}
              onChange={(e) => setNewHolidayDate(e.target.value)}
              placeholder="Date"
              className={addInputClass}
            />
          </div>
          <button
            type="button"
            onClick={addHoliday}
            disabled={!newHolidayDate}
            className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            Add
          </button>
        </div>

        {/* Holidays list */}
        {holidays.length === 0 ? (
          <p className="text-sm text-gray-400">No holidays added.</p>
        ) : (
          <div className="space-y-2">
            {holidays.map((h, idx) => (
              <div key={idx} className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
                <span className="text-sm font-medium text-gray-900 w-28">{h.date}</span>
                <input
                  value={h.note}
                  onChange={(e) => updateHolidayNote(idx, e.target.value)}
                  placeholder="Note (optional)"
                  className="flex-1 h-8 rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                />
                <button
                  type="button"
                  onClick={() => removeHoliday(idx)}
                  className="text-red-600 hover:text-red-800"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  function renderBookingLimiterTab() {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-gray-200 p-4">
          <div className="flex items-start">
            <div className="w-1/2">
              <label className="relative inline-flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={bookingLimitEnabled} onChange={(e) => setBookingLimitEnabled(e.target.checked)} className="peer sr-only" />
                <div className="peer h-5 w-9 shrink-0 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                <span className="text-sm font-medium text-gray-700">
                  Enable booking limit
                </span>
              </label>
            </div>
            {bookingLimitEnabled && (
              <div className="w-1/2 flex items-center gap-3">
                <input
                  type="number"
                  min="1"
                  value={bookingLimitCapacity}
                  onChange={(e) => setBookingLimitCapacity(e.target.value)}
                  placeholder="Capacity"
                  className={`${addInputClass} w-24`}
                />
                <select
                  value={bookingLimitInterval}
                  onChange={(e) => setBookingLimitInterval(e.target.value)}
                  className={addInputClass}
                >
                  {INTERVAL_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt.charAt(0).toUpperCase() + opt.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  function renderActiveTab() {
    switch (activeTab) {
      case 'details':
        return renderDetailsTab();
      case 'schedule':
        return renderScheduleTab();
      case 'special-days':
        return renderSpecialDaysTab();
      case 'holidays':
        return renderHolidaysTab();
      case 'booking-limiter':
        return renderBookingLimiterTab();
    }
  }

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Staff</h1>
          <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            {staff.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <PlusIcon />
            Add Staff
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search staff by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      {/* Bulk action bar */}
      {selectedIds.length > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5">
          <span className="text-sm font-medium text-brand-700">
            {selectedIds.length} selected
          </span>
          <div className="h-4 w-px bg-brand-200" />
          <div className="relative">
            <button
              type="button"
              onClick={() => setBulkStatusPickerOpen(!bulkStatusPickerOpen)}
              disabled={bulkActing}
              className="rounded-lg border border-brand-300 bg-white px-3 py-1.5 text-sm font-medium text-brand-700 hover:bg-brand-100 disabled:opacity-50"
            >
              Change Status
            </button>
            {bulkStatusPickerOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange(true)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                  Active
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkStatusChange(false)}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50"
                >
                  <span className="inline-block h-2 w-2 rounded-full bg-yellow-500" />
                  Inactive
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={handleBulkDelete}
            disabled={bulkActing}
            className="rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </button>
          <div className="flex-1" />
          <button
            type="button"
            onClick={() => { setSelectedIds([]); setBulkStatusPickerOpen(false); }}
            className="text-sm text-brand-600 hover:text-brand-800"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Content */}
      <div className="mt-6">
        {loading ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center text-sm text-gray-500">
            Loading...
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">
              {search.trim() ? 'No staff members match your search.' : 'No staff members yet.'}
            </p>
            {!search.trim() && (
              <button
                onClick={openNew}
                className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Add your first team member
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="w-10 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={filteredStaff.length > 0 && selectedIds.length === filteredStaff.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Photo</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Phone</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Profession</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Services</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredStaff.map((s) => (
                    <tr
                      key={s.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest('[data-checkbox-cell]')) return;
                        openEdit(s);
                      }}
                    >
                      {/* Checkbox */}
                      <td data-checkbox-cell className="w-10 whitespace-nowrap px-4 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(s.id)}
                          onChange={() => toggleSelect(s.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600"
                        />
                      </td>
                      {/* Photo */}
                      <td className="whitespace-nowrap px-4 py-3">
                        {s.image_url ? (
                          <img src={s.image_url} alt={s.name} className="h-8 w-8 rounded-full object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700">
                            {getInitials(s.name)}
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                        {s.name}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{s.email}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {s.phone ?? '\u2014'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {s.profession ?? '\u2014'}
                      </td>
                      {/* Status - tag pill (like Service visibility) */}
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        {s.is_active !== false ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                            Inactive
                          </span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {s.services_count}
                      </td>
                      <td data-checkbox-cell className="whitespace-nowrap px-4 py-3 text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleInvite(s.id, s.name);
                          }}
                          className="rounded-md bg-brand-50 px-3 py-1.5 text-xs font-medium text-brand-700 hover:bg-brand-100"
                        >
                          Invite
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Invite Modal */}
      {inviteModalOpen && (
        <>
          <div className="fixed inset-0 z-50 bg-black/40" onClick={() => setInviteModalOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-gray-900">Invite {inviteStaffName}</h3>
              {inviteLoading ? (
                <div className="flex justify-center py-8">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
                </div>
              ) : inviteCode ? (
                <div className="mt-4">
                  <p className="text-sm text-gray-600">Share this invite code with your staff member:</p>
                  <div className="mt-3 flex items-center justify-center gap-3">
                    <span className="rounded-lg bg-gray-100 px-6 py-3 font-mono text-2xl font-bold tracking-widest text-brand-700">
                      {inviteCode}
                    </span>
                    <button
                      onClick={() => { navigator.clipboard.writeText(inviteCode); }}
                      className="rounded-md bg-brand-50 px-3 py-2 text-sm font-medium text-brand-700 hover:bg-brand-100"
                    >
                      Copy
                    </button>
                  </div>
                  {inviteEmailSent && (
                    <p className="mt-3 text-center text-sm text-green-600">Invite email sent!</p>
                  )}
                  <p className="mt-3 text-center text-xs text-gray-500">Code expires in 7 days</p>
                </div>
              ) : null}
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setInviteModalOpen(false)}
                  className="rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Slide-in Panel */}
      {showPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Staff' : 'Add Staff'}
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
            <div className="flex gap-1 overflow-x-auto border-b border-gray-200 px-6">
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

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto px-8 py-3">
                {renderActiveTab()}
                {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
              </div>

              {/* Footer */}
              <div className="flex items-center gap-3 border-t border-gray-200 px-8 py-4">
                {editing && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editing.id)}
                    className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
                <div className="flex-1" />
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update' : 'Add Staff'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
