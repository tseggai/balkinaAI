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

const INPUT = 'w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors';

interface ServiceRow {
  name: string;
  duration: string;
  price: string;
}

const EMPTY_SERVICE: ServiceRow = { name: '', duration: '', price: '' };

/* ─── Google Places Autocomplete ───────────────────────────────────────── */

function LocationInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const win = window as { google?: { maps?: unknown } };
    if (win.google?.maps) {
      setLoaded(true);
      return;
    }
    const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!key) return;
    // Check if script is already being loaded
    if (document.querySelector('script[src*="maps.googleapis.com"]')) {
      const check = setInterval(() => {
        if ((window as { google?: { maps?: unknown } }).google?.maps) {
          setLoaded(true);
          clearInterval(check);
        }
      }, 100);
      return () => clearInterval(check);
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places&loading=async`;
    script.async = true;
    script.defer = true;
    script.onload = () => setLoaded(true);
    document.head.appendChild(script);
  }, []);

  useEffect(() => {
    if (!loaded || !inputRef.current || autocompleteRef.current) return;
    try {
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
      });
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current?.getPlace();
        if (place?.formatted_address) {
          onChange(place.formatted_address);
        }
      });
    } catch {
      // Google Maps not available — graceful fallback to plain text
    }
  }, [loaded, onChange]);

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Business address"
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
    staff_count: '1',
  });
  const [services, setServices] = useState<ServiceRow[]>([{ ...EMPTY_SERVICE }]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleLocationChange = useCallback((v: string) => setForm((f) => ({ ...f, location: v })), []);

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
    setSubmitting(true);

    // Build services description from structured rows
    const servicesDescription = services
      .filter((s) => s.name.trim())
      .map((s) => `${s.name}${s.duration ? ` (${s.duration} min)` : ''}${s.price ? ` - $${s.price}` : ''}`)
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
            Early Access
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">
            Join the Balkina AI Beta — FREE
          </h1>
          <p className="mt-3 text-base text-gray-500 md:text-lg">
            Tell us about your service, and we&apos;ll handle the setup. Limited spots available.
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
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Phone" className={INPUT} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className={`${INPUT} ${!form.category ? 'text-gray-400' : ''}`}>
              <option value="" disabled>Category</option>
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

          <LocationInput value={form.location} onChange={handleLocationChange} />

          {/* Services — structured rows */}
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-500">Services you offer</p>
            {services.map((svc, i) => (
              <div key={i} className="flex items-center gap-2">
                <input type="text" value={svc.name} onChange={(e) => updateService(i, 'name', e.target.value)} placeholder="Service name" className={`${INPUT} flex-[3]`} />
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
                <input type="text" value={svc.price} onChange={(e) => updateService(i, 'price', e.target.value)} placeholder="Price" className={`${INPUT} flex-1 text-center`} />
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
