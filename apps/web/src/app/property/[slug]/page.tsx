'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ImageUpload } from '@/components/image-upload';
import { PropertyDashboardShell } from '@/components/property-dashboard-shell';

interface Property {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  welcome_message: string;
  primary_color: string;
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
  tenant_slug: string | null;
}

export default function PropertyDashboard() {
  const params = useParams();
  const slug = params.slug as string;
  const supabase = createClient();

  const [tab, setTab] = useState('dashboard');
  const [property, setProperty] = useState<Property | null>(null);
  const [tenants, setTenants] = useState<PropertyTenant[]>([]);
  const [allTenants, setAllTenants] = useState<{ id: string; name: string; logo_url: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [addSearch, setAddSearch] = useState('');
  const [showAddPanel, setShowAddPanel] = useState(false);

  const [form, setForm] = useState({
    name: '', description: '', welcome_message: '', primary_color: '#6B7FC4',
    website: '', address: '', city: '', country: '', custom_domain: '',
  });

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin.replace('app.', '')}/p/${slug}` : '';

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data: prop } = await supabase.from('properties').select('*').eq('slug', slug).single();
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
        .select('id, tenant_id, display_order, featured, tenants(name, logo_url, slug)')
        .eq('property_id', p.id)
        .order('display_order');

      setTenants(((links ?? []) as unknown as { id: string; tenant_id: string; display_order: number; featured: boolean; tenants: { name: string; logo_url: string | null; slug: string | null } }[]).map((l) => ({
        id: l.id, tenant_id: l.tenant_id, display_order: l.display_order,
        featured: l.featured, tenant_name: l.tenants?.name ?? '', tenant_logo: l.tenants?.logo_url ?? null, tenant_slug: l.tenants?.slug ?? null,
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
    await supabase.from('property_tenants').insert({ property_id: property.id, tenant_id: tenantId, display_order: tenants.length } as never);
    fetchData();
  };

  const existingTenantIds = new Set(tenants.map((t) => t.tenant_id));
  const filteredAdd = allTenants.filter((t) => !existingTenantIds.has(t.id)).filter((t) => !addSearch || t.name.toLowerCase().includes(addSearch.toLowerCase()));

  if (loading) return <div className="flex min-h-screen items-center justify-center text-gray-500">Loading...</div>;
  if (!property) return <div className="flex min-h-screen items-center justify-center text-gray-500">Property not found</div>;

  return (
    <PropertyDashboardShell
      propertyName={property.name}
      logoUrl={property.logo_url}
      primaryColor={property.primary_color}
      activeTab={tab}
      onTabChange={setTab}
    >
      {/* Dashboard / Analytics */}
      {tab === 'dashboard' && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dashboard</h2>
          <div className="mt-4 mb-6 flex items-center gap-3 rounded-lg bg-brand-50 px-4 py-3">
            <span className="text-sm text-brand-700">Portal URL:</span>
            <code className="flex-1 text-sm text-brand-600 font-mono truncate">{portalUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(portalUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
              className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <PropertyAnalytics tenantIds={tenants.map((t) => t.tenant_id)} />
        </div>
      )}

      {/* Tenants */}
      {tab === 'tenants' && (
        <div>
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-gray-900">Tenants ({tenants.length})</h2>
            <button onClick={() => { setShowAddPanel(!showAddPanel); if (!showAddPanel) loadAllTenants(); }}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
              {showAddPanel ? 'Close' : '+ Add Tenant'}
            </button>
          </div>

          {showAddPanel && (
            <div className="mt-4 rounded-lg border border-gray-200 bg-white p-4">
              <input value={addSearch} onChange={(e) => setAddSearch(e.target.value)} placeholder="Search businesses..."
                className="mb-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredAdd.slice(0, 20).map((t) => (
                  <button key={t.id} onClick={() => addTenantToProperty(t.id)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm hover:bg-gray-50">
                    {t.logo_url ? <img src={t.logo_url} alt="" className="h-8 w-8 rounded-lg object-cover" /> : <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-200 text-xs font-bold text-gray-500">{t.name.charAt(0)}</div>}
                    <span className="text-gray-700">{t.name}</span>
                  </button>
                ))}
                {filteredAdd.length === 0 && <p className="text-center text-xs text-gray-400 py-2">No businesses found</p>}
              </div>
            </div>
          )}

          <div className="mt-4 space-y-2">
            {tenants.map((t) => (
              <div key={t.id} className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
                {t.tenant_logo ? <img src={t.tenant_logo} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" /> : <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-sm font-bold text-gray-500">{t.tenant_name.charAt(0)}</div>}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{t.tenant_name}</p>
                  {t.featured && <span className="text-xs text-brand-600 font-medium">Featured</span>}
                </div>
                {t.tenant_slug && (
                  <a href={`/b/${t.tenant_slug}`} target="_blank" rel="noopener noreferrer"
                    className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">
                    View Page
                  </a>
                )}
                <button onClick={() => handleToggleFeatured(t.id, t.featured)}
                  className={`rounded-lg px-3 py-1 text-xs font-medium ${t.featured ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
                  {t.featured ? '★ Featured' : '☆ Feature'}
                </button>
                <button onClick={() => handleRemoveTenant(t.id)}
                  className="rounded-lg px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Remove</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Branding */}
      {tab === 'branding' && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Branding</h2>
          <div className="mt-4 max-w-xl space-y-4">
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
                <input value={form.website} onChange={(e) => setForm({ ...form, website: e.target.value })} placeholder="https://yourproperty.com"
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Address</label>
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">City</label>
                <input value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Country</label>
                <input value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={handleSave} disabled={saving}
              className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}

      {/* Team */}
      {tab === 'team' && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Team</h2>
          <p className="mt-2 text-sm text-gray-500">Manage property administrators and their access levels.</p>
          <p className="mt-4 text-sm text-gray-400">Team management coming soon. Contact support to add team members.</p>
        </div>
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <div className="mt-4 max-w-xl space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">Custom Domain</h3>
              <p className="mt-1 text-xs text-gray-500">Use your own domain for the booking portal instead of balkina.ai/p/{slug}.</p>
              <input value={form.custom_domain} onChange={(e) => setForm({ ...form, custom_domain: e.target.value })} placeholder="book.yourproperty.com"
                className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />

              {form.custom_domain && (
                <div className="mt-3 rounded-lg bg-gray-50 p-3 space-y-2">
                  <p className="text-xs font-semibold text-gray-700">DNS Setup Instructions:</p>
                  <div className="text-xs text-gray-600 space-y-1">
                    <p>1. Log into your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.)</p>
                    <p>2. Go to DNS settings for <strong>{form.custom_domain.split('.').slice(-2).join('.')}</strong></p>
                    <p>3. Add a <strong>CNAME</strong> record:</p>
                    <div className="ml-4 rounded bg-white border px-3 py-2 font-mono text-xs">
                      <p>Type: <strong>CNAME</strong></p>
                      <p>Name: <strong>{form.custom_domain.split('.')[0]}</strong></p>
                      <p>Value: <strong>balkina.ai</strong></p>
                      <p>TTL: <strong>Auto</strong></p>
                    </div>
                    <p>4. Save and wait 5-30 minutes for DNS to propagate.</p>
                    <p>5. Click Save Changes below to activate.</p>
                  </div>
                </div>
              )}

              <button onClick={handleSave} disabled={saving}
                className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">Portal URL</h3>
              <p className="mt-1 text-xs text-gray-500">Share this link with guests to access the booking portal.</p>
              <div className="mt-3 flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-600 font-mono truncate">{form.custom_domain || portalUrl}</code>
                <button onClick={() => { navigator.clipboard.writeText(form.custom_domain || portalUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                  className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>

            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">Subscription</h3>
              <p className="mt-1 text-xs text-gray-500">Your current plan and billing.</p>
              <div className="mt-3 inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600">
                {property?.tier === 'premium' ? 'Premium' : 'Essentials'}
              </div>
            </div>
          </div>
        </div>
      )}
    </PropertyDashboardShell>
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
      setStats({ totalTenants: tenantIds.length, totalBookings: bookings ?? 0, pendingBookings: pending ?? 0, totalRevenue });
      setLoading(false);
    })();
  }, [tenantIds, supabase]);

  if (loading) return <div className="text-center py-10 text-gray-500">Loading analytics...</div>;

  const cards = [
    { label: 'Businesses', value: stats.totalTenants, color: 'text-gray-900' },
    { label: 'Total Bookings', value: stats.totalBookings, color: 'text-gray-900' },
    { label: 'Pending', value: stats.pendingBookings, color: 'text-orange-500' },
    { label: 'Revenue', value: `$${stats.totalRevenue.toFixed(0)}`, color: 'text-green-600' },
  ];

  return (
    <div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-gray-200 bg-white p-5 text-center">
            <p className={`text-2xl font-bold ${c.color}`}>{c.value}</p>
            <p className="text-xs text-gray-500 mt-1">{c.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-4 text-xs text-gray-400">Analytics aggregated across all tenants. Detailed per-tenant analytics coming soon.</p>
    </div>
  );
}
