'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';

interface Category {
  id: string;
  name: string;
  slug: string;
  parent_id: string | null;
}

export default function RegisterPage() {
  const router = useRouter();
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
      const supabase = createClient();
      const { data } = await supabase
        .from('categories')
        .select('id, name, slug, parent_id')
        .is('parent_id', null)
        .order('display_order');
      if (data) setCategories(data);
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
      // 1. Create auth user
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
        setError('Registration failed. Please try again.');
        setLoading(false);
        return;
      }

      // 2. Complete registration on server (create tenant + Stripe customer)
      const res = await fetch('/api/auth/register', {
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

      const result = await res.json();

      if (!res.ok) {
        setError(result.error?.message ?? 'Registration failed');
        setLoading(false);
        return;
      }

      // 3. Sign in immediately
      await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password,
      });

      // 4. Redirect to plan selection
      router.push('/onboarding/select-plan');
      router.refresh();
    } catch {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="auth-container">
      <div className="auth-card">
        <h1>Create your account</h1>
        <p>Get started with Balkina AI for your business.</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="businessName">Business name</label>
            <input
              id="businessName"
              type="text"
              value={formData.businessName}
              onChange={(e) => updateField('businessName', e.target.value)}
              placeholder="Acme Barbershop"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="ownerName">Owner full name</label>
            <input
              id="ownerName"
              type="text"
              value={formData.ownerName}
              onChange={(e) => updateField('ownerName', e.target.value)}
              placeholder="John Smith"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => updateField('email', e.target.value)}
              placeholder="you@business.com"
              required
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) => updateField('password', e.target.value)}
              placeholder="At least 8 characters"
              required
              minLength={8}
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label htmlFor="phone">Phone number</label>
            <input
              id="phone"
              type="tel"
              value={formData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              placeholder="+1 (555) 000-0000"
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="category">Primary business category</label>
            <select
              id="category"
              value={formData.categoryId}
              onChange={(e) => updateField('categoryId', e.target.value)}
              required
            >
              <option value="">Select a category</option>
              {categories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>
          </div>

          {error && <p className="error-message">{error}</p>}

          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? 'Creating account...' : 'Create account'}
          </button>
        </form>

        <div className="auth-links">
          <span>
            Already have an account? <Link href="/auth/login">Sign in</Link>
          </span>
        </div>
      </div>
    </div>
  );
}
