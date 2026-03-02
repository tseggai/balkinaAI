'use client';

import { useEffect, useState, useCallback } from 'react';
import { ServiceForm } from '@/components/service-form';

interface ServiceExtra {
  id?: string;
  name: string;
  price: number;
  duration_minutes: number;
}

interface ServiceStaffMember {
  staff_id: string;
  staff_name: string;
}

interface Service {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  duration_minutes: number;
  price: number;
  deposit_enabled: boolean;
  deposit_type: 'fixed' | 'percentage' | null;
  deposit_amount: number | null;
  image_url: string | null;
  color: string;
  description: string | null;
  buffer_time_before: number;
  buffer_time_after: number;
  custom_duration: boolean;
  is_recurring: boolean;
  capacity: number;
  hide_price: boolean;
  hide_duration: boolean;
  visibility: string;
  min_booking_lead_time: number;
  max_booking_days_ahead: number;
  min_extras: number;
  max_extras: number | null;
  booking_limit_per_customer: number | null;
  booking_limit_per_customer_interval: string | null;
  booking_limit_per_slot: number | null;
  booking_limit_per_slot_interval: string | null;
  timesheet: Record<string, unknown> | null;
  created_at: string;
  service_extras?: ServiceExtra[];
  service_staff?: ServiceStaffMember[];
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [search, setSearch] = useState('');

  const fetchServices = useCallback(async () => {
    const res = await fetch('/api/services');
    const json = await res.json();
    setServices(json.data ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  async function handleDelete(id: string) {
    if (!confirm('Delete this service?')) return;
    await fetch(`/api/services?id=${id}`, { method: 'DELETE' });
    fetchServices();
  }

  function handleEdit(service: Service) {
    setEditing(service);
    setShowForm(true);
  }

  function handleDuplicate(service: Service) {
    const duplicated: Service = {
      ...service,
      id: '',
      name: `${service.name} (Copy)`,
    };
    setEditing(duplicated);
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

  const filteredServices = search.trim()
    ? services.filter((s) => s.name.toLowerCase().includes(search.toLowerCase()))
    : services;

  return (
    <div className="p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Services</h1>
          <p className="mt-1 text-sm text-gray-500">Manage your service offerings.</p>
        </div>
        <button
          onClick={() => {
            setEditing(null);
            setShowForm(true);
          }}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          Add Service
        </button>
      </div>

      {/* Search Bar */}
      <div className="mt-4">
        <input
          type="text"
          placeholder="Search services by name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-gray-500">Loading...</div>
        ) : filteredServices.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-sm text-gray-500">
              {search.trim() ? 'No services match your search.' : 'No services yet.'}
            </p>
            {!search.trim() && (
              <button
                onClick={() => {
                  setEditing(null);
                  setShowForm(true);
                }}
                className="mt-3 text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Add your first service
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Color</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Price</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Duration</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Staff</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Visibility</th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredServices.map((s) => (
                  <tr key={s.id} className="hover:bg-gray-50">
                    <td className="whitespace-nowrap px-4 py-3">
                      <div
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: s.color || '#6366f1' }}
                      />
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-gray-900">
                      {s.name}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {s.category_name ?? '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      ${s.price.toFixed(2)}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {s.duration_minutes} min
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-600">
                      {s.service_staff?.length ?? 0}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm">
                      {s.visibility === 'staff_only' ? (
                        <span className="inline-flex rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-medium text-yellow-700">
                          Staff Only
                        </span>
                      ) : (
                        <span className="inline-flex rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700">
                          Public
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-right text-sm">
                      <button
                        onClick={() => handleEdit(s)}
                        className="mr-3 text-brand-600 hover:text-brand-800"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDuplicate(s)}
                        className="mr-3 text-gray-600 hover:text-gray-800"
                      >
                        Duplicate
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Delete
                      </button>
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
