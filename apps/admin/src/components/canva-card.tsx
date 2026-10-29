'use client';

import { useCallback, useEffect, useState } from 'react';
import { Carousel } from '@/components/carousel';
import { Modal } from '@/components/modal';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/components/prospect-crm';
import { CATEGORIES } from '@/lib/ig/categories';

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

const EXPECTED = CATEGORIES.length * 2;

/** Compact Canva connection card; the template registry and test renders live in a dialog. */
export function CanvaCard({ notify }: { notify: (title: string, lines: string[]) => void }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<{ title: string; format: 'sq' | 'st'; sr: string | null; en: string | null } | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/canva/status');
    if (res.ok) setStatus((await res.json()) as Status);
  }, []);

  useEffect(() => {
    void load();
    const q = new URLSearchParams(window.location.search).get('canva');
    if (q === 'connected') {
      notify('Canva connected', ['Publish the category templates as brand templates, then Sync.']);
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
    const data = (await res.json()) as { matched?: number; found?: number; ignored?: string[]; removed?: string[]; duplicates?: string[]; error?: string };
    setBusy('');
    if (!res.ok) notify('Sync failed', [data.error ?? 'Unknown error']);
    else notify('Templates synced', [
      `${data.matched} of ${data.found} brand templates matched the naming rule.`,
      ...(data.duplicates?.length ? [`Published twice in Canva (the newest is used; delete the extra): ${data.duplicates.join(', ')}`] : []),
      ...(data.removed?.length ? [`Removed (no longer in Canva): ${data.removed.join(', ')}`] : []),
      ...(data.ignored?.length ? [`Ignored: ${data.ignored.join(', ')}`] : []),
    ]);
    await load();
  };

  /** Renders the Serbian and English versions (two requests, in parallel) and shows them as a carousel. */
  const test = async (t: Template) => {
    setBusy(t.id);
    const one = async (lang: 'sr' | 'en'): Promise<{ url: string | null; error: string | null }> => {
      const res = await fetch('/api/admin/canva/templates/test', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: t.id, lang }) });
      const data = (await res.json()) as { url?: string; error?: string };
      return res.ok && data.url ? { url: data.url, error: null } : { url: null, error: data.error ?? 'Unknown error' };
    };
    const [sr, en] = await Promise.all([one('sr'), one('en')]);
    setBusy('');
    const errors = [sr, en].flatMap((r, i) => (r.error ? [`${i === 0 ? 'SR' : 'EN'}: ${r.error}`] : []));
    if (errors.length === 2) notify('Render failed', errors);
    else {
      if (errors.length) notify('One render failed', errors);
      setPreview({ title: t.title, format: t.format, sr: sr.url, en: en.url });
    }
    await load();
  };

  const disconnect = async () => {
    setBusy('disconnect');
    await fetch('/api/admin/canva/disconnect', { method: 'POST' });
    setBusy('');
    await load();
  };

  if (!status) return <div className="h-[58px] rounded-xl border border-gray-200 bg-white" />;
  const have = new Set(status.templates.map((t) => `${t.layout}-${t.format}`));
  const missing = CATEGORIES.flatMap((c) => (['sq', 'st'] as const).filter((f) => !have.has(`${c.key}-${f}`)).map((f) => `${c.key} ${f === 'sq' ? 'square' : 'story'}`));
  const tone = !status.connected ? 'bg-gray-300' : missing.length ? 'bg-amber-500' : 'bg-emerald-500';
  const byCategory = CATEGORIES.map((c) => ({ c, sq: status.templates.find((t) => t.layout === c.key && t.format === 'sq') ?? null, st: status.templates.find((t) => t.layout === c.key && t.format === 'st') ?? null }));
  const legacy = status.templates.filter((t) => !CATEGORIES.some((c) => c.key === t.layout));

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-gray-900">Canva</span>
          <span className="text-xs text-gray-500">
            {status.connected ? `connected · ${Math.min(status.templates.length, EXPECTED)} of ${EXPECTED} templates${missing.length ? ` · ${missing.length} missing` : ''}` : status.configured ? 'not connected' : 'add CANVA_CLIENT_ID / SECRET in Vercel'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
        {status.connected ? (
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(true)}>Templates</button>
            <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={sync}>{busy === 'sync' ? '…' : 'Sync'}</button>
            <button type="button" className={BTN_DANGER} disabled={Boolean(busy)} onClick={disconnect}>Disconnect</button>
          </>
        ) : (
          <a href="/api/admin/canva/connect" className={`${BTN_PRIMARY} ${status.configured ? '' : 'pointer-events-none opacity-50'}`}>Connect</a>
        )}
      </div>

      {!status.connected && status.configured && (
        <Modal open={false} onClose={() => undefined} title=""><span /></Modal>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="Canva templates" width="max-w-4xl" footer={<button type="button" className={BTN_PRIMARY} onClick={() => setOpen(false)}>Close</button>}>
        {!status.connected && status.configured && (
          <div className="mb-3 break-words rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-600">
            <div>Client ID the server will send: <code>{status.client_id}</code></div>
            <div>Redirect URL to register in Canva: <code>{status.redirect_uri}</code></div>
            <div>Scopes to enable in Canva: <code>{status.scopes.join(' ')}</code></div>
          </div>
        )}
        <p className="mb-3 text-xs text-gray-500">One square and one story per business category, named <code>IG · NN category · square|story</code>. Test renders both languages with the longest copy the copywriter may write.</p>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {byCategory.map(({ c, sq, st }) => (
            <div key={c.key} className="flex flex-wrap items-center gap-2 px-3 py-2">
              <span className="w-8 text-xs text-gray-400">{String(c.order).padStart(2, '0')}</span>
              <span className="w-44 text-sm font-medium text-gray-900">{c.name.en}</span>
              {([['sq', sq, 'Square'], ['st', st, 'Story']] as const).map(([f, t, label]) => (
                <span key={f} className="flex items-center gap-1">
                  {t ? (
                    <button type="button" className={`${BTN_SECONDARY} py-1 text-xs`} disabled={Boolean(busy)} onClick={() => test(t)} title={`Test render ${t.title}`}>{busy === t.id ? 'Rendering…' : `Test ${label.toLowerCase()}`}</button>
                  ) : (
                    <span className="rounded-lg border border-dashed border-gray-200 px-2 py-1 text-xs text-gray-400">{label} missing</span>
                  )}
                </span>
              ))}
              {sq?.last_render_url && <img src={sq.last_render_url} alt="" className="ml-auto h-8 w-8 rounded object-cover" />}
            </div>
          ))}
          {legacy.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-gray-500">
              <span className="w-8 text-xs text-gray-400">—</span>
              <span className="w-44 text-sm">{t.title} <span className="text-xs text-gray-400">(legacy)</span></span>
              <button type="button" className={`${BTN_SECONDARY} py-1 text-xs`} disabled={Boolean(busy)} onClick={() => test(t)}>{busy === t.id ? 'Rendering…' : 'Test'}</button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title ?? ''} width={preview?.format === 'st' ? 'max-w-sm' : 'max-w-xl'} footer={<button type="button" className={BTN_PRIMARY} onClick={() => setPreview(null)}>Close</button>}>
        {preview && (
          <Carousel
            aspect={preview.format === 'st' ? 'aspect-[9/16]' : 'aspect-square'}
            slides={[{ url: preview.sr, label: 'Serbian · slide 1' }, { url: preview.en, label: 'English · slide 2' }]}
          />
        )}
        <p className="mt-2 text-xs text-gray-500">Swipe or use the arrows, as in the Instagram feed. Filled with the category eyebrow, the longest copy for this layout, and a matching photo.</p>
      </Modal>
    </div>
  );
}
