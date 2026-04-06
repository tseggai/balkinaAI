'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

const CATEGORIES = [
  'Beauty & Personal Care',
  'Health & Wellness',
  'Fitness & Sports',
  'Medical & Dental',
  'Home Services',
  'Professional Services',
  'Education & Tutoring',
  'Pet Services',
  'Automotive',
  'Events & Entertainment',
  'Food & Nutrition',
  'Other',
];

const CURRENCIES = [
  { code: 'EUR', symbol: '\u20AC' },
  { code: 'USD', symbol: '$' },
  { code: 'GBP', symbol: '\u00A3' },
];

const INPUT = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors';

interface ServiceRow {
  name: string;
  duration: string;
  price: string;
}

const EMPTY_SERVICE: ServiceRow = { name: '', duration: '', price: '' };

/* ─── Google Places Autocomplete (same as tenant locations page) ────── */

interface ParsedAddress {
  formatted: string;
  street: string;
  city: string;
  state: string;
  country: string;
  postal_code: string;
}

function LocationInput({ onSelect, onManualEdit }: { onSelect: (addr: ParsedAddress) => void; onManualEdit: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [mapsLoaded, setMapsLoaded] = useState(false);

  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    const win = window as { google?: { maps?: unknown } };
    if (win.google?.maps) { setMapsLoaded(true); return; }
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const check = setInterval(() => {
        if ((window as { google?: { maps?: unknown } }).google?.maps) { setMapsLoaded(true); clearInterval(check); }
      }, 100);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places`;
    script.async = true;
    script.onload = () => setMapsLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!mapsLoaded || !inputRef.current || autocompleteRef.current) return;
    try {
      const ac = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['establishment', 'geocode'],
      });
      autocompleteRef.current = ac;

      ac.addListener('place_changed', () => {
        const place = ac.getPlace();
        if (!place) return;

        const parsed: ParsedAddress = { formatted: place.formatted_address || '', street: '', city: '', state: '', country: '', postal_code: '' };
        const components = (place as unknown as { address_components?: { long_name: string; short_name: string; types: string[] }[] }).address_components;
        if (components) {
          let streetNum = '';
          let route = '';
          for (const comp of components) {
            const t = comp.types;
            if (t.includes('street_number')) streetNum = comp.long_name;
            else if (t.includes('route')) route = comp.long_name;
            else if (t.includes('locality') || t.includes('postal_town')) parsed.city = comp.long_name;
            else if (t.includes('administrative_area_level_1')) parsed.state = comp.short_name;
            else if (t.includes('country')) parsed.country = comp.long_name;
            else if (t.includes('postal_code')) parsed.postal_code = comp.long_name;
          }
          parsed.street = streetNum ? `${streetNum} ${route}` : route;
        }
        onSelect(parsed);
      });
    } catch {
      // Fallback — plain text input still works
    }
  }, [mapsLoaded, onSelect]);

  return (
    <input
      ref={inputRef}
      type="text"
      required
      placeholder="Business address * (select from dropdown)"
      onChange={() => onManualEdit()}
      className={INPUT}
    />
  );
}

/* ─── Page ─────────────────────────────────────────────────────────────── */

export default function JoinPage() {
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    phone: '',
    category: '',
    location: '',
    street: '',
    city: '',
    state: '',
    country: '',
    postal_code: '',
    staff_count: '1',
    currency: 'EUR',
  });
  const [services, setServices] = useState<ServiceRow[]>([{ ...EMPTY_SERVICE }]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [addressVerified, setAddressVerified] = useState(false);

  const handleLocationSelect = useCallback((addr: ParsedAddress) => {
    setForm((f) => ({
      ...f,
      location: addr.formatted,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      country: addr.country,
      postal_code: addr.postal_code,
    }));
    setAddressVerified(true);
  }, []);

  const updateService = (i: number, field: keyof ServiceRow, value: string) => {
    setServices((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: value } : s));
  };

  const addService = () => {
    if (services.length < 3) setServices((prev) => [...prev, { ...EMPTY_SERVICE }]);
  };

  const removeService = (i: number) => {
    if (services.length > 1) setServices((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validate all required fields
    if (!form.business_name || !form.owner_name || !form.email || !form.phone) {
      setError('Please fill in all required fields.');
      return;
    }
    if (!form.category) {
      setError('Please select a business category.');
      return;
    }
    if (!addressVerified || !form.location) {
      setError('Please select an address from the dropdown suggestions.');
      return;
    }
    if (!services[0]?.name?.trim()) {
      setError('Please add at least one service.');
      return;
    }

    setSubmitting(true);

    // Build services description from structured rows
    const currSymbol = CURRENCIES.find((c) => c.code === form.currency)?.symbol ?? '€';
    const servicesDescription = services
      .filter((s) => s.name.trim())
      .map((s) => `${s.name}${s.duration ? ` (${s.duration} min)` : ''}${s.price ? ` - ${currSymbol}${s.price}` : ''}`)
      .join(', ');

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          staff_count: parseInt(form.staff_count) || 1,
          services_description: servicesDescription || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Something went wrong.');
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
    } catch {
      setError('Network error. Please try again.');
    }
    setSubmitting(false);
  };

  if (submitted) {
    return (
      <section className="flex min-h-[calc(100vh-65px)] items-center justify-center bg-gradient-to-b from-gray-50 to-white px-6">
        <div className="mx-auto max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">You&apos;re on the list!</h1>
          <p className="mt-3 text-gray-500">
            Thank you, {form.owner_name}. We&apos;ll reach out shortly to get <strong>{form.business_name}</strong> set up on Balkina AI.
          </p>
          <p className="mt-2 text-sm text-gray-400">Check your email at {form.email} for next steps.</p>
          <Link href="/" className="mt-8 inline-block rounded-full bg-brand-600 px-8 py-3 text-sm font-semibold text-white hover:bg-brand-700 transition-colors">
            Back to Home
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="bg-gradient-to-b from-gray-50 to-white py-12 md:py-20">
      <div className="mx-auto max-w-2xl px-6">
        {/* Header */}
        <div className="text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-700">
            Limited Early Access
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Booked by Balkina <span className="relative top-[-2px] rounded-full bg-brand-100 px-2 py-0.5 text-[10px] font-semibold text-brand-700">BETA</span>
          </h1>
          <p className="mt-2 text-base text-gray-500 md:text-lg">
            AI-powered appointment assistant for spas, clinics, studios, and beyond.
          </p>
          <p className="mt-2 text-sm text-gray-400">
            Tell us about your service to join the early access, and we&apos;ll handle the setup.
          </p>
        </div>

        {/* Form Card */}
        <form onSubmit={handleSubmit} className="mt-10 space-y-4 rounded-2xl border border-gray-100 bg-white p-6 shadow-lg shadow-gray-100/50 md:p-8">
          <div className="grid gap-4 sm:grid-cols-2">
            <input type="text" required value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} placeholder="Business name *" className={INPUT} />
            <input type="text" required value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} placeholder="Your name *" className={INPUT} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="Email *" className={INPUT} />
            <input type="tel" required value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone *" className={INPUT} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <select required value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${INPUT} ${!form.category ? 'text-gray-400' : ''}`}>
              <option value="" disabled>Category *</option>
              {CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
            <select value={form.staff_count} onChange={(e) => setForm({ ...form, staff_count: e.target.value })} className={INPUT}>
              <option value="1">Just me</option>
              <option value="2">2-3 staff</option>
              <option value="5">4-5 staff</option>
              <option value="10">6-10 staff</option>
              <option value="15">11-15 staff</option>
              <option value="20">15+ staff</option>
            </select>
          </div>

          <LocationInput onSelect={handleLocationSelect} onManualEdit={() => setAddressVerified(false)} />

          {/* Currency + Services */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-gray-500">Services you offer</p>
              <select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="rounded-lg border border-gray-200 px-2 py-1 text-xs text-gray-600 outline-none focus:border-brand-400">
                {CURRENCIES.map((c) => (
                  <option key={c.code} value={c.code}>{c.symbol} {c.code}</option>
                ))}
              </select>
            </div>
            {services.map((svc, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" required={i === 0} value={svc.name} onChange={(e) => updateService(i, 'name', e.target.value)} placeholder={i === 0 ? 'Service name *' : 'Service name'} className={`${INPUT} flex-[3]`} />
                <select value={svc.duration} onChange={(e) => updateService(i, 'duration', e.target.value)} className={`${INPUT} flex-[1.2] ${!svc.duration ? 'text-gray-400' : ''}`}>
                  <option value="" disabled>Duration</option>
                  <option value="15">15 min</option>
                  <option value="30">30 min</option>
                  <option value="45">45 min</option>
                  <option value="60">1 hour</option>
                  <option value="75">1h 15 min</option>
                  <option value="90">1h 30 min</option>
                  <option value="105">1h 45 min</option>
                  <option value="120">2 hours</option>
                </select>
                <input type="text" value={svc.price} onChange={(e) => updateService(i, 'price', e.target.value)} placeholder={`${CURRENCIES.find((c) => c.code === form.currency)?.symbol ?? '€'} Price`} className={`${INPUT} flex-1 text-center`} />
                {services.length > 1 && (
                  <button type="button" onClick={() => removeService(i)} className="shrink-0 rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition-colors">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}
              </div>
            ))}
            {services.length < 3 && (
              <button type="button" onClick={addService} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50 transition-colors">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                Add service
              </button>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Submitting...' : 'Join the Beta'}
          </button>

          <p className="text-center text-xs text-gray-400">
            Free during beta. No credit card required. By joining, you agree to our{' '}
            <Link href="/terms" className="text-brand-600 hover:text-brand-700">Terms</Link> and{' '}
            <Link href="/privacy" className="text-brand-600 hover:text-brand-700">Privacy Policy</Link>.
          </p>
        </form>
      </div>
    </section>
  );
}
