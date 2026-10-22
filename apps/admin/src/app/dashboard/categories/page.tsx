'use client';

import { useEffect, useState, useCallback } from 'react';

interface Category {
  id: string;
  parent_id: string | null;
  name: string;
  slug: string;
  icon_url: string | null;
  display_order: number;
  created_at: string;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formName, setFormName] = useState('');
  const [formSlug, setFormSlug] = useState('');
  const [formParentId, setFormParentId] = useState('');
  const [formIconUrl, setFormIconUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  const fetchCategories = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/admin/categories');
    const json = await res.json();
    setCategories(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  function resetForm() {
    setFormName('');
    setFormSlug('');
    setFormParentId('');
    setFormIconUrl('');
    setEditingId(null);
    setShowForm(false);
    setError('');
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setFormName(cat.name);
    setFormSlug(cat.slug);
    setFormParentId(cat.parent_id ?? '');
    setFormIconUrl(cat.icon_url ?? '');
    setShowForm(true);
  }

  function autoSlug(name: string) {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  }

  async function handleSave() {
    if (!formName.trim()) { setError('Name is required'); return; }
    const slug = formSlug.trim() || autoSlug(formName);

    setSaving(true);
    setError('');

    // For new categories, set display_order to end of list
    const maxOrder = categories.length > 0
      ? Math.max(...categories.filter(c => !c.parent_id).map(c => c.display_order))
      : -1;

    const payload = {
      ...(editingId ? { id: editingId } : {}),
      name: formName.trim(),
      slug,
      parent_id: formParentId || null,
      icon_url: formIconUrl || null,
      display_order: editingId
        ? categories.find(c => c.id === editingId)?.display_order ?? 0
        : maxOrder + 1,
    };

    const res = await fetch('/api/admin/categories', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const json = await res.json();
    if (json.error) { setError(json.error); setSaving(false); return; }

    setSaving(false);
    resetForm();
    fetchCategories();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this category? Services using it will lose their category reference.')) return;
    await fetch(`/api/admin/categories?id=${id}`, { method: 'DELETE' });
    fetchCategories();
  }

  // Save reordered display_order values to the API
  async function saveOrder(reordered: Category[]) {
    const topLevelOrdered = reordered.filter(c => !c.parent_id);
    await Promise.all(
      topLevelOrdered.map((cat, idx) =>
        fetch('/api/admin/categories', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: cat.id, display_order: idx }),
        })
      )
    );
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  async function reorderTopLevel(fromIdx: number, toIdx: number) {
    const topLevel = categories.filter(c => !c.parent_id).sort((a, b) => a.display_order - b.display_order);
    if (toIdx < 0 || toIdx >= topLevel.length) return;
    const reordered = [...topLevel];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved!);
    const updated = reordered.map((c, i) => ({ ...c, display_order: i }));

    // Update local state immediately (optimistic)
    const children = categories.filter(c => c.parent_id);
    setCategories([...updated, ...children]);

    // Persist to backend
    await saveOrder(updated);
  }

  async function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return; }
    const from = dragIdx;
    setDragIdx(null);
    await reorderTopLevel(from, targetIdx);
  }

  /** Touch screens have no drag-and-drop; the up/down arrows call this. */
  async function handleMove(idx: number, delta: -1 | 1) {
    await reorderTopLevel(idx, idx + delta);
  }

  // Build tree structure for display
  const topLevel = categories.filter((c) => !c.parent_id).sort((a, b) => a.display_order - b.display_order);
  const childMap = new Map<string, Category[]>();
  for (const c of categories) {
    if (c.parent_id) {
      const existing = childMap.get(c.parent_id) ?? [];
      existing.push(c);
      childMap.set(c.parent_id, existing);
    }
  }

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Categories</h1>
          <p className="mt-1 text-sm text-gray-500">Global service taxonomy. <span className="hidden md:inline">Drag to reorder. </span><span className="md:hidden">Use the arrows to reorder. </span>Tenants assign their services to these categories.</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="shrink-0 rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add Category
        </button>
      </div>

      {/* Inline form */}
      {showForm && (
        <div className="mt-5 rounded-xl border border-gray-200 bg-white p-4 md:mt-6 md:p-6">
          <h2 className="text-lg font-semibold text-gray-900">{editingId ? 'Edit Category' : 'New Category'}</h2>
          <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Name</label>
              <input
                value={formName}
                onChange={(e) => { setFormName(e.target.value); if (!editingId) setFormSlug(autoSlug(e.target.value)); }}
                placeholder="e.g. Hair & Beauty"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Slug</label>
              <input
                value={formSlug}
                onChange={(e) => setFormSlug(e.target.value)}
                placeholder="hair-beauty"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Parent Category</label>
              <select
                value={formParentId}
                onChange={(e) => setFormParentId(e.target.value)}
                className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              >
                <option value="">None (Top Level)</option>
                {categories.filter((c) => c.id !== editingId && !c.parent_id).map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Icon URL (optional)</label>
              <input
                value={formIconUrl}
                onChange={(e) => setFormIconUrl(e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
              />
            </div>
          </div>
          {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
          <div className="mt-4 flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={resetForm}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories Tree — draggable */}
      {loading ? (
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <div className="mt-5 space-y-2 md:mt-6">
          {topLevel.length > 0 ? (
            topLevel.map((cat, idx) => {
              const children = childMap.get(cat.id) ?? [];
              return (
                <div
                  key={cat.id}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => handleDrop(idx)}
                  className={`rounded-xl border bg-white transition-opacity ${dragIdx === idx ? 'border-brand-400 opacity-50' : 'border-gray-200'}`}
                >
                  <div className="flex items-center justify-between gap-3 px-4 py-3.5 md:px-5 md:py-4">
                    <div className="flex min-w-0 items-center gap-3">
                      {/* Drag handle */}
                      <div className="hidden cursor-grab text-gray-300 hover:text-gray-500 active:cursor-grabbing md:block">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M4 16h16" />
                        </svg>
                      </div>
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50">
                        {cat.icon_url ? (
                          <img src={cat.icon_url} alt="" className="h-5 w-5" />
                        ) : (
                          <svg className="h-5 w-5 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6Z" />
                          </svg>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{cat.name}</p>
                        <p className="truncate text-xs text-gray-400">/{cat.slug}{children.length > 0 ? ` · ${children.length} sub` : ''}</p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-1 md:gap-2">
                      {/* Mobile has no drag-and-drop: move with arrows */}
                      <button onClick={() => void handleMove(idx, -1)} disabled={idx === 0} aria-label="Move up" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 md:hidden">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m4.5 15.75 7.5-7.5 7.5 7.5" /></svg>
                      </button>
                      <button onClick={() => void handleMove(idx, 1)} disabled={idx === topLevel.length - 1} aria-label="Move down" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 md:hidden">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" /></svg>
                      </button>
                      <button onClick={() => startEdit(cat)} className="rounded-lg px-2 py-1.5 text-sm font-medium text-brand-600 hover:bg-brand-50 hover:text-brand-700">Edit</button>
                      <button onClick={() => handleDelete(cat.id)} className="rounded-lg px-2 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 hover:text-red-700">Delete</button>
                    </div>
                  </div>
                  {children.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-2 md:px-5">
                      {children.map((child) => (
                        <div key={child.id} className="flex items-center justify-between gap-3 py-2 pl-3 md:pl-8">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className="text-gray-300">&mdash;</span>
                            <p className="truncate text-sm text-gray-700">{child.name}</p>
                            <p className="hidden text-xs text-gray-400 sm:block">/{child.slug}</p>
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button onClick={() => startEdit(child)} className="text-xs font-medium text-brand-600 hover:text-brand-700">Edit</button>
                            <button onClick={() => handleDelete(child.id)} className="text-xs font-medium text-red-600 hover:text-red-700">Delete</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
              <p className="text-sm text-gray-500">No categories yet. Add your first category to get started.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
