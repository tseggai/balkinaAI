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
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
    closePanel();
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

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === categories.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(categories.map((c) => c.id));
    }
  }

  const parentOptions = categories.filter((c) => c.id !== editing?.id && !c.parent_id);

  const addInputClass = 'w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const addTextareaClass = 'w-full rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const editInputClass = 'w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';
  const editTextareaClass = 'w-full rounded-[.3rem] border border-transparent bg-transparent px-0 py-1.5 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';

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
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === categories.length && categories.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Color</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Parent</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Services</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {categories.map((cat) => {
                  const parent = categories.find((c) => c.id === cat.parent_id);
                  return (
                    <tr
                      key={cat.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => openEdit(cat)}
                    >
                      <td
                        className="whitespace-nowrap px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(cat.id)}
                          onChange={() => toggleSelect(cat.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600 focus:ring-brand-500"
                        />
                      </td>
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
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]">
            <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Category' : 'New Category'}
              </h2>
              <button onClick={closePanel} className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-8 py-3">
                {/* --- ADD MODE: placeholders instead of labels --- */}
                {!editing && (
                  <>
                    <div>
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Category Name *"
                        className={addInputClass}
                      />
                    </div>

                    <div>
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
                      <select
                        value={form.parent_id}
                        onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                        className={addInputClass}
                      >
                        <option value="">Parent Category (none)</option>
                        {parentOptions.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <textarea
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Description"
                        className={addTextareaClass}
                      />
                    </div>
                  </>
                )}

                {/* --- EDIT MODE: horizontal label-left, hover-to-edit --- */}
                {editing && (
                  <>
                    <div className="space-y-0.5">
                      <label className="block text-xs text-gray-400">Name *</label>
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Category Name"
                        className={editInputClass}
                      />
                    </div>

                    <div className="flex items-center gap-4">
                      <label className="w-32 shrink-0 text-xs text-gray-400">Color</label>
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

                    <div className="space-y-0.5">
                      <label className="block text-xs text-gray-400">Parent</label>
                      <select
                        value={form.parent_id}
                        onChange={(e) => setForm({ ...form, parent_id: e.target.value })}
                        className={editInputClass}
                      >
                        <option value="">None (top-level)</option>
                        {parentOptions.map((p) => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-0.5">
                      <label className="block text-xs text-gray-400">Description</label>
                      <textarea
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Description"
                        className={editTextareaClass}
                      />
                    </div>
                  </>
                )}

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

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
                <button type="button" onClick={closePanel} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update Category' : 'Create Category'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
