'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { BulkActionBar } from '@/components/bulk-action-bar';
import { ImageUpload } from '@/components/image-upload';

// ── Constants ──────────────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = ['hour', 'day', 'week', 'month'];

const TIMEZONE_OPTIONS = [
  'Pacific/Midway', 'Pacific/Honolulu', 'America/Anchorage', 'America/Los_Angeles',
  'America/Denver', 'America/Phoenix', 'America/Chicago', 'America/New_York',
  'America/Indianapolis', 'America/Halifax', 'America/St_Johns', 'America/Sao_Paulo',
  'Atlantic/South_Georgia', 'Atlantic/Azores', 'Europe/London', 'Europe/Paris',
  'Europe/Berlin', 'Europe/Helsinki', 'Europe/Istanbul', 'Asia/Dubai',
  'Asia/Karachi', 'Asia/Kolkata', 'Asia/Kathmandu', 'Asia/Dhaka',
  'Asia/Bangkok', 'Asia/Hong_Kong', 'Asia/Shanghai', 'Asia/Tokyo',
  'Asia/Seoul', 'Australia/Sydney', 'Australia/Adelaide', 'Australia/Brisbane',
  'Australia/Perth', 'Pacific/Auckland', 'Pacific/Fiji',
  'America/Argentina/Buenos_Aires', 'America/Bogota', 'America/Caracas',
  'America/Mexico_City', 'America/Toronto', 'America/Vancouver', 'America/Winnipeg',
  'Africa/Cairo', 'Africa/Johannesburg', 'Africa/Lagos', 'Africa/Nairobi',
  'Asia/Baghdad', 'Asia/Jerusalem', 'Asia/Riyadh', 'Asia/Singapore',
  'Asia/Taipei', 'Europe/Amsterdam', 'Europe/Athens', 'Europe/Bucharest',
  'Europe/Dublin', 'Europe/Kiev', 'Europe/Lisbon', 'Europe/Madrid',
  'Europe/Moscow', 'Europe/Oslo', 'Europe/Prague', 'Europe/Rome',
  'Europe/Stockholm', 'Europe/Vienna', 'Europe/Warsaw', 'Europe/Zurich',
  'Pacific/Guam',
];

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  address: string;
  street_address: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string;
  phone: string | null;
  description: string | null;
  image_url: string | null;
  booking_limit_enabled: boolean;
  booking_limit_capacity: number | null;
  booking_limit_interval: string | null;
  created_at: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const addInputClass =
  'w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const addTextareaClass =
  'w-full rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const editInputClass =
  'w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';
const editTextareaClass =
  'w-full rounded-[.3rem] border border-transparent bg-transparent px-0 py-1.5 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';

