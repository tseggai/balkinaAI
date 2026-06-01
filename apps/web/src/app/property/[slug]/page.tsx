'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ImageUpload } from '@/components/image-upload';

type Tab = 'branding' | 'tenants' | 'analytics';

interface Property {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  welcome_message: string;
  primary_color: string;
  secondary_color: string;
  background_color: string;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  custom_domain: string | null;
  tier: string;
}

interface PropertyTenant {
  id: string;
  tenant_id: string;
  display_order: number;
  featured: boolean;
  tenant_name: string;
  tenant_logo: string | null;
}

export default function PropertyDashboard() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [tab, setTab] = useState<Tab>('branding');
  const [property, setProperty] = useState<Property | null>(null);
  const [tenants, setTenants] = useState<PropertyTenant[]>([]);
  const [allTenants, setAllTenants] = useState<{ id: string; name: string; logo_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  // Form state
  const [form, setForm] = useState({
    name: '', description: '', welcome_message: '', primary_color: '#6B7FC4',
    website: '', address: '', city: '', country: '', custom_domain: '',
  });

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin.replace('app.', '')}/p/${slug}` : '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: prop } = await supabase
      .from('properties')
      .select('*')
      .eq('slug', slug)
      .single();

    if (prop) {
      const p = prop as Property;
      setProperty(p);
      setForm({
        name: p.name, description: p.description ?? '', welcome_message: p.welcome_message,
        primary_color: p.primary_color, website: p.website ?? '',
        address: p.address ?? '', city: p.city ?? '', country: p.country ?? '',
        custom_domain: p.custom_domain ?? '',
      });

      const { data: links } = await supabase
        .from('property_tenants')
        .select('id, tenant_id, display_order, featured, tenants(name, logo_url)')
        .eq('property_id', p.id)
        .order('display_order');

      setTenants(((links ?? []) as unknown as { id: string; tenant_id: string; display_order: number; featured: boolean; tenants: { name: string; logo_url: string | null } }[]).map((l) => ({
        id: l.id, tenant_id: l.tenant_id, display_order: l.display_order,
        featured: l.featured, tenant_name: l.tenants?.name ?? '', tenant_logo: l.tenants?.logo_url ?? null,
      })));
    }
    setLoading(false);
  }, [slug, supabase]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!property) return;
    setSaving(true);
    await supabase.from('properties').update({
      name: form.name, description: form.description || null,
      welcome_message: form.welcome_message, primary_color: form.primary_color,
      website: form.website || null, address: form.address || null,
      city: form.city || null, country: form.country || null,
      custom_domain: form.custom_domain || null,
    } as never).eq('id', property.id);
    setSaving(false);
    fetchData();
  };

  const handleToggleFeatured = async (linkId: string, featured: boolean) => {
    await supabase.from('property_tenants').update({ featured: !featured } as never).eq('id', linkId);
    fetchData();
  };

  const handleRemoveTenant = async (linkId: string) => {
    if (!confirm('Remove this tenant from the property?')) return;
    await supabase.from('property_tenants').delete().eq('id', linkId);
    fetchData();
  };

  const loadAllTenants = async () => {
    const { data } = await supabase.from('tenants').select('id, name, logo_url').eq('status', 'active').order('name');
    setAllTenants((data ?? []) as { id: string; name: string; logo_url: string | null }[]);
  };

  const addTenantToProperty = async (tenantId: string) => {
    if (!property) return;
    await supabase.from('property_tenants').insert({
      property_id: property.id, tenant_id: tenantId, display_order: tenants.length,
    } as never);
    fetchData();
  };

  const [addSearch, setAddSearch] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);

  const existingTenantIds = new Set(tenants.map((t) => t.tenant_id));
  const filteredAdd = allTenants
    .filter((t) => !existingTenantIds.has(t.id))
    .filter((t) => !addSearch || t.name.toLowerCase().includes(addSearch.toLowerCase()));

  if (loading) return <div className="text-center py-20 text-gray-500">Loading...</div>;
  if (!property) return <div className="text-center py-20 text-gray-500">Property not found</div>;

  const tabs: { key: Tab; label: string }[] = [
    { key: 'branding', label: 'Branding' },
    { key: 'tenants', label: `Tenants (${tenants.length})` },
    { key: 'analytics', label: 'Analytics' },
  ];

  return (
    <div>
      {/* Portal URL */}
      <div className="mb-6 flex items-center gap-3 rounded-lg bg-brand-50 px-4 py-3">
        <span className="text-sm text-brand-700">Your portal:</span>
        <code className="flex-1 text-sm text-brand-600 font-mono">{portalUrl}</code>
        <button
          onClick={() => { navigator.clipboard.writeText(portalUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
          className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t.key ? 'border-brand-500 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6">
        {/* Branding Tab */}
        {tab === 'branding' && (
          <div className="max-w-xl space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Property Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Logo</label>
              <ImageUpload value={property.logo_url ?? ''} onChange={async (url) => {
                await supabase.from('properties').update({ logo_url: url } as never).eq('id', property.id);
                fetchData();
              }} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Welcome Message</label>
              <input value={form.welcome_message} onChange={(e) => setForm({ ...form, welcome_message: e.target.value })}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Brand Color</label>
                <div className="mt-1 flex items-center gap-2">
                  <input type="color" value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="h-10 w-10 cursor-pointer rounded border-0" />
                  <input value={form.primary_color} onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Website</label>
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://..."
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">Custom Domain</label>
              <input value={form.custom_domain} onChange={(e) => setForm({ ...form, custom_domain: e.target.value })} placeholder="book.yourproperty.com"
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              <p className="mt-1 text-xs text-gray-400">Point a CNAME record to balkina.ai to use your own domain.</p>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}

        {/* Tenants Tab */}
        {tab === 'tenants' && (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-gray-500">{tenants.length} tenants in this property</p>
              <button onClick={() => { setShowAddPanel(!showAddPanel); if (!showAddPanel) loadAllTenants(); }}
                className="rounded-lg bg-brand-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-700">
                {showAddPanel ? 'Close' : '+ Add Tenant'}
              </button>
            </div>

            {showAddPanel && (
              <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4">
                <input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="Search businesses..."
                  className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {filteredAdd.slice(0, 20).map((t) => (
                    <button key={t.id} onClick={() => addTenantToProperty(t.id)}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50">
                      {t.logo_url ? (
                        <img src={t.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" />
                      ) : (
                        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-xs font-bold text-gray-500">{t.name.charAt(0)}</div>
                      )}
                      <span className="text-gray-700">{t.name}</span>
                    </button>
                  ))}
                  {filteredAdd.length === 0 && <p className="text-center text-xs text-gray-400 py-2">No businesses found</p>}
                </div>
              </div>
            )}

            <div className="space-y-2">
              {tenants.map((t) => (
                <div key={t.id} className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
                  {t.tenant_logo ? (
                    <img src={t.tenant_logo} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                  ) : (
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-sm font-bold text-gray-500">{t.tenant_name.charAt(0)}</div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-900">{t.tenant_name}</p>
                    {t.featured && <span className="text-xs text-brand-600 font-medium">Featured</span>}
                  </div>
                  <button onClick={() => handleToggleFeatured(t.id, t.featured)}
                    className={`rounded-lg px-3 py-1 text-xs font-medium ${t.featured ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
                    {t.featured ? '★ Featured' : '☆ Feature'}
                  </button>
                  <button onClick={() => handleRemoveTenant(t.id)}
                    className="rounded-lg px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50">
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {tab === 'analytics' && (
          <PropertyAnalytics tenantIds={tenants.map((t) => t.tenant_id)} />
        )}
      </div>
    </div>
  );
}

