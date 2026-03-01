'use client';

import { useEffect, useState, useCallback } from 'react';
import { ServiceForm } from '@/components/service-form';

interface ServiceExtra {
  id?: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface Service {
  id: string;
  name: string;
  category_id: string | null;
  duration_minutes: number;
  price: number;
  deposit_enabled: boolean;
  deposit_type: 'fixed' | 'percentage' | null;
  deposit_amount: number | null;
  created_at: string;
  categories?: { name: string } | null;
  service_extras?: ServiceExtra[];
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);

  const fetchServices = useCallback(async () => {
    const res = await fetch('/api/services');
    const json = await res.json();
    setServices(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this service?')) return;
    await fetch(`/api/services?id=${id}`, { method: 'DELETE' });
    fetchServices();
  }

  function handleEdit(service: Service) {
    setEditing(service);
    setShowForm(true);
  }

  function handleClose() {
    setShowForm(false);
    setEditing(null);
    fetchServices();
  }

  if (showForm) {
    return (
      <div className="p-6 lg:p-8">
        <ServiceForm service={editing} onClose={handleClose} />
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your service offerings.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          Add Service
        </button>
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : services.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">No services yet.</p>
            <button onClick={() => setShowForm(true)} className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700">
              Add your first service
            </button>
          </div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Duration</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Deposit</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {services.map((s) => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">{s.name}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {s.categories?.name ?? '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">{s.duration_minutes} min</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">${s.price.toFixed(2)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                    {s.deposit_enabled ? (
                      <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                        {s.deposit_type === 'percentage' ? `${s.deposit_amount}%` : `$${s.deposit_amount}`}
                      </span>
                    ) : (
                      <span className="text-gray-400">None</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                    <button onClick={() => handleEdit(s)} className="mr-3 text-brand-600 hover:text-brand-800">Edit</button>
                    <button onClick={() => handleDelete(s.id)} className="text-red-600 hover:text-red-800">Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