// ── Component ──────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  // List state
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  // Panel state
  const [showPanel, setShowPanel] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('');
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [bookingLimitEnabled, setBookingLimitEnabled] = useState(false);
  const [bookingLimitCapacity, setBookingLimitCapacity] = useState('1');
  const [bookingLimitInterval, setBookingLimitInterval] = useState('day');
  const [galleryChanged, setGalleryChanged] = useState(false);
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const [bulkDeleting, setBulkDeleting] = useState(false);

  const initialFormValues = useRef<Record<string, unknown>>({});

  // General state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Google Places autocomplete
  const addressInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    const g = window as unknown as { google?: { maps?: unknown } };
    if (g.google?.maps) {
      setMapsLoaded(true);
      return;
    }
    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
      existing.addEventListener('load', () => setMapsLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !showPanel || !addressInputRef.current || autocompleteRef.current) return;
    const autocomplete = new google.maps.places.Autocomplete(addressInputRef.current, {
      types: ['establishment', 'geocode'],
    });
    autocompleteRef.current = autocomplete;

    autocomplete.addListener('place_changed', () => {
      const place = autocomplete.getPlace();
      if (!place) return;
      if (place.formatted_address) {
        setAddress(place.formatted_address);
      }
      if (place.geometry?.location) {
        const newLat = place.geometry.location.lat();
        const newLng = place.geometry.location.lng();
        setLat(newLat);
        setLng(newLng);
      }
      // Extract structured address components from Google Places
      const components = (place as unknown as { address_components?: { long_name: string; short_name: string; types: string[] }[] }).address_components;
      if (components) {
        let streetNum = '';
        let route = '';
        for (const comp of components) {
          const types = comp.types;
          if (types.includes('street_number')) streetNum = comp.long_name;
          else if (types.includes('route')) route = comp.long_name;
          else if (types.includes('locality') || types.includes('postal_town')) setCity(comp.long_name);
          else if (types.includes('administrative_area_level_1')) setState(comp.short_name);
          else if (types.includes('country')) setCountry(comp.long_name);
          else if (types.includes('postal_code')) setPostalCode(comp.long_name);
          else if (types.includes('subpremise')) setAddressLine2(comp.long_name);
        }
        const street = streetNum ? `${streetNum} ${route}` : route;
        if (street) setStreetAddress(street);
      }
    });
  }, [mapsLoaded, showPanel]);

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchLocations = useCallback(async () => {
    const res = await fetch('/api/locations');
    const json = await res.json();
    setLocations(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  // ── Selection helpers ────────────────────────────────────────────────────────

  function toggleSelectAll() {
    if (selectedIds.length === locations.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(locations.map((l) => l.id));
    }
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  // ── Panel open/close ───────────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setName('');
    setAddress('');
    setStreetAddress('');
    setAddressLine2('');
    setCity('');
    setState('');
    setPostalCode('');
    setCountry('');
    setTimezone('');
    setLat(null);
    setLng(null);
    setPhone('');
    setDescription('');
    setImageUrl('');
    setBookingLimitEnabled(false);
    setBookingLimitCapacity('1');
    setBookingLimitInterval('day');
    setGalleryChanged(false);
    setError('');
    autocompleteRef.current = null;
    setShowPanel(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setName(loc.name);
    setAddress(loc.address);
    setStreetAddress(loc.street_address ?? '');
    setAddressLine2(loc.address_line2 ?? '');
    setCity(loc.city ?? '');
    setState(loc.state ?? '');
    setPostalCode(loc.postal_code ?? '');
    setCountry(loc.country ?? '');
    setTimezone(loc.timezone ?? '');
    setLat(loc.latitude);
    setLng(loc.longitude);
    setPhone(loc.phone ?? '');
    setDescription(loc.description ?? '');
    setImageUrl(loc.image_url ?? '');
    const hasLimit = loc.booking_limit_enabled ?? false;
    setBookingLimitEnabled(hasLimit);
    setBookingLimitCapacity(String(loc.booking_limit_capacity ?? 1));
    setBookingLimitInterval(loc.booking_limit_interval ?? 'day');
    initialFormValues.current = {
      name: loc.name,
      address: loc.address,
      streetAddress: loc.street_address ?? '',
      addressLine2: loc.address_line2 ?? '',
      city: loc.city ?? '',
      state: loc.state ?? '',
      postalCode: loc.postal_code ?? '',
      country: loc.country ?? '',
      timezone: loc.timezone ?? '',
      lat: loc.latitude,
      lng: loc.longitude,
      phone: loc.phone ?? '',
      description: loc.description ?? '',
      imageUrl: loc.image_url ?? '',
      bookingLimitEnabled: hasLimit,
      bookingLimitCapacity: String(loc.booking_limit_capacity ?? 1),
      bookingLimitInterval: loc.booking_limit_interval ?? 'day',
    };
    setGalleryChanged(false);
    setError('');
    autocompleteRef.current = null;
    setShowPanel(true);
  }

  function closePanel() {
    setShowPanel(false);
    setEditing(null);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async function handleBulkDelete() {
    if (!confirm(`Delete ${selectedIds.length} location(s)?`)) return;
    setBulkDeleting(true);
    await Promise.all(selectedIds.map(id => fetch(`/api/locations?id=${id}`, { method: 'DELETE' })));
    setSelectedIds([]);
    setBulkDeleting(false);
    fetchLocations();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this location?')) return;
    await fetch(`/api/locations?id=${id}`, { method: 'DELETE' });
    closePanel();
    fetchLocations();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    // Build full address from structured fields for backward compatibility
    const fullAddress = [streetAddress, city, state, postalCode, country].filter(Boolean).join(', ') || address;

    const body: Record<string, unknown> = {
      id: editing?.id,
      name,
      address: fullAddress,
      street_address: streetAddress || null,
      address_line2: addressLine2 || null,
      city: city || null,
      state: state || null,
      postal_code: postalCode || null,
      country: country || null,
      timezone: timezone || 'UTC',
      latitude: lat ?? null,
      longitude: lng ?? null,
      phone: phone || null,
      description: description || null,
      image_url: imageUrl || null,
      booking_limit_enabled: bookingLimitEnabled,
      booking_limit_capacity: bookingLimitEnabled ? Number(bookingLimitCapacity) : null,
      booking_limit_interval: bookingLimitEnabled ? bookingLimitInterval : null,
    };

    const res = await fetch('/api/locations', {
      method: editing ? 'PATCH' : 'POST',
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
    const refreshRes = await fetch('/api/locations');
    const refreshJson = await refreshRes.json();
    const refreshedLocations = (refreshJson.data ?? []) as Location[];
    setLocations(refreshedLocations);

    // If we just created a new location, switch to edit mode
    if (!editing && json.data?.id) {
      const newLoc = refreshedLocations.find((l) => l.id === json.data.id);
      if (newLoc) {
        openEdit(newLoc);
      }
    } else if (editing) {
      const updatedLoc = refreshedLocations.find((l) => l.id === editing.id);
      if (updatedLoc) {
        setEditing(updatedLoc);
      }
    }
    initialFormValues.current = {
      name, address, streetAddress, addressLine2, city, state, postalCode, country,
      timezone, lat, lng, phone, description, imageUrl,
      bookingLimitEnabled, bookingLimitCapacity, bookingLimitInterval,
    };
  }

  // Dirty-state tracking
  const currentLocationValues = {
    name, address, streetAddress, addressLine2, city, state, postalCode, country,
    timezone, lat, lng, phone, description, imageUrl,
    bookingLimitEnabled, bookingLimitCapacity, bookingLimitInterval,
  };
  const isDirty = galleryChanged || JSON.stringify(currentLocationValues) !== JSON.stringify(initialFormValues.current);

  // ── Slide-in Panel ─────────────────────────────────────────────────────────

  function renderPanel() {
    const isEdit = !!editing;

    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={closePanel}
        />
        {/* Panel */}
        <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
            <h2 className="text-lg font-semibold text-gray-900">
              {isEdit ? 'Edit Location' : 'Add Location'}
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

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-5 overflow-y-auto px-8 py-3">
              {/* Photo Upload - First field */}
              <ImageUpload
                value={imageUrl}
                onChange={setImageUrl}
                label=""
              />

              {/* Name */}
              <div>
                {isEdit ? (
                  <div>
                    <span className="text-xs text-gray-400">Name</span>
                    <input
                      required
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Location Name *"
                      className={editInputClass}
                    />
                  </div>
                ) : (
                  <input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Location Name *"
                    className={addInputClass}
                  />
                )}
              </div>

              {/* Address — Google Places Autocomplete + Structured Fields */}
              <div className="space-y-3">
                {/* Search field — Google Places Autocomplete fills structured fields below */}
                <div>
                  {isEdit ? (
                    <div>
                      <span className="text-xs text-gray-400">Search Address</span>
                      <input
                        ref={addressInputRef}
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="Start typing to search an address..."
                        className={editInputClass}
                        autoComplete="off"
                      />
                    </div>
                  ) : (
                    <input
                      ref={addressInputRef}
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Search address (auto-fills fields below)..."
                      className={addInputClass}
                      autoComplete="off"
                    />
                  )}
                  <p className="mt-1 text-[11px] text-gray-400">Type to search — fields below will auto-fill</p>
                </div>

                {/* Country */}
                <div>
                  {isEdit ? (
                    <div>
                      <span className="text-xs text-gray-400">Country</span>
                      <input
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        placeholder="Country"
                        className={editInputClass}
                      />
                    </div>
                  ) : (
                    <input
                      value={country}
                      onChange={(e) => setCountry(e.target.value)}
                      placeholder="Country"
                      className={addInputClass}
                    />
                  )}
                </div>

                {/* Street Address */}
                <div>
                  {isEdit ? (
                    <div>
                      <span className="text-xs text-gray-400">Street Address</span>
                      <input
                        value={streetAddress}
                        onChange={(e) => setStreetAddress(e.target.value)}
                        placeholder="Street Address"
                        className={editInputClass}
                      />
                    </div>
                  ) : (
                    <input
                      value={streetAddress}
                      onChange={(e) => setStreetAddress(e.target.value)}
                      placeholder="Street Address"
                      className={addInputClass}
                    />
                  )}
                </div>

                {/* Address Line 2 */}
                <div>
                  {isEdit ? (
                    <div>
                      <span className="text-xs text-gray-400">Address Line 2</span>
                      <input
                        value={addressLine2}
                        onChange={(e) => setAddressLine2(e.target.value)}
                        placeholder="Apt, Suite, Unit (Optional)"
                        className={editInputClass}
                      />
                    </div>
                  ) : (
                    <input
                      value={addressLine2}
                      onChange={(e) => setAddressLine2(e.target.value)}
                      placeholder="Apt, Suite, Unit (Optional)"
                      className={addInputClass}
                    />
                  )}
                </div>

                {/* City + State row */}
                <div className="flex gap-3">
                  <div className="flex-1">
                    {isEdit ? (
                      <div>
                        <span className="text-xs text-gray-400">City</span>
                        <input
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="City"
                          className={editInputClass}
                        />
                      </div>
                    ) : (
                      <input
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="City"
                        className={addInputClass}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    {isEdit ? (
                      <div>
                        <span className="text-xs text-gray-400">State / Province</span>
                        <input
                          value={state}
                          onChange={(e) => setState(e.target.value)}
                          placeholder="State / Province"
                          className={editInputClass}
                        />
                      </div>
                    ) : (
                      <input
                        value={state}
                        onChange={(e) => setState(e.target.value)}
                        placeholder="State / Province"
                        className={addInputClass}
                      />
                    )}
                  </div>
                </div>

                {/* Postal Code */}
                <div className="w-1/2">
                  {isEdit ? (
                    <div>
                      <span className="text-xs text-gray-400">ZIP / Postal Code</span>
                      <input
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                        placeholder="ZIP / Postal Code"
                        className={editInputClass}
                      />
                    </div>
                  ) : (
                    <input
                      value={postalCode}
                      onChange={(e) => setPostalCode(e.target.value)}
                      placeholder="ZIP / Postal Code"
                      className={addInputClass}
                    />
                  )}
                </div>

                {/* Map display after entering address */}
                {lat != null && lng != null && (
                  <div>
                    <p className="text-xs text-gray-500">
                      Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
                    </p>
                    {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=600x200&markers=color:red%7C${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                        alt="Location preview"
                        className="mt-2 w-full rounded-lg border border-gray-200"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Phone */}
              <div>
                {isEdit ? (
                  <div>
                    <span className="text-xs text-gray-400">Phone</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="Phone (+1 (555) 123-4567)"
                      className={editInputClass}
                    />
                  </div>
                ) : (
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Phone (+1 (555) 123-4567)"
                    className={addInputClass}
                  />
                )}
              </div>

              {/* Description */}
              <div>
                {isEdit ? (
                  <div>
                    <span className="text-xs text-gray-400">Description</span>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={3}
                      placeholder="Brief description of this location..."
                      className={editTextareaClass}
                    />
                  </div>
                ) : (
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                    placeholder="Brief description of this location..."
                    className={addTextareaClass}
                  />
                )}
              </div>

              {/* Timezone - Dropdown */}
              <div>
                {isEdit ? (
                  <div>
                    <span className="text-xs text-gray-400">Timezone</span>
                    <select
                      value={timezone}
                      onChange={(e) => setTimezone(e.target.value)}
                      className={editInputClass}
                    >
                      <option value="">Select timezone</option>
                      {TIMEZONE_OPTIONS.map((tz) => (
                        <option key={tz} value={tz}>{tz}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <select
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className={addInputClass}
                  >
                    <option value="">Select timezone</option>
                    {TIMEZONE_OPTIONS.map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Booking Limiter - fixed widths */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Booking Limiter</h3>
                <div className="flex items-center gap-4">
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
                    <div className="flex w-1/2 items-center gap-2">
                      <input
                        type="number"
                        min="1"
                        value={bookingLimitCapacity}
                        onChange={(e) => setBookingLimitCapacity(e.target.value)}
                        placeholder="Capacity"
                        className={`${isEdit ? editInputClass : addInputClass} !w-24`}
                      />
                      <select
                        value={bookingLimitInterval}
                        onChange={(e) => setBookingLimitInterval(e.target.value)}
                        className={`${isEdit ? editInputClass : addInputClass} !w-28`}
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

              {/* Gallery Photos — only show when editing an existing location */}
              {isEdit && editing && (
                <LocationGallery locationId={editing.id} onChanged={() => setGalleryChanged(true)} />
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-gray-200 px-8 py-4">
              {isEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(editing!.id)}
                  className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isEdit ? (!isDirty || saving) : saving}
                style={isEdit ? { opacity: (!isDirty || saving) ? 0.5 : 1 } : undefined}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : isEdit ? 'Update Location' : 'Add Location'}
              </button>
            </div>
          </form>
        </div>
      </>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Locations</h1>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
            {locations.length}
          </span>
        </div>
        <button
          onClick={openNew}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          + Add Location
        </button>
      </div>

      {/* Bulk action bar - above the table */}
      <BulkActionBar
        selectedCount={selectedIds.length}
        totalCount={locations.length}
        onDelete={handleBulkDelete}
        onClearSelection={() => setSelectedIds([])}
        deleting={bulkDeleting}
      />

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : locations.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No locations yet.</p>
            <button
              onClick={openNew}
              className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
            >
              Add your first location
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === locations.length && locations.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Image
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Address / City
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Timezone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Booking Limit
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {locations.map((loc) => (
                  <tr
                    key={loc.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openEdit(loc)}
                  >
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(loc.id)}
                        onChange={() => toggleSelect(loc.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {loc.image_url ? (
                        <img
                          src={loc.image_url}
                          alt={loc.name}
                          className="h-10 w-10 rounded-lg border border-gray-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-gray-100">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={1.5}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {loc.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {loc.city || loc.state ? (
                        <div>
                          <div className="font-medium text-gray-900">{[loc.city, loc.state].filter(Boolean).join(', ')}</div>
                          {loc.country && <div className="text-xs text-gray-400">{loc.country}</div>}
                        </div>
                      ) : (
                        <span className="text-gray-500">{loc.address || '\u2014'}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {loc.phone || '\u2014'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {loc.timezone || '\u2014'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {loc.booking_limit_enabled ? (
                        <span className="inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                          {loc.booking_limit_capacity}/{loc.booking_limit_interval}
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-500">
                          Off
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-in Panel */}
      {showPanel && renderPanel()}
    </div>
  );
}

// ── Location Gallery Component ───────────────────────────────────────────────

interface GalleryPhoto {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

function LocationGallery({ locationId, onChanged }: { locationId: string; onChanged?: () => void }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`/api/gallery?locationId=${locationId}`);
    const json = await res.json() as { photos: GalleryPhoto[] };
    setPhotos(json.photos ?? []);
    setLoading(false);
  }, [locationId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      if (photos.length >= 15) break;
      const form = new FormData();
      form.append('file', file);
      form.append('locationId', locationId);
      const res = await fetch('/api/gallery', { method: 'POST', body: form });
      if (res.ok) {
        const json = await res.json() as { photo: GalleryPhoto };
        setPhotos(prev => [...prev, json.photo]);
      }
    }

    setUploading(false);
    onChanged?.();
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDelete(id: string) {
    await fetch(`/api/gallery?id=${id}`, { method: 'DELETE' });
    setPhotos(prev => prev.filter(p => p.id !== id));
    onChanged?.();
  }

  function handleDragStart(idx: number) { setDragIdx(idx); }

  async function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return; }
    const reordered = [...photos];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved!);
    const updated = reordered.map((p, i) => ({ ...p, sort_order: i }));
    setPhotos(updated);
    setDragIdx(null);
    await fetch('/api/gallery', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: updated.map(p => ({ id: p.id, sort_order: p.sort_order })) }),
    });
  }

  if (loading) return <div className="py-4 text-center text-xs text-gray-400">Loading gallery...</div>;

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-gray-900">Gallery Photos</h3>
          <p className="text-xs text-gray-500">{photos.length}/15 photos. Photos save automatically.</p>
        </div>
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading || photos.length >= 15}
          className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Add Photos'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleUpload} />
      </div>

      {photos.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-200 p-8 text-center">
          <p className="text-xs text-gray-400">No gallery photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
              className={`group relative aspect-square cursor-grab overflow-hidden rounded-lg border ${dragIdx === idx ? 'border-brand-500 opacity-50' : 'border-gray-200'}`}
            >
              <img src={photo.image_url} alt={photo.caption ?? ''} className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => handleDelete(photo.id)}
                className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1 text-white hover:bg-black/80 group-hover:block"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
