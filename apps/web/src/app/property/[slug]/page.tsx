'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ImageUpload } from '@/components/image-upload';
import { DateTimeField } from '@/components/datetime-field';
import { PropertyDashboardShell } from '@/components/property-dashboard-shell';

interface Property {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  cover_image_url: string | null;
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

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
    // Self-heal the per-seat billing quantity after a removal.
    fetch(`/api/property/${slug}/billing`).catch(() => {});
  };

  // Fast activation after returning from Stripe Checkout.
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    if (sp.get('billing') !== 'success' || !sp.get('session_id')) return;
    const sessionId = sp.get('session_id')!;
    setTab('settings');
    (async () => {
      await fetch(`/api/property/${slug}/billing/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }).catch(() => {});
      window.history.replaceState({}, '', `/property/${slug}`);
    })();
  }, [slug]);

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
          <PropertyAnalytics tenants={tenants.map((t) => ({ id: t.tenant_id, name: t.tenant_name }))} />
        </div>
      )}

      {/* Tenants */}
      {tab === 'tenants' && property && (
        <TenantsTab
          slug={slug}
          propertyId={property.id}
          tenants={tenants}
          accent={property.primary_color ?? '#6B7FC4'}
          onChange={fetchData}
          onToggleFeatured={handleToggleFeatured}
          onRemoveTenant={handleRemoveTenant}
        />
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
              <label className="block text-sm font-medium text-gray-700">Cover Image</label>
              <p className="mb-1 text-xs text-gray-500">Full-bleed hero photo shown at the top of your branded app.</p>
              <ImageUpload value={property.cover_image_url ?? ''} onChange={async (url) => {
                await supabase.from('properties').update({ cover_image_url: url } as never).eq('id', property.id);
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

      {/* Messages */}
      {tab === 'messages' && (
        <MessagesSection slug={slug} tenants={tenants} />
      )}

      {/* Campaigns */}
      {tab === 'campaigns' && (
        <CampaignsSection slug={slug} tenants={tenants} accent={property?.primary_color ?? '#6B7FC4'} />
      )}

      {/* Team */}
      {tab === 'team' && (
        <TeamSection slug={slug} />
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

            <BillingSection slug={slug} />
          </div>
        </div>
      )}
    </PropertyDashboardShell>
  );
}

interface Invite {
  id: string;
  invite_code: string;
  email: string | null;
  status: string;
  created_at: string;
}

interface Application {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  category: string | null;
  location: string | null;
  services_description: string | null;
  status: string;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  pending: 'bg-yellow-100 text-yellow-700',
  invited: 'bg-blue-100 text-blue-700',
};

const FILTERS = ['all', 'active', 'pending', 'invited'] as const;

interface DiscoverTenant {
  id: string;
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  category: string | null;
  address: string | null;
  distance_km: number | null;
}
type Filter = (typeof FILTERS)[number];

function TenantsTab({
  slug,
  tenants,
  accent,
  onChange,
  onToggleFeatured,
  onRemoveTenant,
}: {
  slug: string;
  propertyId: string;
  tenants: PropertyTenant[];
  accent: string;
  onChange: () => void;
  onToggleFeatured: (linkId: string, featured: boolean) => void;
  onRemoveTenant: (linkId: string) => void;
}) {

  const [invites, setInvites] = useState<Invite[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  // Single add-or-invite modal
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Discover-existing-tenants modal
  const [showDiscover, setShowDiscover] = useState(false);
  const [discoverQuery, setDiscoverQuery] = useState('');
  const [discoverResults, setDiscoverResults] = useState<DiscoverTenant[]>([]);
  const [discoverLoading, setDiscoverLoading] = useState(false);
  const [addedIds, setAddedIds] = useState<Set<string>>(new Set());
  const [detailTenantId, setDetailTenantId] = useState<string | null>(null);
  // Per-application business-type choice (defaults to 'service'). Hospitality
  // classification is set HERE by the property owner — it is not offered on the
  // global self-serve signup. Drives the experience/table flow + label set.
  const [bizTypeById, setBizTypeById] = useState<Map<string, string>>(new Map());

  const refresh = useCallback(async () => {
    const [invRes, appRes] = await Promise.all([
      fetch(`/api/property/${slug}/invites`),
      fetch(`/api/property/${slug}/applications`),
    ]);
    const invJson = await invRes.json();
    const appJson = await appRes.json();
    setInvites(invJson.data ?? []);
    setApplications(appJson.data ?? []);
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  // Only invites that haven't yet produced an application (status pending).
  const pendingInvites = invites.filter((i) => i.status === 'pending');

  const handleAddOrInvite = async () => {
    const email = addEmail.trim();
    if (!email) return;
    setSubmitting(true);
    setResult(null);
    const res = await fetch(`/api/property/${slug}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    const json = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setResult({ ok: false, message: json.error ?? 'Something went wrong.' });
      return;
    }
    setResult({ ok: true, message: json.message ?? 'Done.' });
    setAddEmail('');
    if (json.status === 'added') onChange();
    refresh();
  };

  const runDiscover = useCallback(async (q: string) => {
    setDiscoverLoading(true);
    try {
      const res = await fetch(`/api/property/${slug}/discover-tenants?q=${encodeURIComponent(q)}`);
      const json = await res.json();
      setDiscoverResults(res.ok ? (json.data ?? []) : []);
    } catch { setDiscoverResults([]); }
    setDiscoverLoading(false);
  }, [slug]);

  useEffect(() => {
    if (!showDiscover) return;
    const h = setTimeout(() => runDiscover(discoverQuery.trim()), 250);
    return () => clearTimeout(h);
  }, [showDiscover, discoverQuery, runDiscover]);

  const handleAddExisting = async (tenantId: string) => {
    setBusyId(tenantId);
    const res = await fetch(`/api/property/${slug}/tenants`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) { alert(json.error ?? 'Failed to add'); return; }
    setAddedIds((prev) => new Set(prev).add(tenantId));
    onChange();
  };

  const handleApprove = async (id: string) => {
    setBusyId(id);
    const businessType = bizTypeById.get(id) ?? 'service';
    const res = await fetch(`/api/property/${slug}/applications/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ businessType }),
    });
    const json = await res.json();
    setBusyId(null);
    if (!res.ok) { alert(json.error ?? 'Failed to approve'); return; }
    onChange();
    refresh();
  };

  const handleDecline = async (id: string) => {
    if (!confirm('Decline this application?')) return;
    setBusyId(id);
    await fetch(`/api/property/${slug}/applications/${id}`, { method: 'DELETE' });
    setBusyId(null);
    refresh();
  };

  const handleRevoke = async (id: string) => {
    await fetch(`/api/property/${slug}/invites?id=${id}`, { method: 'DELETE' });
    refresh();
  };

  const counts = {
    all: tenants.length + applications.length + pendingInvites.length,
    active: tenants.length,
    pending: applications.length,
    invited: pendingInvites.length,
  };

  const showTenants = filter === 'all' || filter === 'active';
  const showApplications = filter === 'all' || filter === 'pending';
  const showInvites = filter === 'all' || filter === 'invited';

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-gray-900">Tenants ({tenants.length})</h2>
        <div className="flex gap-2">
          <button onClick={() => { setShowDiscover(true); setDiscoverQuery(''); setDiscoverResults([]); }}
            className="rounded-lg border border-brand-500 px-4 py-2 text-sm font-medium text-brand-600 hover:bg-brand-50">
            Discover businesses
          </button>
          <button onClick={() => { setShowAdd(true); setResult(null); setAddEmail(''); }}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            + Add Tenant
          </button>
        </div>
      </div>

      {/* Filter */}
      <div className="mt-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === f ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {f === 'pending' ? 'pending approval' : f} ({counts[f]})
          </button>
        ))}
      </div>

      {/* Combined list */}
      <div className="mt-4 space-y-2">
        {/* Active tenants */}
        {showTenants && tenants.map((t) => (
          <div key={t.id} className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
            {t.tenant_logo ? <img src={t.tenant_logo} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" /> : <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-sm font-bold text-gray-500">{t.tenant_name.charAt(0)}</div>}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{t.tenant_name}</p>
              {t.featured && <span className="text-xs text-brand-600 font-medium">Featured</span>}
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE.active}`}>active</span>
            <button onClick={() => setDetailTenantId(t.tenant_id)}
              className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">
              View details
            </button>
            <button onClick={() => onToggleFeatured(t.id, t.featured)}
              className={`rounded-lg px-3 py-1 text-xs font-medium ${t.featured ? 'bg-brand-50 text-brand-600' : 'bg-gray-100 text-gray-500'}`}>
              {t.featured ? '★ Featured' : '☆ Feature'}
            </button>
            <button onClick={() => onRemoveTenant(t.id)}
              className="rounded-lg px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Remove</button>
          </div>
        ))}

        {/* Pending applications (awaiting approval) */}
        {showApplications && applications.map((a) => (
          <div key={a.id} className="flex items-center gap-4 rounded-lg border border-yellow-200 bg-yellow-50/40 px-4 py-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-yellow-100 text-sm font-bold text-yellow-700">{a.business_name.charAt(0)}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{a.business_name}</p>
              <p className="text-xs text-gray-500 truncate">{a.owner_name} · {a.email}{a.category ? ` · ${a.category}` : ''}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE.pending}`}>pending</span>
            <select
              value={bizTypeById.get(a.id) ?? 'service'}
              onChange={(e) => setBizTypeById((prev) => new Map(prev).set(a.id, e.target.value))}
              disabled={busyId === a.id}
              className="rounded-lg border border-gray-300 px-2 py-1 text-xs text-gray-700 focus:border-brand-500 focus:outline-none"
              title="Classify this business"
            >
              <option value="service">Service</option>
              <option value="hospitality">Hospitality</option>
            </select>
            <button onClick={() => handleApprove(a.id)} disabled={busyId === a.id}
              className="rounded-lg bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50">
              {busyId === a.id ? 'Approving...' : 'Approve'}
            </button>
            <button onClick={() => handleDecline(a.id)} disabled={busyId === a.id}
              className="rounded-lg px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50">Decline</button>
          </div>
        ))}

        {/* Sent invites (awaiting signup) */}
        {showInvites && pendingInvites.map((inv) => (
          <div key={inv.id} className="flex items-center gap-4 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-base text-gray-400">✉️</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{inv.email || 'Open invite'}</p>
              <p className="text-xs text-gray-400">Invited {new Date(inv.created_at).toLocaleDateString()}</p>
            </div>
            <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGE.invited}`}>invited</span>
            <button onClick={() => { navigator.clipboard.writeText(`${(process.env.NEXT_PUBLIC_MARKETING_URL || 'https://balkina.ai')}/join?property_invite=${inv.invite_code}`); }}
              className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">Copy Link</button>
            <button onClick={() => handleRevoke(inv.id)} className="rounded-lg px-3 py-1 text-xs font-medium text-red-500 hover:bg-red-50">Revoke</button>
          </div>
        ))}

        {counts[filter] === 0 && (
          <p className="rounded-lg border border-dashed border-gray-200 py-10 text-center text-sm text-gray-400">Nothing here yet.</p>
        )}
      </div>

      {/* Add-or-invite overlay */}
      {showAdd && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowAdd(false)}>
          <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Add a tenant</h3>
              <button onClick={() => setShowAdd(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Enter the business&apos;s email. If they&apos;re already on Balkina, they&apos;ll be added instantly.
              Otherwise we&apos;ll email them an invite to set up their business — and you&apos;ll approve it before it goes live.
            </p>
            <div className="mt-3 flex gap-2">
              <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} type="email" placeholder="business@email.com" autoFocus
                onKeyDown={(e) => { if (e.key === 'Enter') handleAddOrInvite(); }}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
              <button onClick={handleAddOrInvite} disabled={submitting || !addEmail.trim()}
                className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {submitting ? '...' : 'Add'}
              </button>
            </div>
            {result && (
              <div className={`mt-3 rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                {result.message}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discover existing businesses */}
      {showDiscover && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-4" onClick={() => setShowDiscover(false)}>
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col rounded-xl bg-white p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Discover businesses</h3>
              <button onClick={() => setShowDiscover(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Businesses already on Balkina, ranked by distance from your property. Add them directly — or use
              &ldquo;+ Add Tenant&rdquo; to invite one that isn&apos;t on Balkina yet.
            </p>
            <input
              value={discoverQuery}
              onChange={(e) => setDiscoverQuery(e.target.value)}
              placeholder="Search by name or category…"
              autoFocus
              className="mt-3 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
            />
            <div className="mt-3 flex-1 space-y-2 overflow-y-auto">
              {discoverLoading ? (
                <p className="py-6 text-center text-xs text-gray-400">Searching…</p>
              ) : discoverResults.length === 0 ? (
                <p className="py-6 text-center text-xs text-gray-400">No businesses found. Try a different search, or invite by email.</p>
              ) : discoverResults.map((d) => {
                const added = addedIds.has(d.id);
                return (
                  <div key={d.id} className="flex items-center gap-3 rounded-lg border border-gray-200 px-3 py-2">
                    {d.logo_url || d.cover_image_url
                      ? <img src={(d.logo_url || d.cover_image_url)!} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
                      : <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-gray-200 text-sm font-bold text-gray-500">{d.name.charAt(0)}</div>}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">{d.name}</p>
                      <p className="truncate text-xs text-gray-500">
                        {[d.category, d.address, d.distance_km != null ? `${d.distance_km} km away` : null].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                    {added ? (
                      <span className="rounded-lg bg-green-50 px-3 py-1 text-xs font-medium text-green-600">Added ✓</span>
                    ) : (
                      <button onClick={() => handleAddExisting(d.id)} disabled={busyId === d.id}
                        className="rounded-lg bg-brand-500 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                        {busyId === d.id ? '…' : 'Add'}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <TenantDetailModal slug={slug} tenantId={detailTenantId} accent={accent} onClose={() => setDetailTenantId(null)} />
    </div>
  );
}

function TenantDetailModal({ slug, tenantId, accent, onClose }: { slug: string; tenantId: string | null; accent: string; onClose: () => void }) {
  const [data, setData] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!tenantId) { setData(null); return; }
    setLoading(true);
    fetch(`/api/property/${slug}/tenant/${tenantId}`)
      .then((r) => r.json())
      .then((j) => setData(j.error ? null : j))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [slug, tenantId]);

  if (!tenantId) return null;
  const t = data?.tenant;
  const s = data?.stats;
  const money = (n: number) => `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const hero = t?.cover_image_url || t?.logo_url || null;
  const subtitle = [t?.location_name, t?.address].filter(Boolean).join(' · ') || t?.email || '';

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      {/* Header — matches the entries view: logo + name on the left, close ✕ */}
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          {t?.logo_url
            ? <img src={t.logo_url} alt="" className="h-10 w-10 flex-shrink-0 rounded-lg object-cover" />
            : <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white" style={{ backgroundColor: accent }}>{t?.name?.charAt(0) ?? '·'}</div>}
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900">{t?.name ?? 'Business'}</h3>
            {subtitle ? <p className="truncate text-xs text-gray-500">{subtitle}</p> : null}
          </div>
        </div>
        <button onClick={onClose} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-lg text-gray-500 hover:bg-gray-100">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading || !data ? (
          <p className="py-16 text-center text-sm text-gray-400">{loading ? 'Loading insights…' : 'Could not load this business.'}</p>
        ) : (
          <div className="mx-auto max-w-3xl">
            {hero ? (
              <div className="relative mb-6 h-40 overflow-hidden rounded-2xl">
                <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
              </div>
            ) : null}

            {t?.description ? <p className="mb-6 text-sm leading-relaxed text-gray-600">{t.description}</p> : null}

            {!data.is_member ? (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <span>ℹ️</span>
                <span>Added via Discover — this business isn&apos;t a property member, so its revenue and booking values are hidden. Invite them to join the property to see financials.</span>
              </div>
            ) : null}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {data.is_member ? <Stat label="Revenue" value={money(s?.revenue ?? 0)} /> : null}
              <Stat label="Bookings" value={String(s?.total_appointments ?? 0)} />
              <Stat label="Upcoming" value={String(s?.upcoming ?? 0)} />
              <Stat label="Completed" value={String(s?.completed ?? 0)} />
              <Stat label="Rating" value={s?.avg_rating != null ? `${s.avg_rating.toFixed(1)} (${s.review_count})` : '—'} />
              <Stat label="Cancelled" value={String(s?.cancelled ?? 0)} />
              <Stat label="Services" value={String(s?.service_count ?? 0)} />
              <Stat label="Staff" value={String(s?.staff_count ?? 0)} />
            </div>

            <h4 className="mt-6 text-xs font-semibold uppercase tracking-wide text-gray-400">Recent bookings</h4>
            <div className="mt-2 divide-y divide-gray-100 rounded-lg border border-gray-200">
              {(data.recent ?? []).length === 0 ? (
                <p className="p-4 text-center text-xs text-gray-400">No bookings yet.</p>
              ) : data.recent.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-gray-900">{r.service}</p>
                    <p className="truncate text-xs text-gray-500">{r.customer} · {new Date(r.date).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs capitalize text-gray-500">{r.status}</span>
                    {r.total != null ? <span className="text-sm font-medium text-gray-900">{money(r.total)}</span> : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50/60 p-3">
      <p className="text-lg font-bold text-gray-900">{value}</p>
      <p className="text-xs text-gray-500">{label}</p>
    </div>
  );
}

interface TenantDetail {
  is_member: boolean;
  tenant: { name: string; logo_url: string | null; cover_image_url: string | null; email: string | null; description: string | null; location_name: string | null; address: string | null } | null;
  stats: { total_appointments: number; upcoming: number; completed: number; cancelled: number; revenue: number | null; avg_rating: number | null; review_count: number; service_count: number; staff_count: number } | null;
  recent: { id: string; service: string; customer: string; date: string; status: string; total: number | null }[];
}

interface BillingState {
  tier: string;
  subscription_status: string;
  has_subscription: boolean;
  seats: number;
  seat_billing: boolean;
  included_seats: number;
  plan_included_seats: Record<string, number>;
  role: string;
  plans_configured: { essentials: boolean; premium: boolean };
}

const PLAN_LABELS: Record<string, { name: string; blurb: string }> = {
  essentials: { name: 'Essentials', blurb: 'Branded booking portal, tenant management, messaging' },
  premium: { name: 'Premium', blurb: 'Everything in Essentials + custom domain, native app, advanced analytics' },
  custom: { name: 'Custom', blurb: 'A tailored plan managed by Balkina' },
};

function BillingSection({ slug }: { slug: string }) {
  const [state, setState] = useState<BillingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');

  const fetchState = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/property/${slug}/billing`);
    const json = await res.json();
    if (res.ok) setState(json);
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchState(); }, [fetchState]);

  const subscribe = async (plan: string) => {
    setBusy(plan);
    const res = await fetch(`/api/property/${slug}/billing/checkout`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ plan }),
    });
    const json = await res.json();
    setBusy('');
    if (json.url) window.location.href = json.url;
    else alert(json.error ?? 'Could not start checkout');
  };

  const openPortal = async () => {
    setBusy('portal');
    const res = await fetch(`/api/property/${slug}/billing/portal`, { method: 'POST' });
    const json = await res.json();
    setBusy('');
    if (json.url) window.location.href = json.url;
    else alert(json.error ?? 'Could not open billing portal');
  };

  if (loading) return <div className="rounded-lg border border-gray-200 bg-white p-5 text-sm text-gray-400">Loading subscription…</div>;
  if (!state) return null;

  const isAdmin = state.role === 'admin';
  const active = state.subscription_status === 'active';
  const pastDue = state.subscription_status === 'past_due';
  const isCustom = state.tier === 'custom';

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">Subscription</h3>
      <p className="mt-1 text-xs text-gray-500">Your Balkina plan and per-business billing.</p>

      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-600">
          {PLAN_LABELS[state.tier]?.name ?? state.tier}
        </span>
        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${
          active ? 'bg-green-100 text-green-700' : pastDue ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'
        }`}>
          {active ? 'Active' : pastDue ? 'Past due' : 'Not subscribed'}
        </span>
        <span className="text-xs text-gray-400">{state.seats} business{state.seats === 1 ? '' : 'es'}</span>
      </div>

      {state.seat_billing && !isCustom && (
        <p className="mt-2 text-xs text-gray-400">
          {PLAN_LABELS[state.tier]?.name ?? state.tier} includes {state.included_seats} business{state.included_seats === 1 ? '' : 'es'}
          {state.seats > state.included_seats ? ` · ${state.seats - state.included_seats} billed as extra` : ' · within allowance'}
        </p>
      )}

      {isCustom ? (
        <div className="mt-4">
          <p className="text-xs text-gray-500">This is a tailored plan managed by Balkina. Contact your account manager to make changes.</p>
          {state.has_subscription && (
            <button onClick={openPortal} disabled={!isAdmin || busy === 'portal'}
              className="mt-3 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {busy === 'portal' ? 'Opening…' : 'Manage billing'}
            </button>
          )}
        </div>
      ) : state.has_subscription ? (
        <button onClick={openPortal} disabled={!isAdmin || busy === 'portal'}
          className="mt-4 rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {busy === 'portal' ? 'Opening…' : 'Manage billing'}
        </button>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {(['essentials', 'premium'] as const).map((plan) => {
            const included = state.plan_included_seats[plan] ?? 0;
            const overage = state.seat_billing ? Math.max(0, state.seats - included) : 0;
            return (
              <div key={plan} className="rounded-lg border border-gray-200 p-4">
                <p className="text-sm font-semibold text-gray-900">{PLAN_LABELS[plan]?.name ?? plan}</p>
                <p className="mt-1 text-xs text-gray-500">{PLAN_LABELS[plan]?.blurb ?? ''}</p>
                {state.seat_billing && (
                  <p className="mt-1 text-xs text-gray-400">Includes {included} business{included === 1 ? '' : 'es'}, then per-business after that.</p>
                )}
                <button onClick={() => subscribe(plan)} disabled={!isAdmin || !state.plans_configured[plan] || busy === plan}
                  className="mt-3 w-full rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                  {busy === plan ? 'Starting…' : !state.plans_configured[plan] ? 'Coming soon' : overage > 0 ? `Subscribe (+${overage} extra)` : 'Subscribe'}
                </button>
              </div>
            );
          })}
        </div>
      )}

      {!isAdmin && <p className="mt-3 text-xs text-gray-400">Only property admins can change billing.</p>}
      {pastDue && isAdmin && <p className="mt-3 text-xs text-orange-600">Your last payment failed — update your card in the billing portal to avoid interruption.</p>}
    </div>
  );
}

interface SentMessage {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  recipients_count: number;
  email_sent_count: number;
  created_at: string;
}

function MessagesSection({ slug, tenants }: { slug: string; tenants: PropertyTenant[] }) {
  const [history, setHistory] = useState<SentMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [recipient, setRecipient] = useState('all'); // 'all' or a tenant_id
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/property/${slug}/messages`);
    const json = await res.json();
    setHistory(json.data ?? []);
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) return;
    const recipientLabel = recipient === 'all' ? `all ${tenants.length} businesses` : tenants.find((t) => t.tenant_id === recipient)?.tenant_name;
    if (!confirm(`Send "${subject.trim()}" to ${recipientLabel}?`)) return;
    setSending(true);
    setResult(null);
    const res = await fetch(`/api/property/${slug}/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject: subject.trim(), body: body.trim(), tenantId: recipient === 'all' ? undefined : recipient }),
    });
    const json = await res.json();
    setSending(false);
    if (!res.ok) { setResult({ ok: false, message: json.error ?? 'Failed to send' }); return; }
    setResult({ ok: true, message: json.message ?? 'Sent.' });
    setSubject(''); setBody('');
    fetchHistory();
  };

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Messages</h2>
      <p className="mt-1 text-sm text-gray-500">Email an announcement to all your businesses, or message one directly — sent under your property&apos;s name via Balkina AI.</p>

      {/* Compose */}
      <div className="mt-4 max-w-2xl space-y-3 rounded-lg border border-gray-200 bg-white p-5">
        <div>
          <label className="block text-xs font-medium text-gray-500">Recipient</label>
          <select value={recipient} onChange={(e) => setRecipient(e.target.value)}
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
            <option value="all">📣 All businesses ({tenants.length})</option>
            {tenants.map((t) => (
              <option key={t.tenant_id} value={t.tenant_id}>{t.tenant_name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Subject</label>
          <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Summer hours & marina event"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500">Message</label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={5} placeholder="Write your announcement…"
            className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
        {result && (
          <div className={`rounded-lg px-3 py-2 text-xs ${result.ok ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>{result.message}</div>
        )}
        <button onClick={handleSend} disabled={sending || !subject.trim() || !body.trim()}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {sending ? 'Sending…' : recipient === 'all' ? 'Send to all' : 'Send'}
        </button>
      </div>

      {/* History */}
      <h3 className="mt-8 text-sm font-semibold text-gray-900">Sent history</h3>
      {loading ? (
        <p className="mt-3 text-sm text-gray-400">Loading…</p>
      ) : history.length === 0 ? (
        <p className="mt-3 text-sm text-gray-400">No messages sent yet.</p>
      ) : (
        <div className="mt-3 max-w-2xl space-y-2">
          {history.map((m) => (
            <div key={m.id} className="rounded-lg border border-gray-200 bg-white px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-900 truncate">{m.subject}</p>
                <span className="flex-shrink-0 text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
              <p className="mt-1 line-clamp-2 text-xs text-gray-500">{m.body}</p>
              <p className="mt-1.5 text-xs text-gray-400">To {m.recipient} · {m.email_sent_count}/{m.recipients_count} delivered</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function TeamSection({ slug }: { slug: string }) {
  const [team, setTeam] = useState<{ id: string; email: string; role: string; is_self: boolean; created_at: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [addEmail, setAddEmail] = useState('');
  const [addRole, setAddRole] = useState('manager');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const fetchTeam = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/property/${slug}/team`);
    const json = await res.json();
    setTeam(json.data ?? []);
    setLoading(false);
  }, [slug]);

  useEffect(() => { fetchTeam(); }, [fetchTeam]);

  const handleAdd = async () => {
    if (!addEmail.trim()) return;
    setAdding(true);
    setError('');
    const res = await fetch(`/api/property/${slug}/team`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: addEmail.trim(), role: addRole }),
    });
    const json = await res.json();
    if (!res.ok) setError(json.error ?? 'Failed');
    else { setAddEmail(''); fetchTeam(); }
    setAdding(false);
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this team member?')) return;
    await fetch(`/api/property/${slug}/team?id=${id}`, { method: 'DELETE' });
    fetchTeam();
  };

  const handleRoleChange = async (id: string, newRole: string) => {
    await fetch(`/api/property/${slug}/team`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, role: newRole }),
    });
    fetchTeam();
  };

  if (loading) return <div className="text-center py-10 text-gray-500">Loading team...</div>;

  return (
    <div>
      <h2 className="text-xl font-bold text-gray-900">Team</h2>
      <p className="mt-1 text-sm text-gray-500">Manage property administrators and their access levels.</p>

      {/* Add member */}
      <div className="mt-4 flex gap-2">
        <input value={addEmail} onChange={(e) => setAddEmail(e.target.value)} placeholder="Email address"
          className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        <select value={addRole} onChange={(e) => setAddRole(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm">
          <option value="admin">Admin</option>
          <option value="manager">Manager</option>
          <option value="viewer">Viewer</option>
        </select>
        <button onClick={handleAdd} disabled={adding || !addEmail.trim()}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
          {adding ? 'Adding...' : 'Add'}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-red-500">{error}</p>}

      {/* Role descriptions */}
      <div className="mt-3 rounded-lg bg-gray-50 p-3 grid grid-cols-3 gap-3 text-xs text-gray-500">
        <div><strong className="text-gray-700">Admin</strong> — Full access, manage team and branding</div>
        <div><strong className="text-gray-700">Manager</strong> — Manage tenants, view analytics</div>
        <div><strong className="text-gray-700">Viewer</strong> — View-only access</div>
      </div>

      {/* Team list */}
      <div className="mt-4 space-y-2">
        {team.map((m) => (
          <div key={m.id} className="flex items-center gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-600">
              {m.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">{m.email}</p>
              {m.is_self && <span className="text-xs text-brand-600">You</span>}
            </div>
            <select value={m.role} onChange={(e) => handleRoleChange(m.id, e.target.value)} disabled={m.is_self}
              className="rounded-lg border border-gray-200 px-2 py-1 text-xs disabled:opacity-50">
              <option value="admin">Admin</option>
              <option value="manager">Manager</option>
              <option value="viewer">Viewer</option>
            </select>
            {!m.is_self && (
              <button onClick={() => handleRemove(m.id)} className="text-xs text-red-500 hover:underline">Remove</button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const COUNTED_STATUSES = ['confirmed', 'approved', 'completed'];

interface ApptRow {
  tenant_id: string;
  status: string;
  total_price: number | null;
  start_time: string | null;
}

interface BreakdownRow {
  label: string;
  bookings: number;
  revenue: number;
}

function BreakdownList({ title, rows, empty }: { title: string; rows: BreakdownRow[]; empty: string }) {
  const maxRevenue = Math.max(1, ...rows.map((r) => r.revenue));
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {rows.length === 0 ? (
        <p className="mt-3 text-xs text-gray-400">{empty}</p>
      ) : (
        <div className="mt-3 space-y-3">
          {rows.map((r) => (
            <div key={r.label}>
              <div className="flex items-center justify-between text-xs">
                <span className="truncate pr-2 text-gray-700">{r.label}</span>
                <span className="flex-shrink-0 text-gray-500">{r.bookings} bookings · <span className="font-medium text-green-600">${r.revenue.toFixed(0)}</span></span>
              </div>
              <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-gray-100">
                <div className="h-full rounded-full bg-brand-500" style={{ width: `${Math.round((r.revenue / maxRevenue) * 100)}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PropertyAnalytics({ tenants }: { tenants: { id: string; name: string }[] }) {
  const supabase = createClient();
  const tenantIds = useMemo(() => tenants.map((t) => t.id), [tenants]);
  const nameById = useMemo(() => new Map(tenants.map((t) => [t.id, t.name])), [tenants]);

  const [appts, setAppts] = useState<ApptRow[]>([]);
  const [categoryByTenant, setCategoryByTenant] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [months, setMonths] = useState(6);

  useEffect(() => {
    (async () => {
      if (tenantIds.length === 0) { setAppts([]); setLoading(false); return; }
      setLoading(true);
      const [{ data: apptData }, { data: catRows }] = await Promise.all([
        supabase.from('appointments').select('tenant_id, status, total_price, start_time')
          .in('tenant_id', tenantIds).in('status', [...COUNTED_STATUSES, 'pending']),
        supabase.from('tenant_category_links').select('tenant_id, categories(name, parent_id)').in('tenant_id', tenantIds),
      ]);
      setAppts((apptData ?? []) as ApptRow[]);

      const catMap = new Map<string, string>();
      for (const row of (catRows ?? []) as { tenant_id: string; categories: { name: string; parent_id: string | null } | { name: string; parent_id: string | null }[] | null }[]) {
        const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
        // Prefer a subcategory (parent_id not null); otherwise keep whatever exists.
        if (cat?.name && (!catMap.has(row.tenant_id) || cat.parent_id)) catMap.set(row.tenant_id, cat.name);
      }
      setCategoryByTenant(catMap);
      setLoading(false);
    })();
  }, [tenantIds, supabase]);

  const derived = useMemo(() => {
    const counted = appts.filter((a) => COUNTED_STATUSES.includes(a.status));
    const totalRevenue = counted.reduce((s, a) => s + (a.total_price ?? 0), 0);
    const pendingBookings = appts.filter((a) => a.status === 'pending').length;

    // By tenant
    const tenantAgg = new Map<string, BreakdownRow>();
    for (const a of counted) {
      const label = nameById.get(a.tenant_id) ?? 'Unknown';
      const cur = tenantAgg.get(a.tenant_id) ?? { label, bookings: 0, revenue: 0 };
      cur.bookings += 1; cur.revenue += a.total_price ?? 0;
      tenantAgg.set(a.tenant_id, cur);
    }
    const byTenant = [...tenantAgg.values()].sort((x, y) => y.revenue - x.revenue);

    // By category
    const catAgg = new Map<string, BreakdownRow>();
    for (const a of counted) {
      const label = categoryByTenant.get(a.tenant_id) ?? 'Uncategorized';
      const cur = catAgg.get(label) ?? { label, bookings: 0, revenue: 0 };
      cur.bookings += 1; cur.revenue += a.total_price ?? 0;
      catAgg.set(label, cur);
    }
    const byCategory = [...catAgg.values()].sort((x, y) => y.revenue - x.revenue);

    // By time (monthly buckets, most recent `months`)
    const now = new Date();
    const buckets: BreakdownRow[] = [];
    const bucketIndex = new Map<string, number>();
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      bucketIndex.set(key, buckets.length);
      buckets.push({ label: d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' }), bookings: 0, revenue: 0 });
    }
    for (const a of counted) {
      if (!a.start_time) continue;
      const d = new Date(a.start_time);
      const idx = bucketIndex.get(`${d.getFullYear()}-${d.getMonth()}`);
      const bucket = idx !== undefined ? buckets[idx] : undefined;
      if (bucket) { bucket.bookings += 1; bucket.revenue += a.total_price ?? 0; }
    }

    return { totalBookings: counted.length, totalRevenue, pendingBookings, byTenant, byCategory, byTime: buckets };
  }, [appts, categoryByTenant, nameById, months]);

  if (loading) return <div className="text-center py-10 text-gray-500">Loading analytics...</div>;

  const cards = [
    { label: 'Businesses', value: tenants.length, color: 'text-gray-900' },
    { label: 'Total Bookings', value: derived.totalBookings, color: 'text-gray-900' },
    { label: 'Pending', value: derived.pendingBookings, color: 'text-orange-500' },
    { label: 'Revenue', value: `$${derived.totalRevenue.toFixed(0)}`, color: 'text-green-600' },
  ];

  const maxTimeRevenue = Math.max(1, ...derived.byTime.map((b) => b.revenue));

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

      {/* By time */}
      <div className="mt-6 rounded-lg border border-gray-200 bg-white p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Bookings over time</h3>
          <div className="flex gap-1">
            {[3, 6, 12].map((m) => (
              <button key={m} onClick={() => setMonths(m)}
                className={`rounded-md px-2 py-1 text-xs font-medium ${months === m ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {m}mo
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4 flex h-40 items-end gap-2">
          {derived.byTime.map((b) => (
            <div key={b.label} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div className="flex w-full items-end justify-center" style={{ height: '100%' }}>
                <div className="w-full max-w-[2.5rem] rounded-t bg-brand-500 transition-all"
                  style={{ height: `${Math.max(2, Math.round((b.revenue / maxTimeRevenue) * 100))}%` }}
                  title={`${b.bookings} bookings · $${b.revenue.toFixed(0)}`} />
              </div>
              <span className="text-[10px] text-gray-400">{b.label}</span>
              <span className="text-[10px] font-medium text-gray-600">{b.bookings}</span>
            </div>
          ))}
        </div>
      </div>

      {/* By tenant + category */}
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <BreakdownList title="By tenant" rows={derived.byTenant} empty="No bookings yet." />
        <BreakdownList title="By category" rows={derived.byCategory} empty="No bookings yet." />
      </div>
    </div>
  );
}

// ── Campaigns ────────────────────────────────────────────────────────────────

interface Campaign {
  id: string;
  title: string;
  blurb: string | null;
  description: string | null;
  image_url: string | null;
  campaign_type: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  is_property_only: boolean;
  cta_label: string | null;
  cta_url: string | null;
  cta_type: string;
  cta_fields: string[];
  cta_required: string[];
  cta_plus_one_limit: number | null;
  is_active: boolean;
  tenant_ids: string[];
}

const CAMPAIGN_TYPES = [
  { value: 'promotion', label: 'Promotion / Sale' },
  { value: 'event', label: 'Event' },
  { value: 'contest', label: 'Challenge / Contest' },
  { value: 'other', label: 'Other' },
];

const EMPTY_FORM = {
  title: '', blurb: '', description: '', image_url: '', campaign_type: 'promotion',
  starts_at: '', ends_at: '', location: '', is_property_only: true, cta_label: '', cta_url: '',
  cta_type: 'none', cta_fields: [] as string[], cta_required: [] as string[], cta_plus_one_limit: '' as string,
  tenantIds: [] as string[],
};

const CTA_TYPES = [
  { value: 'none', label: 'No button' },
  { value: 'rsvp', label: 'RSVP' },
  { value: 'signup', label: 'Sign up' },
  { value: 'learn_more', label: 'Learn more (link)' },
];

const COLLECT_FIELDS = [
  { key: 'first_name', label: 'First name' },
  { key: 'last_name', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'phone', label: 'Phone' },
  { key: 'plus_ones', label: 'Plus-ones' },
  { key: 'notes', label: 'Notes' },
];

function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function CampaignsSection({ slug, tenants, accent }: { slug: string; tenants: PropertyTenant[]; accent: string }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<'list' | 'calendar'>('list');

  const refresh = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/property/${slug}/campaigns`);
    const json = await res.json();
    setCampaigns(res.ok ? (json.data ?? []) : []);
    setLoading(false);
  }, [slug]);

  useEffect(() => { refresh(); }, [refresh]);

  const openCreate = () => { setEditId(null); setForm({ ...EMPTY_FORM }); setShowForm(true); };
  // Create a campaign pre-dated to a calendar day the manager tapped (defaults to 6pm).
  const openCreateOnDate = (day: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    const local = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T18:00`;
    setEditId(null);
    setForm({ ...EMPTY_FORM, starts_at: local });
    setShowForm(true);
  };
  const openEdit = (c: Campaign) => {
    setEditId(c.id);
    setForm({
      title: c.title, blurb: c.blurb ?? '', description: c.description ?? '', image_url: c.image_url ?? '',
      campaign_type: c.campaign_type, starts_at: toLocalInput(c.starts_at), ends_at: toLocalInput(c.ends_at),
      location: c.location ?? '', is_property_only: c.is_property_only, cta_label: c.cta_label ?? '',
      cta_url: c.cta_url ?? '', cta_type: c.cta_type ?? 'none', cta_fields: c.cta_fields ?? [],
      cta_required: c.cta_required ?? [], cta_plus_one_limit: c.cta_plus_one_limit != null ? String(c.cta_plus_one_limit) : '',
      tenantIds: c.tenant_ids ?? [],
    });
    setShowForm(true);
  };

  const save = async () => {
    if (!form.title.trim()) { alert('Title is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      starts_at: form.starts_at ? new Date(form.starts_at).toISOString() : null,
      ends_at: form.ends_at ? new Date(form.ends_at).toISOString() : null,
      cta_plus_one_limit: form.cta_plus_one_limit !== '' ? Number(form.cta_plus_one_limit) : null,
      tenantIds: form.is_property_only ? [] : form.tenantIds,
    };
    const res = await fetch(`/api/property/${slug}/campaigns${editId ? `/${editId}` : ''}`, {
      method: editId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setSaving(false);
    if (!res.ok) { const j = await res.json().catch(() => ({})); alert(j.error ?? 'Failed to save'); return; }
    setShowForm(false);
    refresh();
  };

  const toggleActive = async (c: Campaign) => {
    await fetch(`/api/property/${slug}/campaigns/${c.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ is_active: !c.is_active }),
    });
    refresh();
  };

  const remove = async (c: Campaign) => {
    if (!confirm(`Delete campaign "${c.title}"?`)) return;
    await fetch(`/api/property/${slug}/campaigns/${c.id}`, { method: 'DELETE' });
    refresh();
  };

  const toggleTenant = (tid: string) => {
    setForm((f) => ({ ...f, tenantIds: f.tenantIds.includes(tid) ? f.tenantIds.filter((x) => x !== tid) : [...f.tenantIds, tid] }));
  };
  const toggleField = (key: string) => {
    setForm((f) => {
      const on = f.cta_fields.includes(key);
      return {
        ...f,
        cta_fields: on ? f.cta_fields.filter((x) => x !== key) : [...f.cta_fields, key],
        cta_required: on ? f.cta_required.filter((x) => x !== key) : f.cta_required,
      };
    });
  };
  const toggleRequired = (key: string) => {
    setForm((f) => ({ ...f, cta_required: f.cta_required.includes(key) ? f.cta_required.filter((x) => x !== key) : [...f.cta_required, key] }));
  };
  const [entriesFor, setEntriesFor] = useState<Campaign | null>(null);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Campaigns</h2>
          <p className="mt-1 text-sm text-gray-500">Promotions, events and contests shown above the categories in the customer app.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 p-0.5">
            <button onClick={() => setView('list')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === 'list' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>List</button>
            <button onClick={() => setView('calendar')} className={`rounded-md px-3 py-1.5 text-xs font-medium ${view === 'calendar' ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>Calendar</button>
          </div>
          <button onClick={openCreate} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">+ New</button>
        </div>
      </div>

      {view === 'calendar' ? (
        <div className="mt-5">
          <CampaignCalendar campaigns={campaigns} accent={accent} onPickDate={openCreateOnDate} onPickCampaign={openEdit} />
        </div>
      ) : (
      <div className="mt-5 space-y-3">
        {loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : campaigns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
            <p className="text-sm text-gray-500">No campaigns yet. Create your first promotion or event.</p>
          </div>
        ) : campaigns.map((c) => (
          <div key={c.id} className="flex flex-col gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:flex-row sm:items-center sm:gap-4">
            <div className="flex min-w-0 flex-1 items-center gap-3 sm:gap-4">
              {c.image_url ? <img src={c.image_url} alt="" className="h-14 w-20 flex-shrink-0 rounded-lg object-cover sm:h-16 sm:w-24" /> : <div className="flex h-14 w-20 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 sm:h-16 sm:w-24">🎉</div>}
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-semibold text-gray-900">{c.title}</p>
                  <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium capitalize text-gray-600">{c.campaign_type}</span>
                  {!c.is_active && <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[11px] text-gray-500">paused</span>}
                </div>
                {c.blurb ? <p className="truncate text-xs text-gray-500">{c.blurb}</p> : null}
                <p className="mt-0.5 text-xs text-gray-400">
                  {c.is_property_only ? 'Property-hosted' : `${c.tenant_ids.length} partner${c.tenant_ids.length === 1 ? '' : 's'}`}
                  {c.starts_at ? ` · ${new Date(c.starts_at).toLocaleDateString()}` : ''}
                  {c.ends_at ? ` – ${new Date(c.ends_at).toLocaleDateString()}` : ''}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1 border-t border-gray-100 pt-2 sm:border-0 sm:pt-0">
              {c.cta_type === 'rsvp' || c.cta_type === 'signup' ? (
                <button onClick={() => setEntriesFor(c)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100">Entries</button>
              ) : null}
              <button onClick={() => toggleActive(c)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100">{c.is_active ? 'Pause' : 'Activate'}</button>
              <button onClick={() => openEdit(c)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-brand-600 hover:bg-brand-50">Edit</button>
              <button onClick={() => remove(c)} className="rounded-lg px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-50">Delete</button>
            </div>
          </div>
        ))}
      </div>
      )}

      <CampaignEntriesModal slug={slug} campaign={entriesFor} onClose={() => setEntriesFor(null)} />

      {showForm && (
        <div className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/40 p-4" onClick={() => setShowForm(false)}>
          <div className="my-8 w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{editId ? 'Edit campaign' : 'New campaign'}</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Hero image</label>
                <ImageUpload value={form.image_url} onChange={(url) => setForm((f) => ({ ...f, image_url: url }))} />
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Title *</label>
                  <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Black Friday Weekend" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Short blurb (shown on the card)</label>
                  <input value={form.blurb} onChange={(e) => setForm({ ...form, blurb: e.target.value })} placeholder="Up to 40% off across the marina" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
                  <select value={form.campaign_type} onChange={(e) => setForm({ ...form, campaign_type: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                    {CAMPAIGN_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Location (optional)</label>
                  <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="Central Park, Pier 4…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Starts</label>
                  <DateTimeField value={form.starts_at} onChange={(v) => setForm({ ...form, starts_at: v })} placeholder="Start date & time" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Ends</label>
                  <DateTimeField value={form.ends_at} onChange={(v) => setForm({ ...form, ends_at: v })} placeholder="End date & time" />
                </div>
                <div className="sm:col-span-2">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Description</label>
                  <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="What's happening, who it's for, how to take part…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                </div>
              </div>

              {/* Call to action */}
              <div className="rounded-lg border border-gray-200 p-3">
                <p className="mb-2 text-xs font-semibold text-gray-700">Call to action</p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Button</label>
                    <select value={form.cta_type} onChange={(e) => setForm({ ...form, cta_type: e.target.value })} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none">
                      {CTA_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  {form.cta_type !== 'none' && (
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Button label</label>
                      <input value={form.cta_label} onChange={(e) => setForm({ ...form, cta_label: e.target.value })} placeholder={form.cta_type === 'learn_more' ? 'Learn more' : 'RSVP'} className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                    </div>
                  )}
                </div>

                {form.cta_type === 'learn_more' && (
                  <div className="mt-3">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Link URL</label>
                    <input value={form.cta_url} onChange={(e) => setForm({ ...form, cta_url: e.target.value })} placeholder="https://…" className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
                  </div>
                )}

                {(form.cta_type === 'rsvp' || form.cta_type === 'signup') && (
                  <div className="mt-3">
                    <p className="mb-2 text-xs text-gray-500">Collect from customers</p>
                    <div className="flex flex-wrap gap-2">
                      {COLLECT_FIELDS.map((f) => {
                        const on = form.cta_fields.includes(f.key);
                        return (
                          <button key={f.key} type="button" onClick={() => toggleField(f.key)}
                            style={on ? { backgroundColor: accent, color: '#fff' } : undefined}
                            className={`rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${on ? '' : 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50'}`}>
                            {on ? '✓ ' : '+ '}{f.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Required toggles + plus-one limit */}
                    {form.cta_fields.length > 0 && (
                      <div className="mt-3 space-y-1.5">
                        {form.cta_fields.map((key) => {
                          const f = COLLECT_FIELDS.find((x) => x.key === key);
                          const req = form.cta_required.includes(key);
                          return (
                            <div key={key} className="flex items-center justify-between rounded-md bg-gray-50 px-3 py-1.5">
                              <span className="text-xs font-medium text-gray-700">{f?.label ?? key}</span>
                              <div className="flex items-center gap-3">
                                {key === 'plus_ones' && (
                                  <label className="flex items-center gap-1 text-xs text-gray-500">
                                    Max
                                    <input type="number" min={0} value={form.cta_plus_one_limit} onChange={(e) => setForm({ ...form, cta_plus_one_limit: e.target.value })}
                                      placeholder="∞" className="w-14 rounded border border-gray-200 px-2 py-0.5 text-xs focus:border-brand-500 focus:outline-none" />
                                  </label>
                                )}
                                <label className="flex items-center gap-1.5 text-xs text-gray-600">
                                  <input type="checkbox" checked={req} onChange={() => toggleRequired(key)} />
                                  Required
                                </label>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rounded-lg border border-gray-200 p-3">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700">
                  <input type="checkbox" checked={form.is_property_only} onChange={(e) => setForm({ ...form, is_property_only: e.target.checked })} />
                  Hosted by the property only (no partner businesses)
                </label>
                {!form.is_property_only && (
                  <div className="mt-3 max-h-44 space-y-1 overflow-y-auto">
                    <p className="mb-1 text-xs text-gray-500">Participating businesses</p>
                    {tenants.map((t) => (
                      <label key={t.tenant_id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-700 hover:bg-gray-50">
                        <input type="checkbox" checked={form.tenantIds.includes(t.tenant_id)} onChange={() => toggleTenant(t.tenant_id)} />
                        {t.tenant_name}
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-1">
                <button onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100">Cancel</button>
                <button onClick={save} disabled={saving} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">{saving ? 'Saving…' : editId ? 'Save changes' : 'Create campaign'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Month calendar for campaigns — managers tap a day to schedule, or a chip to edit.
function CampaignCalendar({ campaigns, accent, onPickDate, onPickCampaign }: {
  campaigns: Campaign[];
  accent: string;
  onPickDate: (day: Date) => void;
  onPickCampaign: (c: Campaign) => void;
}) {
  const [cursor, setCursor] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  // Group campaigns by local YYYY-M-D of their start date.
  const byDay = new Map<string, Campaign[]>();
  for (const c of campaigns) {
    if (!c.starts_at) continue;
    const d = new Date(c.starts_at);
    const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    const arr = byDay.get(key) ?? [];
    arr.push(c);
    byDay.set(key, arr);
  }

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  const monthLabel = cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4">
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => setCursor(new Date(year, month - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">‹</button>
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">{monthLabel}</h3>
          <button onClick={() => { const d = new Date(); setCursor(new Date(d.getFullYear(), d.getMonth(), 1)); }} className="rounded-md border border-gray-200 px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-50">Today</button>
        </div>
        <button onClick={() => setCursor(new Date(year, month + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100">›</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-gray-400">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => <div key={d} className="py-1">{d.charAt(0)}<span className="hidden sm:inline">{d.slice(1)}</span></div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((day, i) => {
          if (!day) return <div key={i} className="min-h-[64px] rounded-lg sm:min-h-[92px]" />;
          const key = `${day.getFullYear()}-${day.getMonth()}-${day.getDate()}`;
          const dayCamps = byDay.get(key) ?? [];
          const isToday = day.getTime() === today.getTime();
          const isPast = day.getTime() < today.getTime();
          return (
            <div
              key={i}
              onClick={() => onPickDate(day)}
              className={`group min-h-[64px] cursor-pointer rounded-lg border p-1 transition-colors sm:min-h-[92px] sm:p-1.5 ${isToday ? 'border-brand-400 bg-brand-50/40' : 'border-gray-100 hover:border-brand-300 hover:bg-gray-50'}`}
            >
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-semibold sm:text-xs ${isToday ? 'text-brand-600' : isPast ? 'text-gray-300' : 'text-gray-500'}`}>{day.getDate()}</span>
                <span className="hidden text-sm leading-none text-gray-300 group-hover:text-brand-400 sm:inline">+</span>
              </div>
              <div className="mt-1 space-y-0.5">
                {dayCamps.slice(0, 3).map((c) => (
                  <button
                    key={c.id}
                    onClick={(e) => { e.stopPropagation(); onPickCampaign(c); }}
                    title={c.title}
                    style={{ backgroundColor: c.is_active ? accent : '#9ca3af' }}
                    className="block w-full truncate rounded px-1 py-0.5 text-left text-[10px] font-medium text-white sm:text-[11px]"
                  >
                    {c.title}
                  </button>
                ))}
                {dayCamps.length > 3 ? <span className="block px-1 text-[10px] text-gray-400">+{dayCamps.length - 3} more</span> : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-gray-400">Tap any day to schedule a campaign or event. Tap a colored chip to edit one.</p>
    </div>
  );
}

interface EntryRow { id: string; data: Record<string, unknown>; created_at: string; checked_in: Record<string, string> | null }
interface GuestRow { entryId: string; index: number; name: string; party: string; partySize: number; submitted: string; checkedIn: boolean }
type ScanOutcome = { kind: 'ok' | 'already' | 'invalid'; name?: string };

function CampaignEntriesModal({ slug, campaign, onClose }: { slug: string; campaign: Campaign | null; onClose: () => void }) {
  const [data, setData] = useState<{ fields: string[]; entries: EntryRow[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [search, setSearch] = useState('');

  const refresh = useCallback(async () => {
    const r = await fetch(`/api/property/${slug}/campaigns/${campaign!.id}/entries`);
    const j = await r.json();
    setData(j.error ? { fields: [], entries: [] } : j);
  }, [slug, campaign]);

  useEffect(() => {
    if (!campaign) { setData(null); return; }
    setLoading(true);
    refresh().finally(() => setLoading(false));
    const t = setInterval(refresh, 4000); // near-realtime across check-in devices
    return () => clearInterval(t);
  }, [campaign, refresh]);

  const checkIn = useCallback(async (entryId: string, index: number, checked: boolean) => {
    setData((d) => d ? { ...d, entries: d.entries.map((e) => {
      if (e.id !== entryId) return e;
      const ci = { ...(e.checked_in ?? {}) };
      if (checked) ci[String(index)] = new Date().toISOString(); else delete ci[String(index)];
      return { ...e, checked_in: ci };
    }) } : d);
    await fetch(`/api/property/${slug}/campaigns/${campaign!.id}/entries`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entryId, guestIndex: index, checked }),
    }).catch(() => {});
  }, [slug, campaign]);

  const onScan = useCallback((code: string): ScanOutcome => {
    const [entryId, idxStr] = code.trim().split('.');
    if (!entryId) return { kind: 'invalid' };
    const index = Number(idxStr ?? '0') || 0;
    const entry = data?.entries.find((e) => e.id === entryId);
    if (!entry) return { kind: 'invalid' };
    const guests = (entry.data.guests as { name?: string }[] | undefined) ?? [];
    const name = guests[index]?.name || (index === 0 ? 'Guest' : `Guest ${index}`);
    if (entry.checked_in?.[String(index)]) return { kind: 'already', name };
    checkIn(entryId, index, true);
    return { kind: 'ok', name };
  }, [data, checkIn]);

  if (!campaign) return null;
  const entries = data?.entries ?? [];

  const guestRows: GuestRow[] = entries.flatMap((e) => {
    const guests = (e.data.guests as { name?: string }[] | undefined) ?? [{ name: [e.data.first_name, e.data.last_name].filter(Boolean).join(' ') || 'Guest' }];
    const party = guests[0]?.name || 'Guest';
    return guests.map((g, i) => ({
      entryId: e.id, index: i,
      name: g.name || (i === 0 ? party : `Guest ${i}`),
      party, partySize: guests.length, submitted: e.created_at,
      checkedIn: !!(e.checked_in?.[String(i)]),
    }));
  });
  const q = search.trim().toLowerCase();
  const visible = q ? guestRows.filter((g) => g.name.toLowerCase().includes(q) || g.party.toLowerCase().includes(q)) : guestRows;
  const arrived = guestRows.filter((g) => g.checkedIn).length;

  const downloadCsv = () => {
    const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const header = ['Name', 'Party', 'Party size', 'Arrived', 'Submitted'].map(esc).join(',');
    const rows = guestRows.map((g) => [g.name, g.party, g.partySize, g.checkedIn ? 'Yes' : 'No', new Date(g.submitted).toLocaleString()].map(esc).join(','));
    const url = URL.createObjectURL(new Blob([[header, ...rows].join('\n')], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `${campaign.title.replace(/[^a-z0-9]+/gi, '-')}-guests.csv`;
    a.click(); URL.revokeObjectURL(url);
  };
  const printPdf = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    const trs = guestRows.map((g) => `<tr><td>${g.name}</td><td>${g.party}</td><td>${g.partySize}</td><td>${g.checkedIn ? 'Yes' : 'No'}</td></tr>`).join('');
    w.document.write(`<html><head><title>${campaign.title} — guests</title><style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:18px}table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px}th,td{border:1px solid #e5e7eb;padding:6px 10px;text-align:left}th{background:#f9fafb}</style></head><body><h1>${campaign.title} — ${arrived}/${guestRows.length} arrived</h1><table><thead><tr><th>Name</th><th>Party</th><th>Size</th><th>Arrived</th></tr></thead><tbody>${trs}</tbody></table></body></html>`);
    w.document.close(); w.focus(); setTimeout(() => w.print(), 250);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <div className="flex items-center justify-between gap-3 border-b border-gray-200 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h3 className="truncate text-base font-semibold text-gray-900">{campaign.title}</h3>
          <p className="text-xs text-gray-500"><span className="font-semibold text-gray-700">{arrived}</span> / {guestRows.length} arrived</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setScanOpen(true)} className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">Scan QR</button>
          <button onClick={downloadCsv} className="hidden rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:block">CSV</button>
          <button onClick={printPdf} className="hidden rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 sm:block">Print</button>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-gray-500 hover:bg-gray-100">✕</button>
        </div>
      </div>

      {guestRows.length > 0 && (
        <div className="border-b border-gray-100 px-4 py-2 sm:px-6">
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search guests…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">Loading…</p>
        ) : guestRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No entries yet.</p>
        ) : visible.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">No matching guests.</p>
        ) : (
          <div className="mx-auto grid max-w-3xl gap-2">
            {visible.map((g) => (
              <button key={`${g.entryId}.${g.index}`} onClick={() => checkIn(g.entryId, g.index, !g.checkedIn)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors ${g.checkedIn ? 'border-green-400 bg-green-50' : 'border-gray-200 bg-white hover:bg-gray-50 active:bg-gray-100'}`}>
                <span className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full border-2 text-lg ${g.checkedIn ? 'border-green-500 bg-green-500 text-white' : 'border-gray-300 text-transparent'}`}>✓</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-gray-900">{g.name}</span>
                  <span className="block text-xs text-gray-500">
                    {g.partySize > 1 ? `Party of ${g.partySize}${g.index > 0 ? ` · guest of ${g.party}` : ' · host'}` : 'Solo'}
                  </span>
                </span>
                {g.checkedIn && <span className="flex-shrink-0 text-xs font-semibold text-green-600">Arrived</span>}
              </button>
            ))}
          </div>
        )}
      </div>
      {scanOpen && <QrScanner onScan={onScan} onClose={() => setScanOpen(false)} />}
    </div>
  );
}

function QrScanner({ onScan, onClose }: { onScan: (code: string) => ScanOutcome; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState<string | null>(null);
  // While a result card is shown we freeze detection so the camera doesn't flicker.
  const pausedRef = useRef(false);
  const [result, setResult] = useState<ScanOutcome | null>(null);

  // onScan changes on every entries poll (~4s). Keep it in a ref so the camera
  // effect runs ONCE on mount — otherwise it tears down and re-acquires the
  // camera every few seconds, which aborts play() and throws on srcObject.
  const onScanRef = useRef(onScan);
  useEffect(() => { onScanRef.current = onScan; }, [onScan]);

  // Resume scanning the next attendee.
  const scanNext = useCallback(() => { setResult(null); pausedRef.current = false; }, []);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let cancelled = false;
    const canvas = document.createElement('canvas');

    // Load jsQR from CDN at runtime (no npm dependency / build impact).
    const ensureJsQR = () => new Promise<void>((resolve, reject) => {
      const w = window as unknown as { jsQR?: unknown };
      if (w.jsQR) return resolve();
      const s = document.createElement('script');
      s.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
      s.onload = () => resolve();
      s.onerror = () => reject(new Error('Could not load the scanner.'));
      document.head.appendChild(s);
    });

    (async () => {
      try {
        await ensureJsQR();
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        const video = videoRef.current;
        if (cancelled || !video) { stream.getTracks().forEach((t) => t.stop()); return; }
        video.srcObject = stream;
        // play() can reject with AbortError if the element re-renders; ignore it.
        await video.play().catch(() => {});
        const jsQR = (window as unknown as { jsQR: (d: Uint8ClampedArray, w: number, h: number) => { data: string } | null }).jsQR;
        const tick = () => {
          if (!pausedRef.current && video.readyState === video.HAVE_ENOUGH_DATA) {
            canvas.width = video.videoWidth; canvas.height = video.videoHeight;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
            const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const found = jsQR(img.data, img.width, img.height);
            if (found?.data) {
              // Freeze and surface a clear result; the operator taps "Scan next".
              pausedRef.current = true;
              setResult(onScanRef.current(found.data));
            }
          }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      } catch (e) {
        if (!cancelled) setErr(e instanceof Error ? e.message : 'Camera unavailable. Use the checklist instead.');
      }
    })();

    return () => { cancelled = true; cancelAnimationFrame(raf); if (stream) stream.getTracks().forEach((t) => t.stop()); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ok = result?.kind === 'ok';
  const already = result?.kind === 'already';

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Scan attendee QR</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        {err ? (
          <p className="mt-4 text-sm text-red-600">{err}</p>
        ) : (
          <>
            {/* Camera stays mounted (so its stream survives "Scan next"); the
                result card overlays it. */}
            <div className={result ? 'hidden' : 'block'}>
              <div className="mt-4 overflow-hidden rounded-xl bg-black">
                <video ref={videoRef} playsInline muted className="aspect-square w-full object-cover" />
              </div>
              <p className="mt-3 text-center text-xs text-gray-500">Point at the attendee&apos;s QR — they&apos;re checked in automatically.</p>
            </div>
            {result ? (
              <div className="mt-4 flex flex-col items-center py-6 text-center">
                <div className={`flex h-24 w-24 items-center justify-center rounded-full ${ok ? 'bg-green-100' : 'bg-red-100'}`}>
                  <span className={`text-5xl ${ok ? 'text-green-600' : 'text-red-600'}`}>{ok ? '✓' : '✕'}</span>
                </div>
                <p className={`mt-5 text-xl font-bold ${ok ? 'text-green-700' : 'text-red-700'}`}>
                  {ok ? 'Checked in' : already ? 'Already checked in' : 'Invalid ticket'}
                </p>
                {result.name && (ok || already) ? <p className="mt-1 text-base text-gray-700">{result.name}</p> : null}
                {already ? <p className="mt-1 text-sm text-gray-500">This QR has already been used.</p> : null}
                {result.kind === 'invalid' ? <p className="mt-1 text-sm text-gray-500">Not a valid ticket for this campaign.</p> : null}
                <div className="mt-6 flex w-full gap-2">
                  <button onClick={scanNext} className="flex-1 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700">Scan next</button>
                  <button onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50">Done</button>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
