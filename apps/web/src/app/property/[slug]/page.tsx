'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const [form, setForm] = useState({
    name: '', description: '', welcome_message: '', primary_color: '#6B7FC4',
    website: '', address: '', city: '', country: '', custom_domain: '',
  });

  const portalUrl = typeof window !== 'undefined' ? `${window.location.origin}/p/${slug}` : '';

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
        <TeamSection slug={slug} />
      )}

      {/* Settings */}
      {tab === 'settings' && (
        <div>
          <h2 className="text-xl font-bold text-gray-900">Settings</h2>
          <div className="mt-4 max-w-xl space-y-6">
            <div className="rounded-lg border border-gray-200 bg-white p-5">
              <h3 className="text-sm font-semibold text-gray-900">Custom Domain</h3>
              <p className="mt-1 text-xs text-gray-500">Use your own domain for the booking portal instead of app.balkina.ai/p/{slug}.</p>
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
                      <p>Value: <strong>app.balkina.ai</strong></p>
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
type Filter = (typeof FILTERS)[number];

function TenantsTab({
  slug,
  tenants,
  onChange,
  onToggleFeatured,
  onRemoveTenant,
}: {
  slug: string;
  propertyId: string;
  tenants: PropertyTenant[];
  onChange: () => void;
  onToggleFeatured: (linkId: string, featured: boolean) => void;
  onRemoveTenant: (linkId: string) => void;
}) {
  const portalOrigin = typeof window !== 'undefined' ? window.location.origin : '';

  const [invites, setInvites] = useState<Invite[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [filter, setFilter] = useState<Filter>('all');

  // Single add-or-invite modal
  const [showAdd, setShowAdd] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  const handleApprove = async (id: string) => {
    setBusyId(id);
    const res = await fetch(`/api/property/${slug}/applications/${id}`, { method: 'POST' });
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
        <button onClick={() => { setShowAdd(true); setResult(null); setAddEmail(''); }}
          className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
          + Add Tenant
        </button>
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
            <a href={`${portalOrigin}/property/${slug}`} target="_blank" rel="noopener noreferrer"
              className="rounded-lg px-3 py-1 text-xs font-medium text-gray-500 hover:bg-gray-100">
              View Page
            </a>
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
