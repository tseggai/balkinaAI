'use client';

import { useEffect, useState, useCallback, useRef } from 'react';

// ── Constants ──────────────────────────────────────────────────────────────────

const INTERVAL_OPTIONS = ['hour', 'day', 'week', 'month'];

// ── Interfaces ─────────────────────────────────────────────────────────────────

interface Location {
  id: string;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
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

const inputClass =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

// ── Component ──────────────────────────────────────────────────────────────────

export default function LocationsPage() {
  // List state
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // Panel state
  const [showPanel, setShowPanel] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);

  // Form state
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [timezone, setTimezone] = useState('');
  const [detectingTimezone, setDetectingTimezone] = useState(false);
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [bookingLimitEnabled, setBookingLimitEnabled] = useState(false);
  const [bookingLimitCapacity, setBookingLimitCapacity] = useState('1');
  const [bookingLimitInterval, setBookingLimitInterval] = useState('day');
  const [phone, setPhone] = useState('');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  // General state
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Google Places autocomplete
  const addressContainerRef = useRef<HTMLDivElement>(null);
  const autocompleteElRef = useRef<HTMLElement | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).google) {
      setMapsLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&loading=async`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !addressContainerRef.current || autocompleteElRef.current) return;
    // Use the new PlaceAutocompleteElement (web component)
    const placeAutocomplete = new (google.maps.places as unknown as { PlaceAutocompleteElement: new (opts: { types?: string[]; componentRestrictions?: { country: string } }) => HTMLElement & { addEventListener: (event: string, handler: (e: unknown) => void) => void } }).PlaceAutocompleteElement({});
    // Style the element to match our form inputs
    placeAutocomplete.style.cssText = 'width:100%;';
    addressContainerRef.current.innerHTML = '';
    addressContainerRef.current.appendChild(placeAutocomplete);
    autocompleteElRef.current = placeAutocomplete;

    placeAutocomplete.addEventListener('gmp-placeselect', async (event: unknown) => {
      const e = event as { place?: { displayName?: string; formattedAddress?: string; location?: { lat: () => number; lng: () => number }; fetchFields?: (opts: { fields: string[] }) => Promise<void> } };
      const place = e.place;
      if (!place) return;
      // Fetch full place details if needed
      if (place.fetchFields) {
        await place.fetchFields({ fields: ['displayName', 'formattedAddress', 'location'] });
      }
      if (place.formattedAddress) {
        setAddress(place.formattedAddress);
      }
      if (place.location) {
        const newLat = place.location.lat();
        const newLng = place.location.lng();
        setLat(newLat);
        setLng(newLng);
        // Auto-detect timezone via Google Maps Timezone API
        setDetectingTimezone(true);
        try {
          const timestamp = Math.floor(Date.now() / 1000);
          const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
          if (apiKey) {
            const tzRes = await fetch(
              `https://maps.googleapis.com/maps/api/timezone/json?location=${newLat},${newLng}&timestamp=${timestamp}&key=${apiKey}`
            );
            const tzJson = await tzRes.json() as { status: string; timeZoneId?: string };
            if (tzJson.status === 'OK' && tzJson.timeZoneId) {
              setTimezone(tzJson.timeZoneId);
            }
          }
        } catch {
          // Timezone detection failure — non-fatal
        }
        setDetectingTimezone(false);
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

  // ── Panel open/close ───────────────────────────────────────────────────────

  function openNew() {
    setEditing(null);
    setName('');
    setAddress('');
    setTimezone('');
    setLat(null);
    setLng(null);
    setPhone('');
    setDescription('');
    setImageUrl('');
    setBookingLimitEnabled(false);
    setBookingLimitCapacity('1');
    setBookingLimitInterval('day');
    setError('');
    autocompleteElRef.current = null;
    setShowPanel(true);
  }

  function openEdit(loc: Location) {
    setEditing(loc);
    setName(loc.name);
    setAddress(loc.address);
    setTimezone(loc.timezone ?? '');
    setLat(loc.lat);
    setLng(loc.lng);
    setPhone(loc.phone ?? '');
    setDescription(loc.description ?? '');
    setImageUrl(loc.image_url ?? '');
    const hasLimit = loc.booking_limit_enabled ?? false;
    setBookingLimitEnabled(hasLimit);
    setBookingLimitCapacity(String(loc.booking_limit_capacity ?? 1));
    setBookingLimitInterval(loc.booking_limit_interval ?? 'day');
    setError('');
    autocompleteElRef.current = null;
    setShowPanel(true);
  }

  function closePanel() {
    setShowPanel(false);
    setEditing(null);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async function handleDelete(id: string) {
    if (!confirm('Delete this location?')) return;
    await fetch(`/api/locations?id=${id}`, { method: 'DELETE' });
    fetchLocations();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const body: Record<string, unknown> = {
      id: editing?.id,
      name,
      address,
      timezone: timezone || 'UTC',
      lat: lat ?? null,
      lng: lng ?? null,
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
    closePanel();
    fetchLocations();
  }

  // ── Slide-in Panel ─────────────────────────────────────────────────────────

  function renderPanel() {
    return (
      <>
        {/* Backdrop */}
        <div
          className="fixed inset-0 z-40 bg-black/30 transition-opacity"
          onClick={closePanel}
        />
        {/* Panel */}
        <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[50%] sm:min-w-[480px]">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
            <h2 className="text-xl font-bold text-gray-900">
              {editing ? 'Edit Location' : 'Add Location'}
            </h2>
            <button
              onClick={closePanel}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Body */}
          <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {/* Image URL */}
              <div>
                <label className={labelClass}>Image URL</label>
                <input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://example.com/image.jpg"
                  className={inputClass}
                />
                {imageUrl && (
                  <img
                    src={imageUrl}
                    alt="Location"
                    className="mt-2 h-32 w-full rounded-lg border border-gray-200 object-cover"
                  />
                )}
              </div>

              {/* Name */}
              <div>
                <label className={labelClass}>Location Name *</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className={inputClass}
                />
              </div>

              {/* Phone */}
              <div>
                <label className={labelClass}>Phone</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className={inputClass}
                />
              </div>

              {/* Description */}
              <div>
                <label className={labelClass}>Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  placeholder="Brief description of this location..."
                  className={inputClass}
                />
              </div>

              {/* Address — PlaceAutocompleteElement */}
              <div>
                <label className={labelClass}>Address *</label>
                <div ref={addressContainerRef} className="w-full" />
                {/* Fallback manual input if Maps API not loaded */}
                {!mapsLoaded && (
                  <input
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Start typing an address..."
                    className={inputClass}
                    autoComplete="off"
                  />
                )}
                {address && <p className="mt-1 text-xs text-gray-500">{address}</p>}
                {lat != null && lng != null && (
                  <div className="mt-2">
                    <p className="text-xs text-gray-500">
                      Lat: {lat.toFixed(6)}, Lng: {lng.toFixed(6)}
                    </p>
                    {process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && (
                      <img
                        src={`https://maps.googleapis.com/maps/api/staticmap?center=${lat},${lng}&zoom=15&size=400x200&markers=color:red%7C${lat},${lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`}
                        alt="Location preview"
                        className="mt-2 w-full rounded-lg border border-gray-200"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Timezone (auto-detected) */}
              {(timezone || detectingTimezone) && (
                <div>
                  <label className={labelClass}>Timezone</label>
                  <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                    {detectingTimezone ? 'Detecting timezone...' : timezone}
                  </p>
                </div>
              )}

              {/* Booking Limiter */}
              <div className="rounded-lg border border-gray-200 p-4">
                <h3 className="mb-3 text-sm font-semibold text-gray-900">Booking Limiter</h3>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={bookingLimitEnabled}
                    onChange={(e) => setBookingLimitEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Enable booking limit for this location
                  </span>
                </label>
                {bookingLimitEnabled && (
                  <div className="mt-3 flex items-center gap-3">
                    <div>
                      <label className={labelClass}>Capacity</label>
                      <input
                        type="number"
                        min="1"
                        value={bookingLimitCapacity}
                        onChange={(e) => setBookingLimitCapacity(e.target.value)}
                        className={`${inputClass} w-24`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Per</label>
                      <select
                        value={bookingLimitInterval}
                        onChange={(e) => setBookingLimitInterval(e.target.value)}
                        className={inputClass}
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

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            {/* Footer */}
            <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
              <button
                type="submit"
                disabled={saving}
                className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : editing ? 'Update Location' : 'Add Location'}
              </button>
              <button
                type="button"
                onClick={closePanel}
                className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </>
    );
  }

  // ── Main Render ────────────────────────────────────────────────────────────

  return (
    <div className="p-6 lg:p-8">
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
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Name
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                    Address
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
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {locations.map((loc) => (
                  <tr key={loc.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {loc.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{loc.address}</td>
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
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <button
                        onClick={() => openEdit(loc)}
                        className="mr-3 text-brand-600 hover:text-brand-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDelete(loc.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
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
