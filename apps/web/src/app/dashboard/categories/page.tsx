'use client';

import { useEffect, useState, useCallback } from 'react';

const PRESET_COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444'];

interface Category {
  id: string;
  name: string;
  color: string | null;
  parent_id: string | null;
  description: string | null;
  services_count: number;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPanel, setShowPanel] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [form, setForm] = useState({ name: '', color: '#6366f1', parent_id: '', description: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchCategories = useCallback(async () => {
    const res = await fetch('/api/tenant-categories');
    const json = await res.json();
    setCategories(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function openNew() {
    setEditing(null);
    setForm({ name: '', color: '#6366f1', parent_id: '', description: '' });
    setError('');
    setShowPanel(true);
  }

  function openEdit(cat: Category) {
    setEditing(cat);
    setForm({
      name: cat.name,
      color: cat.color || '#6366f1',
      parent_id: cat.parent_id ?? '',
      description: cat.description ?? '',
    });
    setError('');
    setShowPanel(true);
  }

  function closePanel() {
    setShowPanel(false);
    setEditing(null);
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category?')) return;
    await fetch(`/api/tenant-categories?id=${id}`, { method: 'DELETE' });
    fetchCategories();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const body = {
      id: editing?.id,
      name: form.name,
      color: form.color || null,
      parent_id: form.parent_id || null,
      description: form.description || null,
    };

    const res = await fetch('/api/tenant-categories', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error?.message ?? 'Failed to save'); setSaving(false); return; }
    closePanel();
    setSaving(false);
    fetchCategories();
  }

  const parentOptions = categories.filter((c) => c.id !== editing?.id && !c.parent_id);

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const labelClass = 'mb-1 block text-sm font-medium text-gray-700';

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {categories.length}
          </span>
        </div>
        <button onClick={openNew} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Add Category
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : categories.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No categories yet.</p>
            <button onClick={openNew} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
              Create your first category
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Color</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Parent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Services</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((cat) => {
                  const parent = categories.find((c) => c.id === cat.parent_id);
                  return (
                    <tr key={cat.id} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-3">
                        <div
                          className="h-4 w-4 rounded-full"
                          style={{ backgroundColor: cat.color || '#9ca3af' }}
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{cat.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {parent?.name ?? '\u2014'}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{cat.services_count}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                        <button onClick={() => openEdit(cat)} className="mr-3 text-brand-600 hover:text-brand-800">Edit</button>
                        <button onClick={() => handleDelete(cat.id)} className="text-red-600 hover:text-red-800">Delete</button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-in Panel */}
      {showPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[50%] sm:min-w-[480px]">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-xl font-bold text-gray-900">
                {editing ? 'Edit Category' : 'New Category'}
              </h2>
              <button onClick={closePanel} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
                <div>
                  <label className={labelClass}>Category Name *</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Haircuts, Massages, Nails..."
                    className={inputClass}
                  />
                </div>

                <div>
                  <label className={labelClass}>Color</label>
                  <div className="flex items-center gap-3">
                    {PRESET_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setForm({ ...form, color: c })}
                        className={`h-8 w-8 rounded-full border-2 transition-all ${
                          form.color === c ? 'border-gray-900 scale-110' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className={labelClass}>Parent Category</label>
                  <select
                    value={form.parent_id}
                    onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                    className={inputClass}
                  >
                    <option value="">None (top-level)</option>
                    {parentOptions.map((p) => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className={labelClass}>Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className={inputClass}
                  />
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              <div className="flex gap-3 border-t border-gray-200 px-6 py-4">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update Category' : 'Create Category'}
                </button>
                <button type="button" onClick={closePanel} className="rounded-lg border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
