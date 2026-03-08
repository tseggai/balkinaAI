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

type PermField = 'can_view' | 'can_add' | 'can_edit' | 'can_delete';
const PERM_FIELDS: PermField[] = ['can_view', 'can_add', 'can_edit', 'can_delete'];
const PERM_LABELS: Record<PermField, string> = {
  can_view: 'View',
  can_add: 'Add',
  can_edit: 'Edit',
  can_delete: 'Delete',
};

const AVATAR_COLORS = [
  'bg-blue-500',
  'bg-green-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-teal-500',
  'bg-red-500',
  'bg-indigo-500',
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] as string;
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
  const [showPanel, setShowPanel] = useState(false);
  const [editing, setEditing] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: '', notes: '' });
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>(buildDefaultPermissions());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showStaffDropdown, setShowStaffDropdown] = useState(false);

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
    setError('');
    setShowPanel(true);
  }

  function openEdit(role: Role) {
    setEditing(role);
    setForm({ name: role.name, notes: role.notes ?? '' });
    setSelectedStaff((role.staff_role_assignments ?? []).map((a) => a.staff_id));

    const existing = role.role_permissions ?? [];
    const merged = MODULES.map((m) => {
      const found = existing.find((p) => p.module === m);
      if (found) return { module: m, can_view: found.can_view, can_add: found.can_add, can_edit: found.can_edit, can_delete: found.can_delete };
      return { module: m, can_view: false, can_add: false, can_edit: false, can_delete: false };
    });
    setPermissions(merged);
    setError('');
    setShowPanel(true);
  }

  function closePanel() {
    setShowPanel(false);
    setEditing(null);
  }

  function toggleStaff(staffId: string) {
    setSelectedStaff((prev) =>
      prev.includes(staffId) ? prev.filter((id) => id !== staffId) : [...prev, staffId]
    );
  }

  function updatePermission(module: ModuleName, field: PermField, value: boolean) {
    setPermissions((prev) =>
      prev.map((p) => (p.module === module ? { ...p, [field]: value } : p))
    );
  }

  function toggleAllForModule(module: ModuleName) {
    setPermissions((prev) => {
      const current = prev.find((p) => p.module === module);
      if (!current) return prev;
      const allChecked = PERM_FIELDS.every((f) => current[f]);
      return prev.map((p) =>
        p.module === module
          ? { ...p, can_view: !allChecked, can_add: !allChecked, can_edit: !allChecked, can_delete: !allChecked }
          : p
      );
    });
  }

  function toggleColumnAll(field: PermField) {
    const allChecked = permissions.every((p) => p[field]);
    setPermissions((prev) =>
      prev.map((p) => ({ ...p, [field]: !allChecked }))
    );
  }

  function toggleSelectAll() {
    const allChecked = permissions.every((p) => PERM_FIELDS.every((f) => p[f]));
    setPermissions((prev) =>
      prev.map((p) => ({
        ...p,
        can_view: !allChecked,
        can_add: !allChecked,
        can_edit: !allChecked,
        can_delete: !allChecked,
      }))
    );
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this role?')) return;
    await fetch(`/api/roles?id=${id}`, { method: 'DELETE' });
    closePanel();
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
    setSaving(false);
    // Refresh the list without closing the panel
    const refreshRes = await fetch('/api/roles');
    const refreshJson = await refreshRes.json();
    const refreshedRoles = (refreshJson.data ?? []) as Role[];
    setRoles(refreshedRoles);

    // If we just created a new role, switch to edit mode
    if (!editing && json.data?.id) {
      const newRole = refreshedRoles.find((r) => r.id === json.data.id);
      if (newRole) {
        openEdit(newRole);
      }
    } else if (editing) {
      const updatedRole = refreshedRoles.find((r) => r.id === editing.id);
      if (updatedRole) {
        setEditing(updatedRole);
      }
    }
  }

  function toggleRowSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  }

  function toggleSelectAllRows() {
    if (selectedIds.length === roles.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(roles.map((r) => r.id));
    }
  }

  const addInputClass =
    'w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const addTextareaClass =
    'w-full rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const editInputClass =
    'w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';
  const editTextareaClass =
    'w-full rounded-[.3rem] border border-transparent bg-transparent px-0 py-1.5 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';

  // Build a lookup from staff_id to staff name for the avatar display
  const staffNameMap = new Map<string, string>();
  staffList.forEach((s) => staffNameMap.set(s.id, s.name));

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
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedIds.length === roles.length && roles.length > 0}
                      onChange={toggleSelectAllRows}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Role Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {roles.map((role) => {
                  const assignments = role.staff_role_assignments ?? [];
                  return (
                    <tr
                      key={role.id}
                      className="cursor-pointer hover:bg-gray-50"
                      onClick={() => openEdit(role)}
                    >
                      <td
                        className="whitespace-nowrap px-4 py-3"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(role.id)}
                          onChange={() => toggleRowSelect(role.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{role.name}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <div className="flex items-center -space-x-2">
                          {assignments.slice(0, 5).map((a) => {
                            const name = a.staff?.name ?? staffNameMap.get(a.staff_id) ?? '?';
                            return (
                              <div
                                key={a.staff_id}
                                title={name}
                                className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-semibold text-white ${getAvatarColor(a.staff_id)}`}
                              >
                                {getInitials(name)}
                              </div>
                            );
                          })}
                          {assignments.length > 5 && (
                            <div className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-gray-300 text-[10px] font-semibold text-gray-700">
                              +{assignments.length - 5}
                            </div>
                          )}
                          {assignments.length === 0 && (
                            <span className="text-xs text-gray-400">None</span>
                          )}
                        </div>
                      </td>
                      <td className="max-w-xs truncate px-4 py-3 text-sm text-gray-600">
                        {role.notes ?? '---'}
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
          <div className="fixed inset-0 z-40 bg-black/30 transition-opacity" onClick={closePanel} />
          <div
            className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]`}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Role' : 'New Role'}
              </h2>
              <button
                onClick={closePanel}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 space-y-5 overflow-y-auto px-8 py-3">
                {/* --- ADD MODE: placeholders instead of labels --- */}
                {!editing && (
                  <>
                    {/* Role Name */}
                    <div>
                      <input
                        required
                        placeholder="Role Name *"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className={addInputClass}
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <textarea
                        rows={2}
                        placeholder="Notes"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className={addTextareaClass}
                      />
                    </div>

                    {/* Staff Selection */}
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Assigned Staff <span className="font-normal text-gray-400">({selectedStaff.length} selected)</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-3 min-h-[42px]">
                        {selectedStaff.map((sid) => {
                          const st = staffList.find((s) => s.id === sid);
                          if (!st) return null;
                          return (
                            <span key={sid} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                              {st.name}
                              <button type="button" onClick={() => toggleStaff(sid)} className="ml-0.5 text-brand-400 hover:text-brand-600">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </span>
                          );
                        })}
                        {staffList.length > 0 && (
                          <div className="relative">
                            <button type="button" onClick={() => setShowStaffDropdown(!showStaffDropdown)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                              Add
                            </button>
                            {showStaffDropdown && (
                              <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                {staffList.filter((s) => !selectedStaff.includes(s.id)).map((s) => (
                                  <button key={s.id} type="button" onClick={() => { toggleStaff(s.id); setShowStaffDropdown(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                                    {s.name}
                                  </button>
                                ))}
                                {staffList.filter((s) => !selectedStaff.includes(s.id)).length === 0 && (
                                  <div className="px-3 py-2 text-sm text-gray-400">All staff selected</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {staffList.length === 0 && (
                          <span className="text-sm text-gray-400">No staff members available.</span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* --- EDIT MODE: horizontal label-left, value-right, hover-to-edit --- */}
                {editing && (
                  <>
                    {/* Role Name */}
                    <div>
                      <label className="text-xs text-gray-400">Role Name</label>
                      <input
                        required
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className={editInputClass}
                      />
                    </div>

                    {/* Notes */}
                    <div>
                      <label className="text-xs text-gray-400">Notes</label>
                      <textarea
                        rows={2}
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                        className={editTextareaClass}
                      />
                    </div>

                    {/* Staff Selection */}
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">
                        Assigned Staff <span className="font-normal text-gray-400">({selectedStaff.length} selected)</span>
                      </label>
                      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-gray-200 p-3 min-h-[42px]">
                        {selectedStaff.map((sid) => {
                          const st = staffList.find((s) => s.id === sid);
                          if (!st) return null;
                          return (
                            <span key={sid} className="inline-flex items-center gap-1 rounded-full bg-brand-50 px-3 py-1 text-sm font-medium text-brand-700">
                              {st.name}
                              <button type="button" onClick={() => toggleStaff(sid)} className="ml-0.5 text-brand-400 hover:text-brand-600">
                                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                              </button>
                            </span>
                          );
                        })}
                        {staffList.length > 0 && (
                          <div className="relative">
                            <button type="button" onClick={() => setShowStaffDropdown(!showStaffDropdown)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-gray-300 px-3 py-1 text-sm text-gray-500 hover:border-brand-400 hover:text-brand-600">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                              Add
                            </button>
                            {showStaffDropdown && (
                              <div className="absolute left-0 top-full z-10 mt-1 max-h-48 w-56 overflow-y-auto rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                                {staffList.filter((s) => !selectedStaff.includes(s.id)).map((s) => (
                                  <button key={s.id} type="button" onClick={() => { toggleStaff(s.id); setShowStaffDropdown(false); }} className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50">
                                    {s.name}
                                  </button>
                                ))}
                                {staffList.filter((s) => !selectedStaff.includes(s.id)).length === 0 && (
                                  <div className="px-3 py-2 text-sm text-gray-400">All staff selected</div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {staffList.length === 0 && (
                          <span className="text-sm text-gray-400">No staff members available.</span>
                        )}
                      </div>
                    </div>
                  </>
                )}

                {/* Permissions Matrix */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Permissions</span>
                    <button
                      type="button"
                      onClick={toggleSelectAll}
                      className="text-xs font-medium text-brand-600 hover:text-brand-700"
                    >
                      {permissions.every((p) => PERM_FIELDS.every((f) => p[f])) ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="overflow-x-auto rounded-lg border border-gray-200">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Module</th>
                          <th className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">All</th>
                          {PERM_FIELDS.map((field) => (
                            <th key={field} className="px-4 py-3 text-center text-xs font-medium uppercase text-gray-500">
                              <button
                                type="button"
                                onClick={() => toggleColumnAll(field)}
                                className="hover:text-brand-600"
                                title={`Toggle all ${PERM_LABELS[field]}`}
                              >
                                {PERM_LABELS[field]}
                              </button>
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {permissions.map((perm) => {
                          const allRowChecked = PERM_FIELDS.every((f) => perm[f]);
                          return (
                            <tr key={perm.module} className="hover:bg-gray-50">
                              <td className="whitespace-nowrap px-4 py-2 text-sm font-medium capitalize text-gray-700">
                                {perm.module}
                              </td>
                              <td className="px-4 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={allRowChecked}
                                  onChange={() => toggleAllForModule(perm.module)}
                                  className="h-4 w-4 rounded border-gray-300 text-brand-600"
                                />
                              </td>
                              {PERM_FIELDS.map((field) => (
                                <td key={field} className="px-4 py-2 text-center">
                                  <input
                                    type="checkbox"
                                    checked={perm[field]}
                                    onChange={(e) => updatePermission(perm.module, field, e.target.checked)}
                                    className="h-4 w-4 rounded border-gray-300 text-brand-600"
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>

              {/* Footer */}
              <div className="flex gap-3 border-t border-gray-200 px-8 py-4">
                {editing && (
                  <button
                    type="button"
                    onClick={() => handleDelete(editing.id)}
                    className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  onClick={closePanel}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : editing ? 'Update Role' : 'Create Role'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
