'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Category {
  id: string;
  name: string;
  slug: string;
}

export default function RegisterPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [formData, setFormData] = useState({
    businessName: '',
    ownerName: '',
    email: '',
    password: '',
    phone: '',
    categoryId: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function loadCategories() {
      const res = await fetch('/api/categories');
      const json = await res.json();
      if (json.data) setCategories(json.data);
    }
    loadCategories();
  }, []);

  function updateField(field: string, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Step 1: Create auth user
      const supabase = createClient();
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            owner_name: formData.ownerName,
            phone: formData.phone,
          },
        },
      });

      if (authError) {
        setError(authError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError('Registration failed — no user returned. Please try again.');
        setLoading(false);
        return;
      }

      // Step 2: Create tenant record + Stripe customer via API
      let res: Response;
      try {
        res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: authData.user.id,
            businessName: formData.businessName,
            ownerName: formData.ownerName,
            email: formData.email,
            phone: formData.phone,
            categoryId: formData.categoryId || null,
          }),
        });
      } catch (fetchErr) {
        const msg = fetchErr instanceof Error ? fetchErr.message : 'Network error';
        setError(`Failed to create account: ${msg}`);
        setLoading(false);
        return;
      }

      const result = await res.json();

      if (!res.ok) {
        setError(result.error?.message ?? `Registration failed (${res.status})`);
        setLoading(false);
        return;
      }

      // Step 3: Sign in the newly created user
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      if (signInError) {
        // Tenant was created successfully but auto-sign-in failed — redirect to login
        window.location.href = '/auth/login';
        return;
      }

      // Full page navigation so the browser sends the freshly-set auth
      // cookies with the request (avoids RSC fetch / cookie race).
      window.location.href = '/onboarding/select-plan';
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setError(`Registration error: ${msg}`);
      setLoading(false);
    }
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-8">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-gray-900">Create your account</h1>
        <p className="mt-1 text-sm text-gray-500">Get started with Balkina AI for your business.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="businessName" className="mb-1 block text-sm font-medium text-gray-700">Business name</label>
            <input id="businessName" type="text" value={formData.businessName}
              onChange={(e) => updateField('businessName', e.target.value)}
              placeholder="Acme Barbershop" required className={inputClass} />
          </div>

          <div>
            <label htmlFor="ownerName" className="mb-1 block text-sm font-medium text-gray-700">Owner full name</label>
            <input id="ownerName" type="text" value={formData.ownerName}
              onChange={(e) => updateField('ownerName', e.target.value)}
              placeholder="John Smith" required className={inputClass} />
          </div>

          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">Email</label>
            <input id="email" type="email" value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="you@business.com" required autoComplete="email" className={inputClass} />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">Password</label>
            <input id="password" type="password" value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="At least 8 characters" required minLength={8}
              autoComplete="new-password" className={inputClass} />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700">Phone number</label>
            <input id="phone" type="tel" value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+1 (555) 000-0000" required className={inputClass} />
          </div>

          <div>
            <label htmlFor="category" className="mb-1 block text-sm font-medium text-gray-700">Primary business category</label>
            <select id="category" value={formData.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
              required className={inputClass}>
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>{cat.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading}
            className="w-full rounded-lg bg-brand-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="mt-6 text-center text-sm text-gray-500">
          Already have an account? <Link href="/auth/login" className="text-brand-600 hover:text-brand-700">Sign in</Link>
        </div>
      </div>
    </div>
  );
}
