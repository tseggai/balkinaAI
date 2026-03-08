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

// ---------------------------------------------------------------------------
// SVG Icons (inline, matching Services page)
// ---------------------------------------------------------------------------

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
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
  const [search, setSearch] = useState('');
  const [bulkActing, setBulkActing] = useState(false);

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
    setSelectedIds((prev) => prev.filter((sid) => sid !== id));
    closePanel();
    fetchCategories();
  }

  async function handleBulkDelete() {
    if (selectedIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} category(ies)?`)) return;
    setBulkActing(true);
    await Promise.all(
      selectedIds.map((id) =>
        fetch(`/api/tenant-categories?id=${id}`, { method: 'DELETE' })
      )
    );
    setSelectedIds([]);
    setBulkActing(false);
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
    if (selectedIds.length === filteredCategories.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredCategories.map((c) => c.id));
    }
  }

  const filteredCategories = search.trim()
    ? categories.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))
    : categories;

  const parentOptions = categories.filter((c) => c.id !== editing?.id && !c.parent_id);

  const addInputClass = 'w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const addTextareaClass = 'w-full rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const editInputClass = 'w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';
  const editTextareaClass = 'w-full rounded-[.3rem] border border-transparent bg-transparent px-0 py-1.5 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <span className="inline-flex items-center justify-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-semibold text-gray-600">
            {categories.length}
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={openNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
          >
            <PlusIcon />
            Add Category
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search categories by name..."
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
            onClick={() => setSelectedIds([])}
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
        ) : filteredCategories.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-12 text-center">
            <p className="text-sm text-gray-500">
              {search.trim() ? 'No categories match your search.' : 'No categories yet.'}
            </p>
            {!search.trim() && (
              <button onClick={openNew} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
                Create your first category
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
                        checked={filteredCategories.length > 0 && selectedIds.length === filteredCategories.length}
                        onChange={toggleSelectAll}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Color</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Parent</th>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Services</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredCategories.map((cat) => {
                    const parent = categories.find((c) => c.id === cat.parent_id);
                    return (
                      <tr
                        key={cat.id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={(e) => {
                          if ((e.target as HTMLElement).closest('[data-checkbox-cell]')) return;
                          openEdit(cat);
                        }}
                      >
                        <td
                          data-checkbox-cell
                          className="w-10 whitespace-nowrap px-4 py-3"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(cat.id)}
                            onChange={() => toggleSelect(cat.id)}
                            className="h-4 w-4 rounded border-gray-300 text-brand-600"
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
          </div>
        )}
      </div>

      {/* Slide-in Panel */}
      {showPanel && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={closePanel} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]">
            <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Category' : 'Add Category'}
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
