'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

type Tab = 'profile' | 'billing' | 'notifications' | 'widget' | 'integrations';

interface TenantInfo {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  logo_url: string | null;
  stripe_customer_id: string | null;
  subscription_plan_id: string | null;
  category_id: string | null;
  slug: string | null;
  business_type: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '', category_ids: [] as string[], business_type: 'standard' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialFormValues = useRef<Record<string, unknown>>({});

  const fetchTenant = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const [{ data }, { data: cats }] = await Promise.all([
      supabase
        .from('tenants')
        .select('id, name, owner_name, email, phone, logo_url, stripe_customer_id, subscription_plan_id, category_id, slug, business_type')
        .eq('user_id', user.id)
        .single(),
      supabase
        .from('categories')
        .select('id, name')
        .is('parent_id', null)
        .order('display_order'),
    ]);

    if (cats) setCategories(cats as Category[]);

    const tenantInfo = data as TenantInfo | null;
    if (tenantInfo) {
      setTenant(tenantInfo);
      const { data: tcLinks } = await supabase
        .from('tenant_category_links')
        .select('category_id')
        .eq('tenant_id', tenantInfo.id);
      const catIds = ((tcLinks ?? []) as { category_id: string }[]).map((l) => l.category_id);
      const formValues = { name: tenantInfo.name, phone: tenantInfo.phone ?? '', category_ids: catIds, business_type: tenantInfo.business_type ?? 'standard' };
      setForm(formValues);
      initialFormValues.current = { ...formValues, category_ids: [...catIds] };
      setLogoPreview(tenantInfo.logo_url);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !tenant) return;

    if (!file.type.startsWith('image/')) {
      setMessage('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMessage('Image must be under 5MB');
      return;
    }

    setUploadingLogo(true);
    setMessage('');

    const formData = new FormData();
    formData.append('file', file);

    const uploadRes = await fetch('/api/upload', { method: 'POST', body: formData });
    const uploadJson = await uploadRes.json();

    if (!uploadRes.ok || !uploadJson.url) {
      setUploadingLogo(false);
      setMessage(uploadJson.error ?? 'Failed to upload logo');
      return;
    }

    const logoUrl = uploadJson.url;

    const sb = createClient();
    const { error: updateError } = await sb
      .from('tenants')
      .update({ logo_url: logoUrl } as never)
      .eq('id', tenant.id);

    setUploadingLogo(false);
    if (updateError) {
      setMessage('Failed to save logo URL');
      return;
    }

    setLogoPreview(logoUrl);
    setMessage('Logo updated!');
    fetchTenant();
  }

  async function handleRemoveLogo() {
    if (!tenant) return;
    setUploadingLogo(true);
    setMessage('');

    const supabase = createClient();
    const { error } = await supabase
      .from('tenants')
      .update({ logo_url: null } as never)
      .eq('id', tenant.id);

    setUploadingLogo(false);
    if (error) { setMessage('Failed to remove logo'); return; }
    setLogoPreview(null);
    setMessage('Logo removed');
    fetchTenant();
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (!tenant) return;
    setSaving(true);
    setMessage('');

    const supabase = createClient();
    const { error } = await supabase
      .from('tenants')
      .update({ name: form.name, phone: form.phone || null, category_id: form.category_ids[0] || null, business_type: form.business_type } as never)
      .eq('id', tenant.id);

    if (!error) {
      await supabase.from('tenant_category_links').delete().eq('tenant_id', tenant.id);
      if (form.category_ids.length > 0) {
        await supabase.from('tenant_category_links').insert(
          form.category_ids.map((cid) => ({ tenant_id: tenant.id, category_id: cid })) as never
        );
      }
    }

    setSaving(false);
    if (error) { setMessage('Failed to save'); return; }
    initialFormValues.current = { ...form, category_ids: [...form.category_ids] };
    setMessage('Settings saved!');
    fetchTenant();
  }

  async function openBillingPortal() {
    setSaving(true);
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const json = await res.json();
    setSaving(false);
    if (json.data?.url) {
      window.location.href = json.data.url;
    }
  }

