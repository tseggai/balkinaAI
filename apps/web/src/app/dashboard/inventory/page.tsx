'use client';

import { useEffect, useState, useCallback } from 'react';
import { ImageUpload } from '@/components/image-upload';

interface ProductService {
  id?: string;
  service_id: string;
  quantity_per_service: number;
  services?: { name: string } | null;
}

interface Product {
  id: string;
  name: string;
  image_url: string | null;
  description: string | null;
  quantity_on_hand: number;
  min_order_quantity: number;
  max_order_quantity: number | null;
  purchase_price: number;
  sell_price: number;
  display_in_booking: boolean;
  is_active: boolean;
  created_at: string;
  product_services?: ProductService[];
}

interface ServiceOption {
  id: string;
  name: string;
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [form, setForm] = useState({
    name: '',
    image_url: '',
    description: '',
    quantity_on_hand: '',
    min_order_quantity: '',
    max_order_quantity: '',
    purchase_price: '',
    sell_price: '',
    display_in_booking: false,
    is_active: true,
  });
  const [formServices, setFormServices] = useState<{ service_id: string; quantity_per_service: number }[]>([]);
  const [addServiceId, setAddServiceId] = useState('');
  const [addServiceQty, setAddServiceQty] = useState('1');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const fetchProducts = useCallback(async () => {
    const res = await fetch('/api/inventory');
    const json = await res.json();
    setProducts(json.data ?? []);
    setLoading(false);
  }, []);

  const fetchServices = useCallback(async () => {
    const res = await fetch('/api/services');
    const json = await res.json();
    setServices((json.data ?? []).map((s: { id: string; name: string }) => ({ id: s.id, name: s.name })));
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchServices();
  }, [fetchProducts, fetchServices]);

  function openNew() {
    setEditing(null);
    setForm({
      name: '', image_url: '', description: '', quantity_on_hand: '', min_order_quantity: '',
      max_order_quantity: '', purchase_price: '', sell_price: '', display_in_booking: false, is_active: true,
    });
    setFormServices([]);
    setAddServiceId('');
    setAddServiceQty('1');
    setShowForm(true);
  }

  function openEdit(product: Product) {
    setEditing(product);
    setForm({
      name: product.name,
      image_url: product.image_url ?? '',
      description: product.description ?? '',
      quantity_on_hand: String(product.quantity_on_hand),
      min_order_quantity: String(product.min_order_quantity),
      max_order_quantity: product.max_order_quantity !== null ? String(product.max_order_quantity) : '',
      purchase_price: String(product.purchase_price),
      sell_price: String(product.sell_price),
      display_in_booking: product.display_in_booking,
      is_active: product.is_active,
    });
    setFormServices(
      (product.product_services ?? []).map((ps) => ({
        service_id: ps.service_id,
        quantity_per_service: ps.quantity_per_service,
      }))
    );
    setAddServiceId('');
    setAddServiceQty('1');
    setShowForm(true);
  }

  function addServiceToList() {
    if (!addServiceId) return;
    if (formServices.some((s) => s.service_id === addServiceId)) return;
    setFormServices([...formServices, { service_id: addServiceId, quantity_per_service: Number(addServiceQty) || 1 }]);
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
    if (!confirm('Delete this product?')) return;
    await fetch(`/api/inventory?id=${id}`, { method: 'DELETE' });
    setShowForm(false);
    setEditing(null);
    fetchProducts();
  }

