'use client';

import { useEffect, useState, useCallback } from 'react';
import { ImageUpload } from '@/components/image-upload';

interface PackageService {
  id?: string;
  service_id: string;
  quantity: number;
  services?: { name: string } | null;
}

interface Package {
  id: string;
  name: string;
  price: number;
  image_url: string | null;
  description: string | null;
  is_private: boolean;
  is_active: boolean;
  expiration_value: number | null;
  expiration_unit: string | null;
  created_at: string;
  package_services?: PackageService[];
}

interface ServiceOption {
  id: string;
  name: string;
}

export default function PackagesPage() {
  const [packages, setPackages] = useState<Package[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Package | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '',
    price: '',
    image_url: '',
    description: '',
    is_private: false,
    is_active: true,
    has_expiration: false,
    expiration_value: '',
    expiration_unit: 'days',
  });
  const [formServices, setFormServices] = useState<{ service_id: string; quantity: number }[]>([]);
  const [addServiceId, setAddServiceId] = useState('');
  const [addServiceQty, setAddServiceQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchPackages = useCallback(async () => {
    const res = await fetch('/api/packages');
    const json = await res.json();
    setPackages(json.data ?? []);
    setLoading(false);
  }, []);

  const fetchServices = useCallback(async () => {
    const res = await fetch('/api/services');
    const json = await res.json();
    setServices((json.data ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
  }, []);

  useEffect(() => {
    fetchPackages();
    fetchServices();
  }, [fetchPackages, fetchServices]);

  function openNew() {
    setEditing(null);
    setForm({
      name: '', price: '', image_url: '', description: '', is_private: false,
      is_active: true, has_expiration: false, expiration_value: '', expiration_unit: 'days',
    });
    setFormServices([]);
    setAddServiceId('');
    setAddServiceQty('1');
    setShowForm(true);
  }

  function openEdit(pkg: Package) {
    setEditing(pkg);
    setForm({
      name: pkg.name,
      price: String(pkg.price),
      image_url: pkg.image_url ?? '',
      description: pkg.description ?? '',
      is_private: pkg.is_private,
      is_active: pkg.is_active,
      has_expiration: pkg.expiration_value !== null && pkg.expiration_value > 0,
      expiration_value: pkg.expiration_value ? String(pkg.expiration_value) : '',
      expiration_unit: pkg.expiration_unit ?? 'days',
    });
    setFormServices(
      (pkg.package_services ?? []).map((ps) => ({
        service_id: ps.service_id,
        quantity: ps.quantity,
      }))
    );
    setAddServiceId('');
    setAddServiceQty('1');
    setShowForm(true);
  }

  function addServiceToList() {
    if (!addServiceId) return;
    if (formServices.some((s) => s.service_id === addServiceId)) return;
    setFormServices([...formServices, { service_id: addServiceId, quantity: Number(addServiceQty) || 1 }]);
    setAddServiceId('');
    setAddServiceQty('1');
  }

  function removeServiceFromList(serviceId: string) {
    setFormServices(formServices.filter((s) => s.service_id !== serviceId));
  }

  function getServiceName(serviceId: string): string {
    return services.find((s) => s.id === serviceId)?.name ?? 'Unknown';
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this package?')) return;
    await fetch(`/api/packages?id=${id}`, { method: 'DELETE' });
    setShowForm(false);
    setEditing(null);
    fetchPackages();
  }

  async function handleToggleActive(pkg: Package) {
    await fetch('/api/packages', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: pkg.id, is_active: !pkg.is_active }),
    });
    fetchPackages();
  }

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const body = {
      id: editing?.id,
      name: form.name,
      price: Number(form.price) || 0,
      image_url: form.image_url || null,
      description: form.description || null,
      is_private: form.is_private,
      is_active: form.is_active,
      expiration_value: form.has_expiration && form.expiration_value ? Number(form.expiration_value) : null,
      expiration_unit: form.has_expiration ? form.expiration_unit : null,
      services: formServices,
    };

    const res = await fetch('/api/packages', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error?.message ?? 'Failed to save'); setSaving(false); return; }
    setShowForm(false);
    setEditing(null);
    setSaving(false);
    fetchPackages();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((sid) => sid !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === packages.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(packages.map((p) => p.id));
    }
  }

  const isAddMode = showForm && !editing;
  const isEditMode = showForm && !!editing;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Packages</h1>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {packages.length}
          </span>
        </div>
        <button onClick={openNew} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + New Package
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : packages.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No packages yet.</p>
            <button onClick={openNew} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
              Create your first package
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
                      checked={selectedIds.length === packages.length && packages.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Expiration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Services</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {packages.map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="cursor-pointer hover:bg-gray-50"
                    onClick={() => openEdit(pkg)}
                  >
                    <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(pkg.id)}
                        onChange={() => toggleSelect(pkg.id)}
                        className="h-4 w-4 rounded border-gray-300 text-brand-600"
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {pkg.image_url ? (
                        <img src={pkg.image_url} alt={pkg.name} className="h-8 w-8 rounded object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-200 text-xs text-gray-400">--</div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{pkg.name}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">${pkg.price.toFixed(2)}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {pkg.expiration_value ? `${pkg.expiration_value} ${pkg.expiration_unit}` : 'No expiration'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {pkg.package_services?.length ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => handleToggleActive(pkg)}
                        className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                          pkg.is_active ? 'bg-brand-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                            pkg.is_active ? 'translate-x-4' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-in Panel — Add Mode */}
      {isAddMode && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">New Package</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                <ImageUpload
                  value={form.image_url}
                  onChange={(url) => setForm({ ...form, image_url: url })}
                  label=""
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Name *"
                      className="w-full h-8 rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                  <div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.price}
                      onChange={(e) => setForm({ ...form, price: e.target.value })}
                      placeholder="Price ($)"
                      className="w-full h-8 rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    />
                  </div>
                </div>
                {/* Expiration */}
                <div className="flex items-center">
                  <div className="w-1/2">
                    <label className="relative inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                      <input type="checkbox" checked={form.has_expiration} onChange={(e) => setForm({ ...form, has_expiration: e.target.checked })} className="peer sr-only" />
                      <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                      Has Expiration
                    </label>
                  </div>
                  {form.has_expiration && (
                    <div className="flex w-1/2 gap-3">
                      <input
                        type="number"
                        min="1"
                        value={form.expiration_value}
                        onChange={(e) => setForm({ ...form, expiration_value: e.target.value })}
                        placeholder="Value"
                        className="w-32 h-8 rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <select
                        value={form.expiration_unit}
                        onChange={(e) => setForm({ ...form, expiration_unit: e.target.value })}
                        className="h-8 rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                      </select>
                    </div>
                  )}
                </div>
                {/* Private toggle */}
                <div className="flex items-center">
                  <div className="w-1/2">
                    <label className="relative inline-flex cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                      <input type="checkbox" checked={form.is_private} onChange={(e) => setForm({ ...form, is_private: e.target.checked })} className="peer sr-only" />
                      <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                      Private package
                    </label>
                  </div>
                </div>
                {/* Description */}
                <div>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Description"
                    className="w-full rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                {/* Services */}
                <div>
                  <div className="flex gap-2">
                    <select
                      value={addServiceId}
                      onChange={(e) => setAddServiceId(e.target.value)}
                      className="flex-1 h-8 rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">Select a service</option>
                      {services
                        .filter((s) => !formServices.some((fs) => fs.service_id === s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={addServiceQty}
                      onChange={(e) => setAddServiceQty(e.target.value)}
                      className="w-20 h-8 rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      placeholder="Qty"
                    />
                    <button
                      type="button"
                      onClick={addServiceToList}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Add
                    </button>
                  </div>
                  {formServices.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formServices.map((fs) => (
                        <div key={fs.service_id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                          <span className="text-sm text-gray-700">{getServiceName(fs.service_id)} x{fs.quantity}</span>
                          <button type="button" onClick={() => removeServiceFromList(fs.service_id)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </div>
            {/* Footer */}
            <div className="flex justify-end gap-3 border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={saving}
                className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Create Package'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* Slide-in Panel — Edit Mode */}
      {isEditMode && editing && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowForm(false)} />
          <div className="fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-gray-900">Edit Package</h2>
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="space-y-5">
                <ImageUpload
                  value={form.image_url}
                  onChange={(url) => setForm({ ...form, image_url: url })}
                  label=""
                />
                {/* Name */}
                <div>
                  <label className="text-xs text-gray-400">Name</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Name *"
                    className="w-full h-8 rounded-[.3rem] border border-transparent bg-transparent px-3 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                {/* Price */}
                <div>
                  <label className="text-xs text-gray-400">Price ($)</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    placeholder="Price ($)"
                    className="w-full h-8 rounded-[.3rem] border border-transparent bg-transparent px-3 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                {/* Description */}
                <div>
                  <label className="text-xs text-gray-400">Description</label>
                  <textarea
                    rows={3}
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Description"
                    className="w-full rounded-[.3rem] border border-transparent bg-transparent px-3 py-1.5 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                  />
                </div>
                {/* Expiration */}
                <div className="flex items-center">
                  <div className="w-1/2">
                    <label className="text-xs text-gray-400">Expiration</label>
                    <div className="mt-1">
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input type="checkbox" checked={form.has_expiration} onChange={(e) => setForm({ ...form, has_expiration: e.target.checked })} className="peer sr-only" />
                        <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                      </label>
                    </div>
                  </div>
                  {form.has_expiration && (
                    <div className="flex w-1/2 gap-3">
                      <input
                        type="number"
                        min="1"
                        value={form.expiration_value}
                        onChange={(e) => setForm({ ...form, expiration_value: e.target.value })}
                        placeholder="Value"
                        className="w-24 h-8 rounded-[.3rem] border border-transparent bg-transparent px-3 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      />
                      <select
                        value={form.expiration_unit}
                        onChange={(e) => setForm({ ...form, expiration_unit: e.target.value })}
                        className="h-8 rounded-[.3rem] border border-transparent bg-transparent px-3 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      >
                        <option value="days">Days</option>
                        <option value="weeks">Weeks</option>
                        <option value="months">Months</option>
                        <option value="years">Years</option>
                      </select>
                    </div>
                  )}
                </div>
                {/* Active toggle */}
                <div className="flex items-center">
                  <div className="w-1/2">
                    <label className="text-xs text-gray-400">Active</label>
                    <div className="mt-1">
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="peer sr-only" />
                        <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                      </label>
                    </div>
                  </div>
                </div>
                {/* Private toggle */}
                <div className="flex items-center">
                  <div className="w-1/2">
                    <label className="text-xs text-gray-400">Private</label>
                    <div className="mt-1">
                      <label className="relative inline-flex cursor-pointer items-center">
                        <input type="checkbox" checked={form.is_private} onChange={(e) => setForm({ ...form, is_private: e.target.checked })} className="peer sr-only" />
                        <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                      </label>
                    </div>
                  </div>
                </div>
                {/* Services */}
                <div>
                  <label className="text-xs text-gray-400">Services</label>
                  <div className="mt-1 flex gap-2">
                    <select
                      value={addServiceId}
                      onChange={(e) => setAddServiceId(e.target.value)}
                      className="flex-1 h-8 rounded-[.3rem] border border-transparent bg-transparent px-3 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    >
                      <option value="">Select a service</option>
                      {services
                        .filter((s) => !formServices.some((fs) => fs.service_id === s.id))
                        .map((s) => (
                          <option key={s.id} value={s.id}>{s.name}</option>
                        ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={addServiceQty}
                      onChange={(e) => setAddServiceQty(e.target.value)}
                      className="w-20 h-8 rounded-[.3rem] border border-transparent bg-transparent px-3 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
                      placeholder="Qty"
                    />
                    <button
                      type="button"
                      onClick={addServiceToList}
                      className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Add
                    </button>
                  </div>
                  {formServices.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {formServices.map((fs) => (
                        <div key={fs.service_id} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2">
                          <span className="text-sm text-gray-700">{getServiceName(fs.service_id)} x{fs.quantity}</span>
                          <button type="button" onClick={() => removeServiceFromList(fs.service_id)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center border-t border-gray-200 px-6 py-4">
              <button
                onClick={() => handleDelete(editing.id)}
                className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
              >
                Delete
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowForm(false)}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Update Package'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
