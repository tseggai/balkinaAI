/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DECK_TEMPLATES,
  DECK_CSS,
  getTemplate,
  renderSlide,
  type DeckId,
  type FieldDef,
  type SlideRow,
} from '@/lib/deck';

const KEY_STORAGE = 'deck_upload_key';
const PREVIEW_W = 1280;
const PREVIEW_H = 800;

/* ------------------------------------------------------------------ */

function getStoredKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE) || '';
  } catch {
    return '';
  }
}

function ensureKey(): string | null {
  let k = getStoredKey();
  if (!k) {
    k = window.prompt('Deck editor key:') || '';
    if (!k) return null;
    try {
      localStorage.setItem(KEY_STORAGE, k);
    } catch { /* storage unavailable */ }
  }
  return k;
}

function dropKey() {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch { /* storage unavailable */ }
}

function blankFor(f: FieldDef): unknown {
  if (f.kind === 'bool') return false;
  if (f.kind === 'select') return f.options?.[0] ?? '';
  if (f.kind === 'lines') return [];
  if (f.kind === 'list') return [];
  return f.bilingual ? { en: '', sr: '' } : '';
}

function slideLabel(s: SlideRow): string {
  const c: any = s.content || {};
  const pick = (v: any): string => (v && typeof v === 'object' ? v.en || v.sr || '' : v ? String(v) : '');
  return (
    pick(c.title) ||
    (pick(c.title_pre) && `${pick(c.title_pre)} ${pick(c.title_em)}`) ||
    pick(c.eyebrow) ||
    pick(c.mark) ||
    s.template
  );
}

/* ------------------------------------------------------------------ */