  async function handleToggleActive(product: Product) {
    await fetch('/api/inventory', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: product.id, is_active: !product.is_active }),
    });
    fetchProducts();
  }

  async function handleSubmit() {
    setError('');
    setSaving(true);

    const body = {
      id: editing?.id,
      name: form.name,
      image_url: form.image_url || null,
      description: form.description || null,
      quantity_on_hand: Number(form.quantity_on_hand) || 0,
      min_order_quantity: Number(form.min_order_quantity) || 0,
      max_order_quantity: form.max_order_quantity ? Number(form.max_order_quantity) : null,
      purchase_price: Number(form.purchase_price) || 0,
      sell_price: Number(form.sell_price) || 0,
      display_in_booking: form.display_in_booking,
      is_active: form.is_active,
      services: formServices,
    };

    const res = await fetch('/api/inventory', {
      method: editing ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const json = await res.json();
    if (!res.ok) { setError(json.error?.message ?? 'Failed to save'); setSaving(false); return; }
    setSaving(false);
    // Refresh the list without closing the panel
    const refreshRes = await fetch('/api/inventory');
    const refreshJson = await refreshRes.json();
    const refreshedProducts = (refreshJson.data ?? []) as Product[];
    setProducts(refreshedProducts);

    // If we just created a new product, switch to edit mode
    if (!editing && json.data?.id) {
      const newProduct = refreshedProducts.find((p) => p.id === json.data.id);
      if (newProduct) {
        openEdit(newProduct);
      }
    } else if (editing) {
      const updatedProduct = refreshedProducts.find((p) => p.id === editing.id);
      if (updatedProduct) {
        setEditing(updatedProduct);
        setFormServices(
          (updatedProduct.product_services ?? []).map((ps) => ({
            service_id: ps.service_id,
            quantity_per_service: ps.quantity_per_service,
          }))
        );
      }
    }
  }

  function toggleSelectId(id: string) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    if (selectedIds.length === products.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(products.map((p) => p.id));
    }
  }

  const addInputClass = 'w-full h-[46px] rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const editInputClass = 'w-full h-[46px] rounded-[.3rem] border border-transparent bg-transparent px-0 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';
  const addTextareaClass = 'w-full rounded-[.3rem] border border-[#f1f1f1] bg-[#f9fafb] px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';
  const editTextareaClass = 'w-full rounded-[.3rem] border border-transparent bg-transparent px-0 py-1.5 text-sm hover:border-[#f1f1f1] hover:bg-[#f9fafb] hover:px-3 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 focus:px-3';

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-gray-900">Inventory</h1>
          <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {products.length}
          </span>
        </div>
        <button onClick={openNew} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + New Product
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No products yet.</p>
            <button onClick={openNew} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
              Add your first product
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
                      checked={selectedIds.length === products.length && products.length > 0}
                      onChange={toggleSelectAll}
                      className="h-4 w-4 rounded border-gray-300 text-brand-600"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Image</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Stock</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Sell Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Services</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {products.map((p) => {
                  const isLowStock = p.min_order_quantity > 0 && p.quantity_on_hand < p.min_order_quantity;
                  return (
                    <tr
                      key={p.id}
                      className={`cursor-pointer hover:bg-gray-50 ${isLowStock ? 'bg-red-50' : ''}`}
                      onClick={() => openEdit(p)}
                    >
                      <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelectId(p.id)}
                          className="h-4 w-4 rounded border-gray-300 text-brand-600"
                        />
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {p.image_url ? (
                          <img src={p.image_url} alt={p.name} className="h-8 w-8 rounded object-cover" />
                        ) : (
                          <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-200 text-xs text-gray-400">--</div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{p.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm">
                        <span className={`font-medium ${isLowStock ? 'text-red-600' : 'text-green-600'}`}>
                          {p.quantity_on_hand}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">${p.sell_price.toFixed(2)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                        {p.product_services?.length ?? 0}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleToggleActive(p)}
                          className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                            p.is_active ? 'bg-brand-600' : 'bg-gray-200'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                              p.is_active ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
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
      {showForm && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setShowForm(false)} />
          <div className={`fixed inset-y-0 right-0 z-50 flex w-full flex-col bg-white shadow-2xl sm:w-[40%] sm:min-w-[630px]`}>
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-200 px-8 py-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {editing ? 'Edit Product' : 'New Product'}
              </h2>
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
            <div className="flex-1 overflow-y-auto px-8 py-3">
              <div className="space-y-5">
                <div className="w-full">
                  <ImageUpload
                    value={form.image_url}
                    onChange={(url) => setForm({ ...form, image_url: url })}
                  />
                </div>

                {editing ? (
                  /* ===== EDIT MODE: label above, transparent input, hover-to-edit ===== */
                  <>
                    <div className="space-y-0.5">
                      <span className="text-xs text-gray-400">Name *</span>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className={editInputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-0.5">
                        <span className="text-xs text-gray-400">Qty on Hand</span>
                        <input
                          type="number"
                          min="0"
                          value={form.quantity_on_hand}
                          onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })}
                          className={editInputClass}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs text-gray-400">Min Qty</span>
                        <input
                          type="number"
                          min="0"
                          value={form.min_order_quantity}
                          onChange={(e) => setForm({ ...form, min_order_quantity: e.target.value })}
                          className={editInputClass}
                        />
                      </div>
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-xs text-gray-400">Max Qty</span>
                      <input
                        type="number"
                        min="0"
                        value={form.max_order_quantity}
                        onChange={(e) => setForm({ ...form, max_order_quantity: e.target.value })}
                        placeholder="Unlimited"
                        className={editInputClass}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-0.5">
                        <span className="text-xs text-gray-400">Purchase Price ($)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.purchase_price}
                          onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                          className={editInputClass}
                        />
                      </div>
                      <div className="space-y-0.5">
                        <span className="text-xs text-gray-400">Sell Price ($)</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.sell_price}
                          onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                          className={editInputClass}
                        />
                      </div>
                    </div>
                    {/* Linked Services */}
                    <div>
                      <label className="mb-1 block text-xs text-gray-400">Linked Services</label>
                      <div className="flex gap-2">
                        <select
                          value={addServiceId}
                          onChange={(e) => setAddServiceId(e.target.value)}
                          className={`flex-1 ${editInputClass}`}
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
                          placeholder="Qty"
                          className={`w-20 ${editInputClass}`}
                        />
                        <button
                          type="button"
                          onClick={addServiceToList}
                          className="rounded-[.3rem] border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Add
                        </button>
                      </div>
                      {formServices.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {formServices.map((fs) => (
                            <div key={fs.service_id} className="flex items-center justify-between rounded-[.3rem] border border-gray-200 px-3 py-2">
                              <span className="text-sm text-gray-700">{getServiceName(fs.service_id)} (qty: {fs.quantity_per_service})</span>
                              <button type="button" onClick={() => removeServiceFromList(fs.service_id)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Toggles */}
                    <div className="flex items-center">
                      <label className="relative inline-flex w-1/2 cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={form.display_in_booking} onChange={(e) => setForm({ ...form, display_in_booking: e.target.checked })} className="peer sr-only" />
                        <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                        Display in booking
                      </label>
                      <label className="relative inline-flex w-1/2 cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="peer sr-only" />
                        <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                        Active
                      </label>
                    </div>
                    {/* Description */}
                    <div className="space-y-0.5">
                      <span className="text-xs text-gray-400">Description</span>
                      <textarea
                        rows={3}
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        className={editTextareaClass}
                      />
                    </div>
                  </>
                ) : (
                  /* ===== ADD MODE: placeholders instead of labels ===== */
                  <>
                    <div>
                      <input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        placeholder="Name *"
                        className={addInputClass}
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <input
                          type="number"
                          min="0"
                          value={form.quantity_on_hand}
                          onChange={(e) => setForm({ ...form, quantity_on_hand: e.target.value })}
                          placeholder="Qty on Hand"
                          className={addInputClass}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          value={form.min_order_quantity}
                          onChange={(e) => setForm({ ...form, min_order_quantity: e.target.value })}
                          placeholder="Min Qty"
                          className={addInputClass}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          value={form.max_order_quantity}
                          onChange={(e) => setForm({ ...form, max_order_quantity: e.target.value })}
                          placeholder="Max Qty (Unlimited)"
                          className={addInputClass}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.purchase_price}
                          onChange={(e) => setForm({ ...form, purchase_price: e.target.value })}
                          placeholder="Purchase Price ($)"
                          className={addInputClass}
                        />
                      </div>
                      <div>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={form.sell_price}
                          onChange={(e) => setForm({ ...form, sell_price: e.target.value })}
                          placeholder="Sell Price ($)"
                          className={addInputClass}
                        />
                      </div>
                    </div>
                    {/* Linked Services */}
                    <div>
                      <div className="flex gap-2">
                        <select
                          value={addServiceId}
                          onChange={(e) => setAddServiceId(e.target.value)}
                          className={`flex-1 ${addInputClass}`}
                        >
                          <option value="">Select a service to link</option>
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
                          placeholder="Qty"
                          className={`w-20 ${addInputClass}`}
                        />
                        <button
                          type="button"
                          onClick={addServiceToList}
                          className="rounded-[.3rem] border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          Add
                        </button>
                      </div>
                      {formServices.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {formServices.map((fs) => (
                            <div key={fs.service_id} className="flex items-center justify-between rounded-[.3rem] border border-gray-200 px-3 py-2">
                              <span className="text-sm text-gray-700">{getServiceName(fs.service_id)} (qty: {fs.quantity_per_service})</span>
                              <button type="button" onClick={() => removeServiceFromList(fs.service_id)} className="text-sm text-red-600 hover:text-red-800">Remove</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    {/* Toggles */}
                    <div className="flex items-center">
                      <label className="relative inline-flex w-1/2 cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={form.display_in_booking} onChange={(e) => setForm({ ...form, display_in_booking: e.target.checked })} className="peer sr-only" />
                        <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                        Display in booking
                      </label>
                      <label className="relative inline-flex w-1/2 cursor-pointer items-center gap-2 text-sm font-medium text-gray-700">
                        <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="peer sr-only" />
                        <div className="peer h-5 w-9 rounded-full bg-gray-200 after:absolute after:left-[2px] after:top-[2px] after:h-4 after:w-4 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-brand-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-focus:outline-none" />
                        Active
                      </label>
                    </div>
                    {/* Description */}
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

                {error && <p className="text-sm text-red-600">{error}</p>}
              </div>
            </div>
            {/* Footer */}
            <div className="flex items-center border-t border-gray-200 px-8 py-4">
              {editing && (
                <button
                  onClick={() => handleDelete(editing.id)}
                  className="mr-auto rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Delete
                </button>
              )}
              <div className={`flex gap-3 ${editing ? '' : 'ml-auto'}`}>
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
                  {saving ? 'Saving...' : editing ? 'Update' : 'Create Product'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
