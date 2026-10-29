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
  const [preview, setPreview] = useState<{ title: string; format: 'sq' | 'st'; slides: { url: string | null; label: string }[]; note: string } | null>(null);

  /** Opens the template as published (and the last test render, when there is one) at full size. */
  const show = (t: Template) => setPreview({
    title: t.title,
    format: t.format,
    slides: [{ url: t.thumbnail_url, label: 'Template as published in Canva' }, ...(t.last_render_url ? [{ url: t.last_render_url, label: 'Last test render' }] : [])],
    note: t.last_render_url ? 'Swipe between the published template and the last test render.' : 'The template as published in Canva, before any copy is filled in. Test renders it with the longest copy.',
  });

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
      setPreview({ title: t.title, format: t.format, slides: [{ url: sr.url, label: 'Serbian · slide 1' }, { url: en.url, label: 'English · slide 2' }], note: 'Swipe or use the arrows, as in the Instagram feed. Filled with the category eyebrow, the longest copy for this layout, and a matching photo.' });
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
        <p className="mb-3 text-xs text-gray-500">One square and one story per business category, named <code>IG · NN category · square|story</code>. Click a thumbnail to see the template full size; Test renders both languages with the longest copy the copywriter may write.</p>
        <div className="divide-y divide-gray-100 rounded-lg border border-gray-200">
          {byCategory.map(({ c, sq, st }) => (
            <div key={c.key} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
              <span className="w-6 text-xs text-gray-400">{String(c.order).padStart(2, '0')}</span>
              <span className="w-40 text-sm font-medium text-gray-900 sm:w-44">{c.name.en}</span>
              <span className="flex items-center gap-2">
                {([['sq', sq, 'Square'], ['st', st, 'Story']] as const).map(([f, t, label]) => (
                  <span key={f} className="flex items-center gap-2">
                    <Thumb t={t} label={label} onClick={t ? () => show(t) : undefined} />
                    {t ? (
                      <button type="button" className={`${BTN_SECONDARY} py-1 text-xs`} disabled={Boolean(busy)} onClick={() => test(t)} title={`Test render ${t.title}`}>{busy === t.id ? 'Rendering…' : 'Test'}</button>
                    ) : (
                      <span className="text-xs text-gray-400">missing</span>
                    )}
                  </span>
                ))}
              </span>
            </div>
          ))}
          {legacy.map((t) => (
            <div key={t.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 text-gray-500">
              <span className="w-6 text-xs text-gray-400">—</span>
              <span className="w-40 text-sm sm:w-44">{t.title} <span className="text-xs text-gray-400">(legacy)</span></span>
              <Thumb t={t} label={t.format === 'st' ? 'Story' : 'Square'} onClick={() => show(t)} />
              <button type="button" className={`${BTN_SECONDARY} py-1 text-xs`} disabled={Boolean(busy)} onClick={() => test(t)}>{busy === t.id ? 'Rendering…' : 'Test'}</button>
            </div>
          ))}
        </div>
      </Modal>

      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title={preview?.title ?? ''} width={preview?.format === 'st' ? 'max-w-sm' : 'max-w-xl'} footer={<button type="button" className={BTN_PRIMARY} onClick={() => setPreview(null)}>Close</button>}>
        {preview && (
          <Carousel aspect={preview.format === 'st' ? 'aspect-[9/16]' : 'aspect-square'} slides={preview.slides} />
        )}
        <p className="mt-2 text-xs text-gray-500">{preview?.note}</p>
      </Modal>
    </div>
  );
}

/** Thumbnail of the template as published (falls back to the last test render); click to enlarge. */
function Thumb({ t, label, onClick }: { t: Template | null; label: string; onClick?: () => void }) {
  const size = label === 'Story' ? 'h-16 w-9' : 'h-16 w-16';
  const src = t?.thumbnail_url ?? t?.last_render_url ?? null;
  if (!t || !src) return <span className={`${size} flex items-center justify-center rounded-md border border-dashed border-gray-200 text-[10px] text-gray-400`} title={`${label} missing`}>{label === 'Story' ? 'St' : 'Sq'}</span>;
  return (
    <button type="button" onClick={onClick} className={`${size} overflow-hidden rounded-md border border-gray-200 bg-gray-100 transition hover:ring-2 hover:ring-indigo-300`} title={`${t.title} — click to enlarge`}>
      <img src={src} alt={t.title} className="h-full w-full object-cover" />
    </button>
  );
}
