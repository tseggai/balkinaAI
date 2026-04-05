'use client';

import { useState } from 'react';
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

export default function JoinPage() {
  const [form, setForm] = useState({
    business_name: '',
    owner_name: '',
    email: '',
    phone: '',
    category: '',
    location: '',
    staff_count: '1',
    services_description: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          staff_count: parseInt(form.staff_count) || 1,
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
            Join the Balkina AI Beta
          </h1>
          <p className="mt-3 text-base text-gray-500 md:text-lg">
            Tell us about your business and we&apos;ll set you up — free during beta. Limited spots available.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-10 space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Business Name *</label>
              <input
                type="text"
                required
                value={form.business_name}
                onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                placeholder="e.g., Sunrise Yoga Studio"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Your Name *</label>
              <input
                type="text"
                required
                value={form.owner_name}
                onChange={(e) => setForm({ ...form, owner_name: e.target.value })}
                placeholder="e.g., Sarah Johnson"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Email *</label>
              <input
                type="email"
                required
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="you@business.com"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Phone</label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 123-4567"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
              />
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
              >
                <option value="">Select a category</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-gray-700">Team Size</label>
              <select
                value={form.staff_count}
                onChange={(e) => setForm({ ...form, staff_count: e.target.value })}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
              >
                <option value="1">Just me</option>
                <option value="2">2-3 staff</option>
                <option value="5">4-5 staff</option>
                <option value="10">6-10 staff</option>
                <option value="15">11-15 staff</option>
                <option value="20">15+ staff</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">Location</label>
            <input
              type="text"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              placeholder="City, State or full address"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-gray-700">What services do you offer?</label>
            <textarea
              value={form.services_description}
              onChange={(e) => setForm({ ...form, services_description: e.target.value })}
              rows={3}
              placeholder="e.g., Haircuts ($25, 30 min), Hair Color ($60, 90 min), Beard Trim ($15, 15 min)"
              className="w-full resize-none rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-100 transition-colors"
            />
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
