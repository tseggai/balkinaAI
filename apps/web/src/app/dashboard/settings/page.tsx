'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

type Tab = 'profile' | 'billing' | 'notifications' | 'widget' | 'gallery';

interface TenantInfo {
  id: string;
  name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  logo_url: string | null;
  stripe_customer_id: string | null;
  subscription_plan_id: string | null;
}

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>('profile');
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: '', phone: '' });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const initialFormValues = useRef<Record<string, unknown>>({});

  const fetchTenant = useCallback(async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('tenants')
      .select('id, name, owner_name, email, phone, logo_url, stripe_customer_id, subscription_plan_id')
      .eq('user_id', user.id)
      .single();

    const tenantInfo = data as TenantInfo | null;
    if (tenantInfo) {
      setTenant(tenantInfo);
      const formValues = { name: tenantInfo.name, phone: tenantInfo.phone ?? '' };
      setForm(formValues);
      initialFormValues.current = { ...formValues };
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

    const supabase = createClient();
    const ext = file.name.split('.').pop() ?? 'png';
    const filePath = `tenant-logos/${tenant.id}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('public-assets')
      .upload(filePath, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      setUploadingLogo(false);
      setMessage('Failed to upload logo');
      return;
    }

    const { data: urlData } = supabase.storage.from('public-assets').getPublicUrl(filePath);
    const logoUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    const { error: updateError } = await supabase
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
      .update({ name: form.name, phone: form.phone || null } as never)
      .eq('id', tenant.id);

    setSaving(false);
    if (error) { setMessage('Failed to save'); return; }
    initialFormValues.current = { ...form };
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
    { key: 'gallery', label: 'Gallery' },
    { key: 'billing', label: 'Billing' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'widget', label: 'Chat Widget' },
  ];

  return (
    <div className="p-6 lg:p-8">
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
              <label className="mb-1 block text-sm font-medium text-gray-700">Owner Email</label>
              <input disabled value={tenant?.email ?? ''} className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500" />
              <p className="mt-1 text-xs text-gray-400">Contact support to change email.</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Phone</label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
            </div>
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

        {/* Gallery */}
        {tab === 'gallery' && tenant && (
          <GalleryManager tenantId={tenant.id} />
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

// ── Gallery Manager ──────────────────────────────────────────────────────────

interface GalleryPhoto {
  id: string;
  image_url: string;
  caption: string | null;
  sort_order: number;
}

function GalleryManager({ tenantId }: { tenantId: string }) {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchPhotos = useCallback(async () => {
    const res = await fetch(`/api/gallery?tenantId=${tenantId}`);
    const json = await res.json() as { photos: GalleryPhoto[] };
    setPhotos(json.photos ?? []);
    setLoading(false);
  }, [tenantId]);

  useEffect(() => { fetchPhotos(); }, [fetchPhotos]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const form = new FormData();
      form.append('file', file);
      await fetch('/api/gallery', { method: 'POST', body: form });
    }

    await fetchPhotos();
    setUploading(false);
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this photo?')) return;
    await fetch(`/api/gallery?id=${id}`, { method: 'DELETE' });
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  function handleDragStart(idx: number) {
    setDragIdx(idx);
  }

  async function handleDrop(targetIdx: number) {
    if (dragIdx === null || dragIdx === targetIdx) { setDragIdx(null); return; }
    const reordered = [...photos];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(targetIdx, 0, moved!);
    const updated = reordered.map((p, i) => ({ ...p, sort_order: i }));
    setPhotos(updated);
    setDragIdx(null);
    await fetch('/api/gallery', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photos: updated.map((p) => ({ id: p.id, sort_order: p.sort_order })) }),
    });
  }

  if (loading) return <div className="p-6 text-center text-sm text-gray-500">Loading gallery...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Gallery Photos</h3>
          <p className="text-sm text-gray-500">Photos shown to customers when they discover your business. Drag to reorder.</p>
        </div>
        <button
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {uploading ? 'Uploading...' : 'Add Photos'}
        </button>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={handleUpload} />
      </div>

      {photos.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed border-gray-300 p-12 text-center">
          <p className="text-sm text-gray-500">No gallery photos yet. Add photos to showcase your business.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {photos.map((photo, idx) => (
            <div
              key={photo.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => handleDrop(idx)}
              className={`group relative aspect-square cursor-grab overflow-hidden rounded-lg border ${dragIdx === idx ? 'border-brand-500 opacity-50' : 'border-gray-200'}`}
            >
              <Image src={photo.image_url} alt={photo.caption ?? 'Gallery photo'} fill className="object-cover" sizes="(max-width: 640px) 50vw, 25vw" />
              <button
                onClick={() => handleDelete(photo.id)}
                className="absolute right-1 top-1 hidden rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 group-hover:block"
              >
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <div className="absolute bottom-0 left-0 right-0 bg-black/40 px-2 py-1 text-xs text-white opacity-0 group-hover:opacity-100">
                {idx + 1} of {photos.length}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
