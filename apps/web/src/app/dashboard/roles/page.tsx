'use client';

import { useEffect, useState, useCallback } from 'react';

const MODULES = [
  'appointments',
  'locations',
  'staff',
  'services',
  'packages',
  'coupons',
  'loyalty',
  'inventory',
  'settings',
  'reports',
] as const;

type ModuleName = (typeof MODULES)[number];

interface Permission {
  module: ModuleName;
  can_view: boolean;
  can_add: boolean;
  can_edit: boolean;
  can_delete: boolean;
}

interface StaffAssignment {
  staff_id: string;
  staff?: { name: string } | null;
}

interface Role {
  id: string;
  name: string;
  notes: string | null;
  created_at: string;
  staff_role_assignments?: StaffAssignment[];
  role_permissions?: Permission[];
}

interface StaffOption {
  id: string;
  name: string;
}

function buildDefaultPermissions(): Permission[] {
  return MODULES.map((m) => ({
    module: m,
    can_view: false,
    can_add: false,
    can_edit: false,
    can_delete: false,
  }));
}

export default function RolesPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: '', notes: '' });
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>(buildDefaultPermissions());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchRoles = useCallback(async () => {
    const res = await fetch('/api/roles');
    const json = await res.json();
    setRoles(json.data ?? []);
    setLoading(false);
  }, []);

  const fetchStaff = useCallback(async () => {
    const res = await fetch('/api/staff');
    const json = await res.json();
    setStaffList((json.data ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
  }, []);

  useEffect(() => {
    fetchRoles();
    fetchStaff();
  }, [fetchRoles, fetchStaff]);

  function openNew() {
    setEditing(null);
    setForm({ name: '', notes: '' });
    setSelectedStaff([]);
    setPermissions(buildDefaultPermissions());
    setShowForm(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setForm({ name: role.name, notes: role.notes ?? '' });
    setSelectedStaff((role.staff_role_assignments ?? []).map((a) => a.staff_id));

    // Merge existing permissions with default
    const existing = role.role_permissions ?? [];
    const merged = MODULES.map((m) => {
      const found = existing.find((p) => p.module === m);
      if (found) return { module: m, can_view: found.can_view, can_add: found.can_add, can_edit: found.can_edit, can_delete: found.can_delete };
      return { module: m, can_view: false, can_add: false, can_edit: false, can_delete: false };
    });
    setPermissions(merged);
    setShowForm(true);
  }

  function toggleStaff(staffId: string) {
    setSelectedStaff((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  }

  function updatePermission(module: ModuleName, field: keyof Omit<Permission, 'module'>, value: boolean) {
    setPermissions((prev) =>
      prev.map((p) => (p.module === module ? { ...p, [field]: value } : p))
    );
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this role?')) return;
    await fetch(`/api/roles?id=${id}`, { method: 'DELETE' });
    fetchRoles();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);

    const body = {
      id: editing?.id,
      name: form.name,
      notes: form.notes || null,
      staff_ids: selectedStaff,
      permissions: permissions.map((p) => ({
        module: p.module,
        can_view: p.can_view,
        can_add: p.can_add,
        can_edit: p.can_edit,
        can_delete: p.can_delete,
      })),
    };

    const res = await fetch('/api/roles', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error?.message ?? 'Failed to save'); setSaving(false); return; }
    setShowForm(false);
    setEditing(null);
    setSaving(false);
    fetchRoles();
  }

  if (showForm) {
    return (
      <div className="p-6 lg:p-8">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">{editing ? 'Edit Role' : 'New Role'}</h1>
          <button onClick={() => setShowForm(false)} className="text-sm text-gray-500 hover:text-gray-700">Cancel</button>
        </div>
        <form onSubmit={handleSubmit} className="max-w-4xl space-y-6">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Role Name *</label>
            <input
              required
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Staff Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Assigned Staff</label>
            {staffList.length === 0 ? (
              <p className="text-sm text-gray-500">No staff members available.</p>
            ) : (
              <div className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-gray-200 p-3">
                {staffList.map((s) => (
                  <label key={s.id} className="flex items-center gap-2 rounded px-2 py-1 hover:bg-gray-50">
                    <input
                      type="checkbox"
                      checked={selectedStaff.includes(s.id)}
                      onChange={() => toggleStaff(s.id)}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                    <span className="text-sm text-gray-700">{s.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Permissions Matrix */}
          <div>
            <label className="mb-2 block text-sm font-medium text-gray-700">Permissions</label>
            <div className="overflow-x-auto rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Module</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">View</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Add</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Edit</th>
                    <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {permissions.map((perm) => (
                    <tr key={perm.module} className="hover:bg-gray-50">
                      <td className="whitespace-nowrap px-4 py-2 text-sm font-medium capitalize text-gray-700">
                        {perm.module}
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm.can_view}
                          onChange={(e) => updatePermission(perm.module, 'can_view', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm.can_add}
                          onChange={(e) => updatePermission(perm.module, 'can_add', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm.can_edit}
                          onChange={(e) => updatePermission(perm.module, 'can_edit', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600"
                        />
                      </td>
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={perm.can_delete}
                          onChange={(e) => updatePermission(perm.module, 'can_delete', e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {saving ? 'Saving...' : editing ? 'Update Role' : 'Create Role'}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Roles &amp; Permissions</h1>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {roles.length}
          </span>
        </div>
        <button onClick={openNew} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + New Role
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : roles.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No roles yet.</p>
            <button onClick={openNew} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
              Create your first role
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Role Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff Count</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Notes</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{role.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {role.staff_role_assignments?.length ?? 0}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600">
                      {role.notes ?? '---'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <button onClick={() => openEdit(role)} className="mr-3 text-brand-600 hover:text-brand-800">Edit</button>
                      <button onClick={() => handleDelete(role.id)} className="text-red-600 hover:text-red-800">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