export default function DeckAdmin({ deck }: { deck: DeckId }) {
  const templates = DECK_TEMPLATES[deck];
  const deckPath = deck === 'tenant' ? '/tenant-deck' : '/deck';
  const deckName = deck === 'tenant' ? 'Tenant deck' : 'White-label deck';

  const [slides, setSlides] = useState<SlideRow[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(null);
  const [dirty, setDirty] = useState(false);
  const [status, setStatus] = useState<string>('');
  const [addTpl, setAddTpl] = useState(templates[0]?.id ?? '');
  const [previewLang, setPreviewLang] = useState<'sr' | 'en'>('sr');
  const [scale, setScale] = useState(0.5);
  const [busyWell, setBusyWell] = useState<string | null>(null);

  const previewPaneRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadWellRef = useRef<string | null>(null);

  const selected = useMemo(() => slides?.find((s) => s.id === selId) ?? null, [slides, selId]);
  const tpl = selected ? getTemplate(deck, selected.template) : null;

  /* ---------- load ---------- */
  useEffect(() => {
    fetch(`/api/deck-slides?deck=${deck}`)
      .then((r) => r.json())
      .then((j) => {
        const list: SlideRow[] = j.slides || [];
        setSlides(list);
        const first = list[0];
        if (first) {
          setSelId(first.id);
          setDraft(JSON.parse(JSON.stringify(first.content || {})));
        }
      })
      .catch(() => setStatus('Failed to load slides'));
  }, [deck]);

  /* ---------- preview scale ---------- */
  useEffect(() => {
    const el = previewPaneRef.current;
    if (!el) return;
    const update = () => setScale(Math.min((el.clientWidth - 2) / PREVIEW_W, 0.75));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  /* ---------- debounced preview doc ---------- */
  const [previewDoc, setPreviewDoc] = useState('');
  useEffect(() => {
    if (!selected) {
      setPreviewDoc('');
      return;
    }
    const t = setTimeout(() => {
      const section = renderSlide(deck, { template: selected.template, content: draft || {} }).replace(
        'class="slide',
        'class="slide active'
      );
      const fonts =
        deck === 'tenant'
          ? '<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap" rel="stylesheet">'
          : '';
      const adminCss = `
        [data-slot]{outline:2px dashed rgba(64,132,255,.6);outline-offset:3px;cursor:pointer;}
        [data-slot]:hover{outline-color:#2f6bff;outline-style:solid;}
        .img-well:not(.has-media){display:flex!important;min-height:90px;align-items:center;justify-content:center;background:rgba(127,127,127,.15);}
        .img-well:not(.has-media)::before{content:attr(data-label);font:13px/1.4 system-ui,sans-serif;opacity:.85;padding:0 14px;text-align:center;letter-spacing:0;text-transform:none;font-style:normal;}
        .bgwell:not(.has-media)::before{content:"Click to add background " attr(data-label);position:absolute;top:12px;left:12px;font:12px system-ui,sans-serif;background:rgba(0,0,0,.55);color:#fff;padding:6px 10px;border-radius:8px;z-index:5;}
      `;
      setPreviewDoc(
        `<!doctype html><html lang="${deck === 'tenant' ? 'sr' : 'en'}"${deck === 'tenant' ? ` data-lang="${previewLang}"` : ''}><head><meta charset="utf-8">${fonts}</head><body><style>${DECK_CSS[deck]}</style><style>${adminCss}</style>${section}</body></html>`
      );
    }, 300);
    return () => clearTimeout(t);
  }, [deck, selected, draft, previewLang]);

  /* ---------- iframe well clicks ---------- */
  const wireWells = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.querySelectorAll('[data-slot]').forEach((el) => {
      (el as HTMLElement).onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadWellRef.current = el.getAttribute('data-slot');
        fileRef.current?.click();
      };
    });
    doc.querySelectorAll('a').forEach((a) => ((a as HTMLAnchorElement).onclick = (e) => e.preventDefault()));
  }, []);

  /* ---------- api helpers ---------- */
  async function authed(method: string, body: unknown): Promise<any | null> {
    const key = ensureKey();
    if (!key) return null;
    const r = await fetch('/api/deck-slides', {
      method,
      headers: { 'content-type': 'application/json', 'x-deck-key': key },
      body: JSON.stringify(body),
    });
    if (r.status === 401) {
      dropKey();
      alert('Editor key rejected — try the action again and re-enter the key.');
      return null;
    }
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      alert(j.error || 'Request failed');
      return null;
    }
    return j;
  }

  function select(s: SlideRow) {
    if (dirty && !confirm('Discard unsaved changes on the current slide?')) return;
    setSelId(s.id);
    setDraft(JSON.parse(JSON.stringify(s.content || {})));
    setDirty(false);
    setStatus('');
  }

  async function save(contentOverride?: any) {
    if (!selected) return;
    const content = contentOverride ?? draft;
    setStatus('Saving…');
    const j = await authed('PATCH', { id: selected.id, content });
    if (!j) {
      setStatus('Not saved');
      return;
    }
    setSlides((prev) => prev!.map((s) => (s.id === selected.id ? j.slide : s)));
    setDraft(JSON.parse(JSON.stringify(j.slide.content)));
    setDirty(false);
    setStatus('Saved ✓');
    setTimeout(() => setStatus(''), 1800);
  }

  async function addSlide() {
    const j = await authed('POST', { deck, template: addTpl, afterId: selId });
    if (!j) return;
    const list = await fetch(`/api/deck-slides?deck=${deck}`).then((r) => r.json());
    setSlides(list.slides);
    setSelId(j.slide.id);
    setDraft(JSON.parse(JSON.stringify(j.slide.content || {})));
    setDirty(false);
  }

  async function duplicateSlide() {
    if (!selected) return;
    const j = await authed('POST', { deck, template: selected.template, afterId: selected.id, content: draft });
    if (!j) return;
    const list = await fetch(`/api/deck-slides?deck=${deck}`).then((r) => r.json());
    setSlides(list.slides);
    setSelId(j.slide.id);
    setDraft(JSON.parse(JSON.stringify(j.slide.content || {})));
  }

  async function deleteSlide() {
    if (!selected || !slides) return;
    if (!confirm('Delete this slide? This cannot be undone.')) return;
    const j = await authed('DELETE', { id: selected.id });
    if (!j) return;
    const rest = slides.filter((s) => s.id !== selected.id);
    setSlides(rest);
    const first = rest[0];
    if (first) select(first);
    else {
      setSelId(null);
      setDraft(null);
    }
  }

  async function move(dir: -1 | 1) {
    if (!selected || !slides) return;
    const idx = slides.findIndex((s) => s.id === selected.id);
    const to = idx + dir;
    if (to < 0 || to >= slides.length) return;
    const next = swap(slides, idx, to);
    setSlides(next.map((s, i) => ({ ...s, position: i + 1 })));
    await authed('PUT', { deck, ids: next.map((s) => s.id) });
  }

  /* ---------- media upload ---------- */
  async function onFilePicked(f: File) {
    const well = uploadWellRef.current;
    if (!f || !well || !selected) return;
    const key = ensureKey();
    if (!key) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    setBusyWell(well);
    try {
      const r = await fetch('/api/deck-assets', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-deck-key': key },
        body: JSON.stringify({ deck, slot: `s-${selected.id}-${well}`, ext }),
      });
      if (r.status === 401) {
        dropKey();
        alert('Editor key rejected — try again.');
        return;
      }
      const j = await r.json();
      if (!r.ok) {
        alert(j.error || 'Upload refused');
        return;
      }
      const up = await fetch(j.signedUrl, {
        method: 'PUT',
        headers: { 'content-type': f.type || 'application/octet-stream', 'x-upsert': 'true' },
        body: f,
      });
      if (!up.ok) {
        alert(`Storage upload failed (${up.status})`);
        return;
      }
      const nextDraft = { ...draft, media: { ...(draft?.media || {}), [well]: j.publicUrl } };
      setDraft(nextDraft);
      await save(nextDraft);
    } finally {
      setBusyWell(null);
    }
  }

  async function removeMedia(well: string) {
    if (!draft?.media?.[well]) return;
    const media = { ...(draft.media || {}) };
    delete media[well];
    const nextDraft = { ...draft, media };
    setDraft(nextDraft);
    await save(nextDraft);
  }

  /* ---------- field editor ---------- */
  function setField(key: string, value: unknown) {
    setDraft((d: any) => ({ ...d, [key]: value }));
    setDirty(true);
  }

  function BiInput({ value, onChange, area }: { value: any; onChange: (v: any) => void; area?: boolean }) {
    const v = value && typeof value === 'object' ? value : { en: String(value ?? ''), sr: String(value ?? '') };
    const Tag = (area ? 'textarea' : 'input') as any;
    return (
      <div className="grid grid-cols-2 gap-2">
        {(['en', 'sr'] as const).map((lang) => (
          <div key={lang}>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{lang}</span>
            <Tag
              className="mt-0.5 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
              rows={area ? 3 : undefined}
              value={v[lang] ?? ''}
              onChange={(e: any) => onChange({ ...v, [lang]: e.target.value })}
            />
          </div>
        ))}
      </div>
    );
  }

  function PlainInput({ value, onChange, area }: { value: any; onChange: (v: string) => void; area?: boolean }) {
    const Tag = (area ? 'textarea' : 'input') as any;
    return (
      <Tag
        className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
        rows={area ? 3 : undefined}
        value={String(value ?? '')}
        onChange={(e: any) => onChange(e.target.value)}
      />
    );
  }

  function FieldControl({ field, value, onChange }: { field: FieldDef; value: any; onChange: (v: any) => void }) {
    if (field.kind === 'bool') {
      return (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
          Enabled
        </label>
      );
    }
    if (field.kind === 'select') {
      return (
        <select
          className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
          value={String(value ?? field.options?.[0] ?? '')}
          onChange={(e) => onChange(e.target.value)}
        >
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    if (field.kind === 'lines') {
      return (
        <textarea
          className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm focus:border-blue-500 focus:outline-none"
          rows={3}
          value={Array.isArray(value) ? value.join('\n') : String(value ?? '')}
          onChange={(e) => onChange(e.target.value.split('\n'))}
        />
      );
    }
    if (field.kind === 'list') {
      const items: any[] = Array.isArray(value) ? value : [];
      const blankItem = () => Object.fromEntries((field.item || []).map((sf) => [sf.key, blankFor(sf)]));
      const setItem = (i: number, next: any) => onChange(items.map((it, k) => (k === i ? next : it)));
      return (
        <div className="space-y-2">
          {items.map((it, i) => (
            <div key={i} className="rounded-lg border border-gray-200 bg-gray-50 p-2">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-[11px] font-bold text-gray-400">#{i + 1}</span>
                <span className="flex gap-1">
                  <button className="btn-mini" disabled={i === 0} onClick={() => onChange(swap(items, i, i - 1))}>↑</button>
                  <button className="btn-mini" disabled={i === items.length - 1} onClick={() => onChange(swap(items, i, i + 1))}>↓</button>
                  <button className="btn-mini text-red-600" onClick={() => onChange(items.filter((_, k) => k !== i))}>✕</button>
                </span>
              </div>
              <div className="space-y-2">
                {(field.item || []).map((sf) => (
                  <div key={sf.key}>
                    <label className="text-[11px] font-semibold text-gray-500">{sf.label}</label>
                    <FieldControl field={sf} value={it?.[sf.key]} onChange={(v) => setItem(i, { ...it, [sf.key]: v })} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <button
            className="rounded-md border border-dashed border-gray-400 px-3 py-1 text-xs font-semibold text-gray-500 hover:border-blue-500 hover:text-blue-600"
            onClick={() => onChange([...items, blankItem()])}
          >
            + Add item
          </button>
        </div>
      );
    }
    // text / area
    if (field.bilingual) return <BiInput value={value} onChange={onChange} area={field.kind === 'area'} />;
    return <PlainInput value={value} onChange={onChange} area={field.kind === 'area'} />;
  }

  /* ---------- render ---------- */
  if (!slides) {
    return <div className="flex h-screen items-center justify-center text-gray-400">Loading deck…</div>;
  }

  return (
    <div className="flex h-screen flex-col bg-gray-100 text-gray-900">
      <style>{`.btn-mini{border:1px solid #d1d5db;border-radius:6px;background:#fff;font-size:11px;line-height:1;padding:4px 7px;cursor:pointer}.btn-mini:disabled{opacity:.35;cursor:default}`}</style>
      {/* top bar */}
      <header className="flex items-center justify-between border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold">{deckName} — Slide Editor</span>
          <a className="text-xs font-semibold text-blue-600 hover:underline" href={deckPath} target="_blank" rel="noopener">
            Open deck ↗
          </a>
        </div>
        <div className="flex items-center gap-3">
          {deck === 'tenant' && (
            <div className="flex overflow-hidden rounded-full border border-gray-300 text-[11px] font-bold">
              {(['sr', 'en'] as const).map((l) => (
                <button
                  key={l}
                  className={`px-3 py-1 uppercase ${previewLang === l ? 'bg-gray-900 text-white' : 'bg-white text-gray-500'}`}
                  onClick={() => setPreviewLang(l)}
                >
                  {l === 'sr' ? 'CG' : 'EN'}
                </button>
              ))}
            </div>
          )}
          <span className="w-20 text-right text-xs text-gray-500">{status}</span>
          <button
            className={`rounded-full px-4 py-1.5 text-xs font-bold ${dirty ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-400'}`}
            disabled={!dirty}
            onClick={() => save()}
          >
            Save slide
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* left: slide list */}
        <aside className="flex w-64 shrink-0 flex-col border-r border-gray-200 bg-white">
          <div className="min-h-0 flex-1 overflow-y-auto p-2">
            {slides.map((s, i) => (
              <button
                key={s.id}
                onClick={() => select(s)}
                className={`mb-1 block w-full rounded-lg border px-3 py-2 text-left ${
                  s.id === selId ? 'border-blue-500 bg-blue-50' : 'border-transparent hover:bg-gray-50'
                }`}
              >
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                  {i + 1} · {getTemplate(deck, s.template)?.name ?? s.template}
                </div>
                <div className="truncate text-xs font-semibold text-gray-800">{slideLabel(s)}</div>
              </button>
            ))}
          </div>
          <div className="space-y-2 border-t border-gray-200 p-2">
            <div className="flex gap-1">
              <button className="btn-mini flex-1" onClick={() => move(-1)}>Move ↑</button>
              <button className="btn-mini flex-1" onClick={() => move(1)}>Move ↓</button>
              <button className="btn-mini flex-1" onClick={duplicateSlide}>Duplicate</button>
              <button className="btn-mini flex-1 text-red-600" onClick={deleteSlide}>Delete</button>
            </div>
            <div className="flex gap-1">
              <select className="min-w-0 flex-1 rounded-md border border-gray-300 px-1.5 py-1 text-xs" value={addTpl} onChange={(e) => setAddTpl(e.target.value)}>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
              <button className="rounded-md bg-gray-900 px-3 py-1 text-xs font-bold text-white hover:bg-black" onClick={addSlide}>
                + Add
              </button>
            </div>
          </div>
        </aside>

        {/* right: preview + form */}
        <main className="min-w-0 flex-1 overflow-y-auto p-4">
          {selected && tpl ? (
            <>
              <div ref={previewPaneRef} className="overflow-hidden rounded-xl border border-gray-300 bg-gray-800 shadow-sm" style={{ height: PREVIEW_H * scale + 2 }}>
                <iframe
                  ref={iframeRef}
                  title="Slide preview"
                  srcDoc={previewDoc}
                  onLoad={wireWells}
                  style={{ width: PREVIEW_W, height: PREVIEW_H, border: 0, transform: `scale(${scale})`, transformOrigin: 'top left' }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-gray-400">
                Click any dashed area in the preview to upload an image or a short MP4/WebM loop for it.
              </p>

              {/* image wells */}
              {tpl.wells.length > 0 && (
                <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
                  <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">Images on this slide</h3>
                  <div className="space-y-1.5">
                    {tpl.wells.map((w) => {
                      const url = draft?.media?.[w.name];
                      return (
                        <div key={w.name} className="flex items-center gap-2 text-sm">
                          <span className={`h-2 w-2 shrink-0 rounded-full ${url ? 'bg-green-500' : 'bg-gray-300'}`} />
                          <span className="min-w-0 flex-1 truncate text-gray-600">{w.label}</span>
                          {busyWell === w.name ? (
                            <span className="text-xs text-gray-400">Uploading…</span>
                          ) : (
                            <>
                              <button
                                className="btn-mini"
                                onClick={() => {
                                  uploadWellRef.current = w.name;
                                  fileRef.current?.click();
                                }}
                              >
                                {url ? 'Replace' : 'Upload'}
                              </button>
                              {url && (
                                <button className="btn-mini text-red-600" onClick={() => removeMedia(w.name)}>
                                  Remove
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}

              {/* text fields */}
              <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-400">
                  Slide text — {tpl.name}
                </h3>
                <div className="space-y-3">
                  {tpl.fields.map((f) => (
                    <div key={f.key}>
                      <label className="text-xs font-semibold text-gray-600">{f.label}</label>
                      <div className="mt-1">
                        <FieldControl field={f} value={draft?.[f.key]} onChange={(v) => setField(f.key, v)} />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">Add a slide to begin.</div>
          )}
        </main>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) void onFilePicked(f);
        }}
      />
    </div>
  );
}

function swap<T>(arr: T[], a: number, b: number): T[] {
  const next = [...arr];
  const va = next[a] as T;
  next[a] = next[b] as T;
  next[b] = va;
  return next;
}