  // Dirty-state tracking
  const isDirty = JSON.stringify(form) !== JSON.stringify(initialFormValues.current);

  if (loading) {
    return <div className="p-6 text-center text-sm text-gray-500 lg:p-8">Loading...</div>;
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'profile', label: 'Business Profile' },
    { key: 'billing', label: 'Billing' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'widget', label: 'Chat Widget' },
    { key: 'integrations', label: 'Integrations' },
  ];

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900">Settings</h1>

      {/* Tabs */}
      <div className="mt-6 border-b border-gray-200">
        <nav className="flex gap-6">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setMessage(''); }}
              className={`border-b-2 pb-3 text-sm font-medium transition-colors ${
                tab === t.key
                  ? 'border-brand-600 text-brand-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="mt-6 max-w-2xl">
        {/* Business Profile */}
        {tab === 'profile' && (
          <form onSubmit={handleProfileSave} className="space-y-5">
            {/* Business Logo */}
            <div>
              <label className="mb-2 block text-sm font-medium text-gray-700">Business Logo</label>
              <div className="flex items-center gap-4">
                <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border-2 border-dashed border-gray-300 bg-gray-50">
                  {logoPreview ? (
                    <Image src={logoPreview} alt="Business logo" fill className="object-cover" unoptimized />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-gray-400">
                      {tenant?.name?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingLogo}
                    className="rounded-lg border border-gray-300 px-4 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {uploadingLogo ? 'Uploading...' : logoPreview ? 'Change Logo' : 'Upload Logo'}
                  </button>
                  {logoPreview && (
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      disabled={uploadingLogo}
                      className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      Remove
                    </button>
                  )}
                  <p className="text-xs text-gray-400">PNG, JPG up to 5MB</p>
                </div>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Business Name</label>
              <input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Business Type</label>
              <select value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500">
                <option value="standard">Standard (appointments)</option>
                <option value="restaurant">Restaurant (reservations &amp; events)</option>
              </select>
              <p className="mt-1 text-xs text-gray-400">Restaurant mode tailors the AI&apos;s wording (experiences, reserve, host, guests) to your venue.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Owner Email</label>
              <input disabled value={tenant?.email ?? ''} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
              <p className="mt-1 text-xs text-gray-400">Contact support to change email.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Business Categories</label>
              <div className="space-y-1 rounded-lg border border-gray-300 p-3 max-h-48 overflow-y-auto">
                {categories.map((c) => (
                  <label key={c.id} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.category_ids.includes(c.id)}
                      onChange={(e) => setForm({ ...form, category_ids: e.target.checked ? [...form.category_ids, c.id] : form.category_ids.filter((id) => id !== c.id) })}
                      className="rounded border-gray-300 text-brand-600 focus:ring-brand-500" />
                    <span className="text-sm text-gray-700">{c.name}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-gray-400">Select all categories where customers can discover your business.</p>
            </div>
            {tenant?.slug && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Your Booking Link</label>
              <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
                <span className="flex-1 text-sm text-brand-600 truncate">balkina.ai/b/{tenant.slug}</span>
                <button type="button" onClick={() => { navigator.clipboard.writeText(`https://balkina.ai/b/${tenant.slug}`); setMessage('Link copied!'); }}
                  className="rounded-md bg-brand-600 px-3 py-1 text-xs font-medium text-white hover:bg-brand-700">Copy</button>
              </div>
              <p className="mt-1 text-xs text-gray-400">Share this link with your clients to let them book directly.</p>
            </div>
            )}
            {message && <p className={`text-sm ${message.includes('Failed') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
            <button type="submit" disabled={!isDirty || saving}
              style={{ opacity: (!isDirty || saving) ? 0.5 : 1 }}
              className="rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}

        {/* Billing */}
        {tab === 'billing' && (
          <div className="space-y-6">
            <div className="rounded-lg border border-gray-200 p-5">
              <p className="text-sm font-medium text-gray-700">Current Plan</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">
                {tenant?.subscription_plan_id ? 'Active' : 'No plan'}
              </p>
              <p className="mt-2 text-sm text-gray-500">
                Manage your subscription, update your payment method, or download invoices through the Stripe Customer Portal.
              </p>
              <button onClick={openBillingPortal} disabled={saving || !tenant?.stripe_customer_id}
                className="mt-4 rounded-lg bg-brand-600 px-6 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50">
                {saving ? 'Opening...' : 'Manage Billing'}
              </button>
            </div>
          </div>
        )}

        {/* Notifications */}
        {tab === 'notifications' && (
          <div className="space-y-4">
            <p className="text-sm text-gray-500">Configure how you receive notifications.</p>
            <NotifToggle label="Email notifications for new bookings" defaultChecked />
            <NotifToggle label="SMS notifications for new bookings" defaultChecked={false} />
            <NotifToggle label="Email notifications for cancellations" defaultChecked />
            <NotifToggle label="Daily booking summary email" defaultChecked={false} />
          </div>
        )}

        {/* Chat Widget */}
        {tab === 'widget' && tenant && (
          <WidgetEmbed tenantId={tenant.id} tenantName={tenant.name} />
        )}

        {tab === 'integrations' && tenant && (
          <BokunIntegration tenantId={tenant.id} />
        )}

      </div>
    </div>
  );
}

function WidgetEmbed({ tenantId, tenantName }: { tenantId: string; tenantName: string }) {
  const [copied, setCopied] = useState(false);
  const widgetUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/widget/${tenantId}`;
  const embedCode = `<iframe\n  src="${widgetUrl}"\n  width="400"\n  height="600"\n  style="border: none; border-radius: 12px; box-shadow: 0 4px 24px rgba(0,0,0,0.12);"\n  allow="clipboard-read; clipboard-write"\n  title="${tenantName} Booking Assistant"\n></iframe>`;

  function copyEmbed() {
    navigator.clipboard.writeText(embedCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900">AI Booking Chat Widget</h3>
        <p className="mt-1 text-sm text-gray-500">
          Embed this chat widget on your website so customers can book appointments through AI.
        </p>
      </div>

      {/* Embed code */}
      <div className="rounded-lg border border-gray-200 p-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-gray-700">Embed Code</p>
          <button
            onClick={copyEmbed}
            className="rounded-lg bg-brand-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-700"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-xs text-green-400">
          {embedCode}
        </pre>
      </div>

      {/* Direct link */}
      <div className="rounded-lg border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700">Direct Link</p>
        <p className="mt-1 text-sm text-gray-500">Share this link directly with your customers.</p>
        <div className="mt-3 flex items-center gap-2">
          <input
            readOnly
            value={widgetUrl}
            className="flex-1 rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-600"
          />
          <button
            onClick={() => { navigator.clipboard.writeText(widgetUrl); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
            className="rounded-lg border border-brand-600 px-4 py-2 text-xs font-medium text-brand-600 hover:bg-brand-50"
          >
            Copy
          </button>
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-lg border border-gray-200 p-5">
        <p className="text-sm font-medium text-gray-700">Preview</p>
        <p className="mt-1 mb-4 text-sm text-gray-500">This is how the chat widget will appear to your customers.</p>
        <div className="flex justify-center">
          <iframe
            src={widgetUrl}
            width="380"
            height="500"
            style={{ border: 'none', borderRadius: '12px', boxShadow: '0 4px 24px rgba(0,0,0,0.12)' }}
            title={`${tenantName} Booking Assistant Preview`}
          />
        </div>
      </div>
    </div>
  );
}

function NotifToggle({ label, defaultChecked }: { label: string; defaultChecked: boolean }) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <label className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
      <span className="text-sm text-gray-700">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => setChecked(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          checked ? 'bg-brand-600' : 'bg-gray-200'
        }`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`} />
      </button>
    </label>
  );
}

function BokunIntegration({ tenantId }: { tenantId: string }) {
  const [vendorId, setVendorId] = useState('');
  const [savedVendorId, setSavedVendorId] = useState('');
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/webhooks/bokun`
    : 'https://app.balkina.ai/api/webhooks/bokun';

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from('tenants')
        .select('bokun_vendor_id')
        .eq('id', tenantId)
        .single();
      const t = data as { bokun_vendor_id: string | null } | null;
      if (t?.bokun_vendor_id) {
        setVendorId(t.bokun_vendor_id);
        setSavedVendorId(t.bokun_vendor_id);
        setEnabled(true);
      }
      setLoading(false);
    })();
  }, [tenantId]);

  const handleSave = async () => {
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from('tenants')
      .update({ bokun_vendor_id: enabled ? vendorId.trim() || null : null } as never)
      .eq('id', tenantId);
    setSavedVendorId(enabled ? vendorId.trim() : '');
    setSaving(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) return <div className="text-sm text-gray-500">Loading...</div>;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium text-gray-900">OTA Distribution via Bokun</h3>
        <p className="mt-1 text-sm text-gray-500">
          Connect your Bokun account to sync bookings from Viator, GetYourGuide, Airbnb Experiences, and other OTAs.
          Bookings made on these platforms will automatically appear in your Balkina dashboard.
        </p>
      </div>

      {/* Enable toggle */}
      <label className="flex items-center justify-between rounded-lg border border-gray-200 p-4">
        <div>
          <span className="text-sm font-medium text-gray-900">Enable Bokun Integration</span>
          <p className="text-xs text-gray-500 mt-0.5">Receive OTA bookings in Balkina</p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          onClick={() => setEnabled(!enabled)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-brand-600' : 'bg-gray-200'}`}
        >
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </label>

      {enabled && (
        <>
          {/* Vendor ID */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Bokun Vendor ID
            </label>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">
              Find this in your Bokun dashboard — it&apos;s the number next to your company name (e.g. &quot;My Business (140057)&quot;).
            </p>
            <input
              type="text"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              placeholder="e.g. 140057"
              className="w-full max-w-xs rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || vendorId.trim() === savedVendorId}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Saving...' : 'Save'}
          </button>

          {/* Webhook URL + setup instructions */}
          {savedVendorId && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-4">
              <div>
                <h4 className="text-sm font-semibold text-gray-900">Setup Instructions</h4>
                <p className="mt-1 text-xs text-gray-600">Complete these steps in your Bokun dashboard:</p>
              </div>

              <div className="space-y-3 text-sm text-gray-700">
                <div className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white flex-shrink-0">1</span>
                  <div>
                    <p className="font-medium">Create your products in Bokun</p>
                    <p className="text-xs text-gray-500">Make sure the product names match your Balkina service names exactly.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white flex-shrink-0">2</span>
                  <div>
                    <p className="font-medium">Connect OTA sales channels</p>
                    <p className="text-xs text-gray-500">In Bokun, go to Marketplace → OTAs and connect Viator, GetYourGuide, etc.</p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand-500 text-xs font-bold text-white flex-shrink-0">3</span>
                  <div>
                    <p className="font-medium">Add the Balkina webhook</p>
                    <p className="text-xs text-gray-500">
                      Go to Settings → Connections → Integrated systems → Add → HTTP Booking notification.
                      Paste this URL and check all three notification boxes:
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={webhookUrl}
                        className="flex-1 rounded-lg border border-gray-300 bg-white px-3 py-2 text-xs font-mono text-gray-600"
                        onClick={(e) => (e.target as HTMLInputElement).select()}
                      />
                      <button
                        onClick={handleCopy}
                        className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700"
                      >
                        {copied ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="rounded-lg bg-green-50 border border-green-200 p-3">
                <p className="text-xs text-green-800">
                  <strong>That&apos;s it!</strong> Once configured, any booking made on Viator, GetYourGuide, or other connected OTAs will automatically appear in your Balkina appointments.
                  Cancellations sync automatically too.
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

