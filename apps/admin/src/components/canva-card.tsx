'use client';

import { useCallback, useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, SECTION_TITLE } from '@/components/prospect-crm';

interface Template {
  id: string;
  brand_template_id: string;
  title: string;
  layout: string;
  format: 'sq' | 'st';
  fields: Record<string, string>;
  thumbnail_url: string | null;
  last_render_url: string | null;
}

interface Status {
  configured: boolean;
  client_id: string;
  client_id_raw_length: number;
  redirect_uri: string;
  scopes: string[];
  connected: boolean;
  connection: { connected_at: string; expires_at: string; user_id: string | null } | null;
  templates: Template[];
}

const EXPECTED = ['card', 'split', 'framed', 'circle', 'column', 'steps', 'cta', 'stat'];

/** Canva connection + brand-template registry + test render. */
export function CanvaCard({ notify }: { notify: (title: string, lines: string[]) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState('');
  const [preview, setPreview] = useState<{ title: string; url: string } | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/canva/status');
    if (res.ok) setStatus((await res.json()) as Status);
  }, []);

  useEffect(() => {
    void load();
    const q = new URLSearchParams(window.location.search).get('canva');
    if (q === 'connected') {
      notify('Canva connected', ['Templates named "IG · NN layout · square|story" can now be synced.']);
      window.history.replaceState(null, '', '/dashboard/instagram');
      setOpen(true);
    } else if (q?.startsWith('error')) {
      notify('Canva connection failed', [decodeURIComponent(q.replace(/^error_?/, '')) || 'The authorisation did not complete.']);
      window.history.replaceState(null, '', '/dashboard/instagram');
    }
  }, [load, notify]);

  const sync = async () => {
    setBusy('sync');
    const res = await fetch('/api/admin/canva/templates/sync', { method: 'POST' });
    const data = (await res.json()) as { matched?: number; found?: number; ignored?: string[]; error?: string };
    setBusy('');
    if (!res.ok) notify('Sync failed', [data.error ?? 'Unknown error']);
    else notify('Templates synced', [`${data.matched} of ${data.found} brand templates matched the naming rule.`, ...(data.ignored?.length ? [`Ignored: ${data.ignored.join(', ')}`] : [])]);
    await load();
  };

  const test = async (t: Template) => {
    setBusy(t.id);
    const res = await fetch('/api/admin/canva/templates/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id }) });
    const data = (await res.json()) as { url?: string; error?: string };
    setBusy('');
    if (!res.ok || !data.url) notify('Render failed', [data.error ?? 'Unknown error']);
    else setPreview({ title: t.title, url: data.url });
    await load();
  };

  const disconnect = async () => {
    setBusy('disconnect');
    await fetch('/api/admin/canva/disconnect', { method: 'POST' });
    setBusy('');
    await load();
  };

  if (!status) return null;
  const have = new Set(status.templates.map((t) => `${t.layout}-${t.format}`));
  const missing = EXPECTED.flatMap((l) => (['sq', 'st'] as const).filter((f) => !have.has(`${l}-${f}`)).map((f) => `${l} ${f === 'sq' ? 'square' : 'story'}`));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className={SECTION_TITLE}>Canva templates</span>
          {status.connected ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">Connected</span>
          ) : (
            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-500">{status.configured ? 'Not connected' : 'Add CANVA_CLIENT_ID / SECRET in Vercel'}</span>
          )}
          <span className="text-xs text-gray-500">{status.templates.length} of {EXPECTED.length * 2} templates</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {status.connected ? (
            <>
              <button type="button" className={BTN_SECONDARY} onClick={() => setOpen((o) => !o)}>{open ? 'Hide' : 'Show'} templates</button>
              <button type="button" className={BTN_PRIMARY} disabled={Boolean(busy)} onClick={sync}>{busy === 'sync' ? 'Syncing…' : 'Sync from Canva'}</button>
              <button type="button" className={BTN_DANGER} disabled={Boolean(busy)} onClick={disconnect}>Disconnect</button>
            </>
          ) : (
            <a href="/api/admin/canva/connect" className={`${BTN_PRIMARY} ${status.configured ? '' : 'pointer-events-none opacity-50'}`}>Connect Canva</a>
          )}
        </div>
      </div>

      {!status.connected && status.configured && (
        <div className="mt-3 break-words rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
          <div>Client ID the server will send: <code>{status.client_id}</code>{status.client_id_raw_length !== status.client_id.length ? <span className="ml-2 font-semibold text-amber-700">(the Vercel value had extra whitespace, now trimmed)</span> : null}</div>
          <div>Redirect URL to register in Canva: <code>{status.redirect_uri}</code></div>
          <div>Scopes to enable in Canva: <code>{status.scopes.join(' ')}</code></div>
        </div>
      )}

      {open && status.connected && (
        <div className="mt-4">
          {status.templates.length === 0 ? (
            <p className="text-sm text-gray-500">No templates yet. In Canva, publish each design as a brand template named <code>IG · 01 card · square</code> (see the spec), then click Sync.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {status.templates.map((t) => (
                <div key={t.id} className="rounded-lg border border-gray-200 p-3">
                  {(t.last_render_url || t.thumbnail_url) && (
                    <img src={t.last_render_url ?? t.thumbnail_url ?? ''} alt="" className={`mb-2 w-full rounded-md object-cover ${t.format === 'st' ? 'aspect-[9/16]' : 'aspect-square'}`} />
                  )}
                  <div className="text-sm font-semibold text-gray-900">{t.title}</div>
                  <div className="mt-1 text-xs text-gray-500">{Object.keys(t.fields).join(' · ') || 'no data fields'}</div>
                  <button type="button" className={`${BTN_SECONDARY} mt-2 w-full`} disabled={Boolean(busy)} onClick={() => test(t)}>
                    {busy === t.id ? 'Rendering…' : 'Test render'}
                  </button>
                </div>
              ))}
            </div>
          )}
          {missing.length > 0 && status.templates.length > 0 && <p className="mt-3 text-xs text-gray-500">Still missing: {missing.join(', ')}.</p>}
        </div>
      )}

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title ?? ''} width="max-w-2xl" footer={<button type="button" className={BTN_PRIMARY} onClick={() => setPreview(null)}>Close</button>}>
        {preview && <img src={preview.url} alt="" className="mx-auto max-h-[70vh] rounded-lg" />}
        <p className="mt-2 text-xs text-gray-500">Filled with sample copy and a sample photo. If the layout looks right, the template is ready for the studio.</p>
      </Modal>
    </div>
  );
}