function PropertyAnalytics({ tenantIds }: { tenantIds: string[] }) {
  const supabase = createClient();
  const [stats, setStats] = useState({ totalTenants: 0, totalBookings: 0, pendingBookings: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (tenantIds.length === 0) { setLoading(false); return; }

      const [{ count: bookings }, { count: pending }, { data: revenue }] = await Promise.all([
        supabase.from('appointments').select('id', { count: 'exact', head: true }).in('tenant_id', tenantIds).in('status', ['confirmed', 'approved', 'completed']),
        supabase.from('appointments').select('id', { count: 'exact', head: true }).in('tenant_id', tenantIds).eq('status', 'pending'),
        supabase.from('appointments').select('total_price').in('tenant_id', tenantIds).in('status', ['confirmed', 'approved', 'completed']),
      ]);

      const totalRevenue = ((revenue ?? []) as { total_price: number }[]).reduce((sum, r) => sum + (r.total_price ?? 0), 0);

      setStats({
        totalTenants: tenantIds.length,
        totalBookings: bookings ?? 0,
        pendingBookings: pending ?? 0,
        totalRevenue,
      });
      setLoading(false);
    })();
  }, [tenantIds, supabase]);

  if (loading) return <div className="text-center py-10 text-gray-500">Loading analytics...</div>;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.totalTenants}</p>
          <p className="text-xs text-gray-500 mt-1">Businesses</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.totalBookings}</p>
          <p className="text-xs text-gray-500 mt-1">Total Bookings</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-orange-500">{stats.pendingBookings}</p>
          <p className="text-xs text-gray-500 mt-1">Pending</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4 text-center">
          <p className="text-2xl font-bold text-green-600">${stats.totalRevenue.toFixed(0)}</p>
          <p className="text-xs text-gray-500 mt-1">Revenue</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-gray-400">Analytics are aggregated across all tenants in this property. Detailed per-tenant analytics coming soon.</p>
    </div>
  );
}
