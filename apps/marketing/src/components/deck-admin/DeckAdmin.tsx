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
  type TemplateDef,
} from '@/lib/deck';
import { STARTERS } from '@/lib/deck/starters';

const KEY_STORAGE = 'deck_upload_key';
const DESKTOP = { w: 1280, h: 800 };
const PHONE = { w: 390, h: 760 };
type Lang = 'en' | 'sr';
const LANG_LABEL: Record<Lang, string> = { en: 'EN', sr: 'CG' };
const ACCENT = '#F5A623';

/* ------------------------------------------------------------------ */
/* helpers                                                             */
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
    } catch {
      /* storage unavailable */
    }
  }
  return k;
}
function dropKey() {
  try {
    localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* storage unavailable */
  }
}

function blankFor(f: FieldDef): unknown {
  if (f.kind === 'bool') return false;
  if (f.kind === 'select') return f.options?.[0] ?? '';
  if (f.kind === 'lines') return f.bilingual ? { en: [], sr: [] } : [];
  if (f.kind === 'list') return [];
  return f.bilingual ? { en: '', sr: '' } : '';
}
function blankItem(f: FieldDef): Record<string, unknown> {
  return Object.fromEntries((f.item || []).map((sf) => [sf.key, blankFor(sf)]));
}
function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}
function pickText(v: any): string {
  return v && typeof v === 'object' ? v.en || v.sr || '' : v ? String(v) : '';
}
function slideLabel(s: SlideRow): string {
  const c: any = s.content || {};
  return (
    pickText(c.title) ||
    (pickText(c.title_pre) && `${pickText(c.title_pre)} ${pickText(c.title_em)}`) ||
    pickText(c.eyebrow) ||
    pickText(c.mark) ||
    pickText(c.chapter) ||
    s.template
  ).replace(/\n/g, ' ');
}
function singular(f: FieldDef): string {
  return f.itemLabel || 'item';
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
function shortLabel(f: FieldDef): string {
  return f.label.replace(/\s*\(.*\)$/, '');
}
/** Bilingual text value → { en, sr } (plain strings apply to both). */
function biText(v: any): { en: string; sr: string } {
  if (v && typeof v === 'object' && !Array.isArray(v)) return { en: String(v.en ?? ''), sr: String(v.sr ?? '') };
  return { en: String(v ?? ''), sr: String(v ?? '') };
}
/** Bilingual lines value → { en: string[], sr: string[] } (legacy arrays apply to both). */
function biLinesVal(v: any): { en: string[]; sr: string[] } {
  if (Array.isArray(v)) return { en: v.map(String), sr: v.map(String) };
  if (v && typeof v === 'object') return { en: Array.isArray(v.en) ? v.en : [], sr: Array.isArray(v.sr) ? v.sr : [] };
  return { en: [], sr: [] };
}

/** Convert content when switching a slide to another template: keep fields that exist with the same shape. */
function convertContent(from: TemplateDef | undefined, to: TemplateDef, content: any): any {
  const next: any = { ...clone(to.blank), media: content?.media || {}, labels: content?.labels || {} };
  for (const f of to.fields) {
    const v = content?.[f.key];
    if (v === undefined) continue;
    const src = from?.fields.find((x) => x.key === f.key);
    if (!src || src.kind === f.kind) next[f.key] = clone(v);
  }
  return next;
}

/** What the drawer is editing: a top-level field, one item of a list field, or an image well. */
interface Target {
  key?: string;
  index?: number;
  well?: string;
  hideable?: boolean;
}
function parseFieldTarget(path: string): Target {
  const dot = path.indexOf('.');
  if (dot < 0) return { key: path };
  return { key: path.slice(0, dot), index: parseInt(path.slice(dot + 1), 10) };
}
function targetSelector(t: Target | null): string | null {
  if (!t) return null;
  if (t.well) return `[data-slot="${t.well}"]`;
  return `[data-edit="${t.index !== undefined ? `${t.key}.${t.index}` : t.key}"]`;
}

/* ------------------------------------------------------------------ */

export default function DeckAdmin({ deck }: { deck: DeckId }) {
  const templates = DECK_TEMPLATES[deck];
  const starters = STARTERS[deck];
  const deckPath = deck === 'tenant' ? '/tenant-deck' : '/deck';
  const deckName = deck === 'tenant' ? 'Tenant deck' : 'White-label deck';
  const defaultLang: Lang = deck === 'tenant' ? 'sr' : 'en';

  const [slides, setSlides] = useState<SlideRow[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<any>(null);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [addTpl, setAddTpl] = useState(templates[0]?.id ?? '');
  const [previewLang, setPreviewLang] = useState<Lang>(defaultLang);
  const [writingLang, setWritingLang] = useState<Lang>('en');
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [scale, setScale] = useState(0.5);
  const [target, setTarget] = useState<Target | null>(null);
  const [translating, setTranslating] = useState(false);
  const [uploading, setUploading] = useState(false);

  const previewPaneRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadWellRef = useRef<string | null>(null);
  const draftRef = useRef<any>(null);
  const dirtyRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selected = useMemo(() => slides?.find((s) => s.id === selId) ?? null, [slides, selId]);
  const tpl = selected ? getTemplate(deck, selected.template) : undefined;
  const otherLang: Lang = writingLang === 'en' ? 'sr' : 'en';
  const frame = device === 'desktop' ? DESKTOP : PHONE;
  const starterOptions = useMemo(() => (tpl ? starters.filter((s) => s.template === tpl.id) : []), [starters, tpl]);

  /* ---------- draft plumbing (dirty → autosave) ---------- */
  function setDraft(next: any, dirty = true) {
    draftRef.current = next;
    setDraftState(next);
    if (dirty) {
      dirtyRef.current = true;
      setSaveState('dirty');
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => void save(), 900);
    }
  }
  function updateDraft(mutate: (d: any) => void) {
    const next = clone(draftRef.current || {});
    mutate(next);
    setDraft(next);
  }

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
          setDraft(clone(first.content || {}), false);
        }
      })
      .catch(() => setSaveState('error'));
  }, [deck]);

  /* ---------- preview scale ---------- */
  useEffect(() => {
    const el = previewPaneRef.current;
    if (!el) return;
    const update = () =>
      setScale(device === 'desktop' ? Math.min((el.clientWidth - 2) / DESKTOP.w, 1) : Math.min((el.clientWidth - 2) / PHONE.w, 1));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [device]);

  /* ---------- preview document (debounced) ---------- */
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
      const sel = targetSelector(target);
      const adminCss = `
        [data-edit]{cursor:pointer;border-radius:4px;}
        [data-edit]:hover{outline:1.5px dashed rgba(255,255,255,.55);outline-offset:5px;}
        [data-slot]{cursor:pointer;}
        [data-slot]:hover{outline:2px dashed ${ACCENT};outline-offset:6px;}
        ${sel ? `${sel}{outline:2px solid ${ACCENT}!important;outline-offset:6px;}` : ''}
        .img-well:not(.has-media){display:flex!important;min-height:120px;align-items:center;justify-content:center;border:2px dashed rgba(255,255,255,.35);border-radius:14px;}
        .img-well:not(.has-media)::before{content:"+ " attr(data-label);font:14px/1.4 system-ui,sans-serif;color:rgba(255,255,255,.7);padding:0 16px;text-align:center;letter-spacing:0;text-transform:none;font-style:normal;}
        .bgwell:not(.has-media)::before{content:"+ background photo";position:absolute;top:14px;left:14px;font:12px system-ui,sans-serif;border:1.5px dashed rgba(255,255,255,.45);color:rgba(255,255,255,.75);padding:7px 14px;border-radius:999px;z-index:5;}
        .da-chip{display:block;width:100%;box-sizing:border-box;list-style:none;margin:14px 0 0;padding:9px 16px;border:1.5px dashed rgba(255,255,255,.35);border-radius:12px;font:13px system-ui,sans-serif;color:rgba(255,255,255,.65);cursor:pointer;background:none;letter-spacing:0;text-transform:none;font-style:normal;text-align:left;}
        .da-chip.small{display:inline-block;width:auto;border-radius:999px;margin-right:8px;}
        .da-chip::before{display:none!important;}
        .da-chip:hover{border-color:${ACCENT};color:#fff;}
      `;
      setPreviewDoc(
        `<!doctype html><html lang="${previewLang === 'sr' ? 'sr' : 'en'}" data-lang="${previewLang}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${fonts}</head><body><style>${DECK_CSS[deck]}</style><style>${adminCss}</style>${section}</body></html>`
      );
    }, 250);
    return () => clearTimeout(t);
  }, [deck, selected, draft, previewLang, target]);

  /* ---------- wire clicks + "add" chips inside the preview ---------- */
  const wirePreview = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !tpl) return;
    doc.querySelectorAll('a').forEach((a) => ((a as HTMLAnchorElement).onclick = (e) => e.preventDefault()));
    doc.querySelectorAll('[data-slot]').forEach((el) => {
      (el as HTMLElement).onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const hideable = el.classList.contains('img-well') || el.classList.contains('bgwell');
        setTarget({ well: el.getAttribute('data-slot') || undefined, hideable });
      };
    });
    doc.querySelectorAll('[data-edit]').forEach((el) => {
      (el as HTMLElement).onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setTarget(parseFieldTarget(el.getAttribute('data-edit') || ''));
      };
    });
    const inner = doc.querySelector('.inner');
    const chip = (text: string, small: boolean, onClick: () => void) => {
      const el = doc.createElement('div');
      el.className = small ? 'da-chip small' : 'da-chip';
      el.textContent = text;
      el.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      };
      return el;
    };
    for (const f of tpl.fields) {
      if (f.kind === 'list') {
        const items = doc.querySelectorAll(`[data-edit^="${f.key}."]`);
        const last = items[items.length - 1] as HTMLElement | undefined;
        const c = chip(`+ ${singular(f)}`, false, () => addListItem(f));
        if (last?.tagName === 'LI') {
          const li = doc.createElement('li');
          li.className = 'da-chip';
          li.textContent = c.textContent;
          li.onclick = c.onclick;
          last.parentNode?.insertBefore(li, last.nextSibling);
        } else if (last?.parentNode) last.parentNode.insertBefore(c, last.nextSibling);
        else inner?.appendChild(c);
      } else if (f.optional && !doc.querySelector(`[data-edit="${f.key}"]`)) {
        inner?.appendChild(chip(`+ ${shortLabel(f).toLowerCase()}`, true, () => setTarget({ key: f.key })));
      }
    }
    for (const w of tpl.wells) {
      if (draftRef.current?.hidden_wells?.[w.name]) {
        inner?.appendChild(
          chip(`+ ${(String(draftRef.current?.labels?.[w.name] || w.label).split(':')[0] ?? '').toLowerCase()}`, true, () => {
            updateDraft((d) => {
              if (d.hidden_wells) delete d.hidden_wells[w.name];
            });
            setTarget({ well: w.name, hideable: true });
          })
        );
      }
    }
  }, [tpl]);

  /* ---------- api ---------- */
  async function authed(method: string, body: unknown, url = '/api/deck-slides'): Promise<any | null> {
    const key = ensureKey();
    if (!key) return null;
    const r = await fetch(url, {
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
  async function refetch(selectId?: string) {
    const j = await fetch(`/api/deck-slides?deck=${deck}`).then((r) => r.json());
    const list: SlideRow[] = j.slides || [];
    setSlides(list);
    const pick = list.find((s) => s.id === (selectId ?? selId)) ?? list[0];
    if (pick) {
      setSelId(pick.id);
      setDraft(clone(pick.content || {}), false);
    } else {
      setSelId(null);
      setDraft(null, false);
    }
    setTarget(null);
  }

  async function save(): Promise<boolean> {
    if (!selId || !dirtyRef.current) return true;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    setSaveState('saving');
    const content = draftRef.current;
    const j = await authed('PATCH', { id: selId, content });
    if (!j) {
      setSaveState('error');
      return false;
    }
    dirtyRef.current = draftRef.current !== content;
    setSlides((prev) => (prev ? prev.map((s) => (s.id === selId ? j.slide : s)) : prev));
    setSaveState(dirtyRef.current ? 'dirty' : 'saved');
    if (dirtyRef.current) saveTimer.current = setTimeout(() => void save(), 900);
    return true;
  }

  async function select(s: SlideRow) {
    if (s.id === selId) return;
    if (dirtyRef.current) await save();
    setSelId(s.id);
    setDraft(clone(s.content || {}), false);
    setTarget(null);
    setSaveState('saved');
  }
  async function addSlide() {
    if (dirtyRef.current) await save();
    const j = await authed('POST', { deck, template: addTpl, afterId: selId });
    if (j) await refetch(j.slide.id);
  }
  async function duplicateSlide() {
    if (!selected) return;
    if (dirtyRef.current) await save();
    const j = await authed('POST', { deck, template: selected.template, afterId: selected.id, content: draftRef.current });
    if (j) await refetch(j.slide.id);
  }
  async function deleteSlide(s: SlideRow) {
    if (!slides) return;
    if (!confirm(`Delete slide "${slideLabel(s)}"? This cannot be undone.`)) return;
    const j = await authed('DELETE', { id: s.id });
    if (!j) return;
    const rest = slides.filter((x) => x.id !== s.id);
    setSlides(rest);
    if (s.id === selId) {
      dirtyRef.current = false;
      const next = rest[0];
      setSelId(next?.id ?? null);
      setDraft(next ? clone(next.content || {}) : null, false);
      setTarget(null);
      setSaveState('saved');
    }
  }
  async function move(s: SlideRow, dir: -1 | 1) {
    if (!slides) return;
    const idx = slides.findIndex((x) => x.id === s.id);
    const to = idx + dir;
    if (idx < 0 || to < 0 || to >= slides.length) return;
    const next = [...slides];
    const a = next[idx] as SlideRow;
    next[idx] = next[to] as SlideRow;
    next[to] = a;
    setSlides(next.map((x, i) => ({ ...x, position: i + 1 })));
    await authed('PUT', { deck, ids: next.map((x) => x.id) });
  }
  async function toggleVisible(s: SlideRow) {
    const visible = s.visible === false;
    setSlides((prev) => (prev ? prev.map((x) => (x.id === s.id ? { ...x, visible } : x)) : prev));
    await authed('PATCH', { id: s.id, visible });
  }
  async function switchTemplate(nextId: string) {
    if (!selected || nextId === selected.template) return;
    const to = getTemplate(deck, nextId);
    if (!to) return;
    if (!confirm(`Convert this slide to "${to.name}"? Matching text is kept; the rest starts blank.`)) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    dirtyRef.current = false;
    const content = convertContent(tpl, to, draftRef.current);
    const j = await authed('PATCH', { id: selected.id, deck, template: to.id, content });
    if (!j) return;
    setSlides((prev) => (prev ? prev.map((s) => (s.id === selected.id ? j.slide : s)) : prev));
    setDraft(clone(j.slide.content), false);
    setTarget(null);
    setSaveState('saved');
  }
  function restoreStarter(idx: number) {
    const st = starterOptions[idx];
    if (!st) return;
    if (!confirm(`Replace this slide's text with the starter "${st.label}"? Images stay.`)) return;
    updateDraft((d) => {
      const keep = { media: d.media, labels: d.labels, hidden_wells: d.hidden_wells };
      for (const k of Object.keys(d)) delete d[k];
      Object.assign(d, clone(st.content), keep);
    });
    setTarget(null);
  }

  /* ---------- list items ---------- */
  function addListItem(f: FieldDef, afterIndex?: number) {
    let newIndex = 0;
    updateDraft((d) => {
      const arr: any[] = Array.isArray(d[f.key]) ? d[f.key] : [];
      newIndex = afterIndex === undefined ? arr.length : afterIndex + 1;
      arr.splice(newIndex, 0, blankItem(f));
      d[f.key] = arr;
    });
    setTarget({ key: f.key, index: newIndex });
  }
  function moveListItem(key: string, index: number, dir: -1 | 1) {
    const to = index + dir;
    updateDraft((d) => {
      const arr: any[] = d[key] || [];
      if (to < 0 || to >= arr.length) return;
      const a = arr[index];
      arr[index] = arr[to];
      arr[to] = a;
    });
    setTarget({ key, index: to });
  }
  function deleteListItem(key: string, index: number) {
    updateDraft((d) => {
      (d[key] || []).splice(index, 1);
    });
    setTarget(null);
  }

  /* ---------- translation ---------- */
  type Slot = { get: (d: any) => string; set: (d: any, v: string) => void };
  function slotsFor(f: FieldDef, base: (d: any) => any, ensure: (d: any) => any, out: Slot[]) {
    if (!f.bilingual || f.kind === 'list' || f.kind === 'bool' || f.kind === 'select') return;
    if (f.kind === 'lines') {
      out.push({
        get: (d) => biLinesVal(base(d)?.[f.key])[writingLang].join('\n'),
        set: (d, v) => {
          const o = ensure(d);
          o[f.key] = { ...biLinesVal(o[f.key]), [otherLang]: v.split('\n').filter((s) => s.length) };
        },
      });
      return;
    }
    out.push({
      get: (d) => biText(base(d)?.[f.key])[writingLang],
      set: (d, v) => {
        const o = ensure(d);
        o[f.key] = { ...biText(o[f.key]), [otherLang]: v };
      },
    });
  }
  function bilingualSlots(scope: 'slide' | Target): Slot[] {
    if (!tpl) return [];
    const out: Slot[] = [];
    const listItem = (f: FieldDef, i: number) =>
      (f.item || []).forEach((sf) =>
        slotsFor(
          sf,
          (d) => d?.[f.key]?.[i],
          (d) => {
            d[f.key] = d[f.key] || [];
            d[f.key][i] = d[f.key][i] || {};
            return d[f.key][i];
          },
          out
        )
      );
    const top = (f: FieldDef) =>
      slotsFor(
        f,
        (d) => d,
        (d) => d,
        out
      );
    if (scope === 'slide') {
      for (const f of tpl.fields) {
        if (f.kind === 'list') (draftRef.current?.[f.key] || []).forEach((_: any, i: number) => listItem(f, i));
        else top(f);
      }
    } else if (scope.key) {
      const f = tpl.fields.find((x) => x.key === scope.key);
      if (!f) return [];
      if (scope.index !== undefined) listItem(f, scope.index);
      else top(f);
    }
    return out;
  }
  async function translate(scope: 'slide' | Target) {
    const slots = bilingualSlots(scope);
    const texts = slots.map((s) => s.get(draftRef.current));
    if (!texts.some((t) => t.trim())) return;
    setTranslating(true);
    try {
      const j = await authed('POST', { texts, from: writingLang, to: otherLang }, '/api/deck-translate');
      if (!j) return;
      updateDraft((d) => slots.forEach((s, i) => s.set(d, String(j.texts?.[i] ?? ''))));
    } finally {
      setTranslating(false);
    }
  }

  /* ---------- media ---------- */
  async function onFilePicked(f: File) {
    const well = uploadWellRef.current;
    if (!f || !well || !selected) return;
    const key = ensureKey();
    if (!key) return;
    const ext = (f.name.split('.').pop() || '').toLowerCase();
    setUploading(true);
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
      updateDraft((d) => {
        d.media = { ...(d.media || {}), [well]: j.publicUrl };
      });
    } finally {
      setUploading(false);
    }
  }

  /* ---------- drawer controls (plain render fns so inputs keep focus) ---------- */
  const inputCls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-snug focus:border-gray-900 focus:outline-none';

  function renderBiRows(rows: { lang: Lang; value: string; onChange: (v: string) => void }[], area: boolean) {
    return (
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.lang} className="grid grid-cols-[34px_1fr] items-start gap-2">
            <span className={`pt-2 text-[11px] font-bold ${r.lang === writingLang ? 'text-amber-600' : 'text-gray-400'}`}>{LANG_LABEL[r.lang]}</span>
            {area ? (
              <textarea className={inputCls} rows={3} value={r.value} onChange={(e) => r.onChange(e.target.value)} />
            ) : (
              <input className={inputCls} value={r.value} onChange={(e) => r.onChange(e.target.value)} />
            )}
          </div>
        ))}
      </div>
    );
  }

  function renderControl(field: FieldDef, value: any, onChange: (v: any) => void) {
    const order: Lang[] = writingLang === 'en' ? ['en', 'sr'] : ['sr', 'en'];
    if (field.kind === 'bool') {
      return (
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /> {field.label}
        </label>
      );
    }
    if (field.kind === 'select') {
      return (
        <select className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm" value={String(value ?? field.options?.[0] ?? '')} onChange={(e) => onChange(e.target.value)}>
          {(field.options || []).map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
      );
    }
    if (field.kind === 'lines') {
      if (field.bilingual) {
        const v = biLinesVal(value);
        return renderBiRows(
          order.map((lang) => ({
            lang,
            value: v[lang].join('\n'),
            onChange: (s) => onChange({ ...v, [lang]: s.split('\n') }),
          })),
          true
        );
      }
      return (
        <textarea className={inputCls} rows={4} value={Array.isArray(value) ? value.join('\n') : String(value ?? '')} onChange={(e) => onChange(e.target.value.split('\n'))} />
      );
    }
    const area = field.kind === 'area';
    if (field.bilingual) {
      const v = biText(value);
      return renderBiRows(
        order.map((lang) => ({ lang, value: v[lang], onChange: (s) => onChange({ ...v, [lang]: s }) })),
        area
      );
    }
    return area ? (
      <textarea className={inputCls} rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <input className={inputCls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    );
  }

  function renderSaveStatus() {
    const text =
      saveState === 'saving' ? 'Saving…' : saveState === 'dirty' ? 'Unsaved changes' : saveState === 'error' ? 'Not saved — retry' : 'All changes saved';
    return <span className={`text-sm ${saveState === 'error' ? 'text-red-600' : 'text-gray-500'}`}>{text}</span>;
  }
  function renderSaveButton() {
    const active = saveState === 'dirty' || saveState === 'error';
    return (
      <button
        className={`rounded-xl px-5 py-2.5 text-sm font-semibold ${active ? 'bg-gray-800 text-white hover:bg-gray-900' : 'bg-gray-200 text-gray-400'}`}
        disabled={!active}
        onClick={() => void save()}
      >
        Save slide
      </button>
    );
  }

  function renderDrawerBody() {
    if (!target || !tpl || !draft) return null;

    // ----- image well -----
    if (target.well) {
      const w = tpl.wells.find((x) => x.name === target.well);
      if (!w) return null;
      const url: string | undefined = draft.media?.[w.name];
      const isVideo = !!url && /\.(mp4|webm)(\?|$)/i.test(url);
      const customLabel = String(draft.labels?.[w.name] ?? '');
      return (
        <>
          <div className="flex min-h-[220px] items-center justify-center overflow-hidden rounded-2xl border border-gray-200 bg-gray-50 p-3">
            {url ? (
              isVideo ? (
                <video src={url} className="max-h-[320px] w-full rounded-lg object-contain" autoPlay muted loop playsInline />
              ) : (
                <img src={url} alt="" className="max-h-[320px] w-full rounded-lg object-contain" />
              )
            ) : (
              <span className="text-sm text-gray-400">No image yet — the dashed placeholder shows in the deck.</span>
            )}
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-400">Label (shown while empty)</label>
            <input
              className={inputCls}
              placeholder={w.label}
              value={customLabel}
              onChange={(e) =>
                updateDraft((d) => {
                  d.labels = { ...(d.labels || {}), [w.name]: e.target.value };
                })
              }
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="rounded-xl bg-gray-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-900 disabled:opacity-50"
              disabled={uploading}
              onClick={() => {
                uploadWellRef.current = w.name;
                fileRef.current?.click();
              }}
            >
              {uploading ? 'Uploading…' : url ? 'Replace image' : 'Upload image'}
            </button>
            {url && (
              <button
                className="btn-sm"
                onClick={() =>
                  updateDraft((d) => {
                    if (d.media) delete d.media[w.name];
                  })
                }
              >
                Clear image
              </button>
            )}
            {target.hideable && (
              <button
                className="btn-sm text-red-600"
                onClick={() => {
                  updateDraft((d) => {
                    d.hidden_wells = { ...(d.hidden_wells || {}), [w.name]: true };
                  });
                  setTarget(null);
                }}
              >
                Remove slot
              </button>
            )}
          </div>
          <p className="text-xs text-gray-400">PNG, JPG, WebP, GIF, or a short MP4/WebM loop. Removed slots come back with the “+” chip on the slide.</p>
        </>
      );
    }

    // ----- text field / list item -----
    const f = tpl.fields.find((x) => x.key === target.key);
    if (!f) return null;
    const isItem = f.kind === 'list' && target.index !== undefined;
    const arr: any[] = isItem ? draft[f.key] || [] : [];
    const item = isItem ? arr[target.index as number] : null;
    if (isItem && !item) return null;
    const hasBilingual = isItem ? (f.item || []).some((sf) => sf.bilingual) : !!f.bilingual;
    return (
      <>
        {isItem
          ? (f.item || []).map((sf) => (
              <div key={sf.key}>
                {sf.kind !== 'bool' && <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-400">{sf.label}</label>}
                {renderControl(sf, item[sf.key], (v) =>
                  updateDraft((d) => {
                    d[f.key][target.index as number][sf.key] = v;
                  })
                )}
              </div>
            ))
          : (
              <div>
                {f.kind !== 'bool' && <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-400">{f.label}</label>}
                {renderControl(f, draft[f.key], (v) =>
                  updateDraft((d) => {
                    d[f.key] = v;
                  })
                )}
              </div>
            )}
        {hasBilingual && (
          <div className="flex items-center gap-3">
            <button className="btn-sm" disabled={translating} onClick={() => void translate(target)}>
              {translating ? 'Translating…' : `Translate ${LANG_LABEL[writingLang]} → ${LANG_LABEL[otherLang]}`}
            </button>
            <span className="text-xs text-gray-400">Overwrites the {LANG_LABEL[otherLang]} row.</span>
          </div>
        )}
        {isItem && (
          <div className="flex flex-wrap gap-2">
            <button className="btn-sm" disabled={target.index === 0} onClick={() => moveListItem(f.key, target.index as number, -1)}>
              ↑ Move up
            </button>
            <button className="btn-sm" disabled={target.index === arr.length - 1} onClick={() => moveListItem(f.key, target.index as number, 1)}>
              ↓ Move down
            </button>
            <button className="btn-sm" onClick={() => addListItem(f, target.index)}>
              + Add below
            </button>
            <button className="btn-sm text-red-600" onClick={() => deleteListItem(f.key, target.index as number)}>
              Delete {singular(f)}
            </button>
          </div>
        )}
      </>
    );
  }

  function drawerTitle(): string {
    if (!target || !tpl) return '';
    if (target.well) {
      const w = tpl.wells.find((x) => x.name === target.well);
      return w ? cap(String(draft?.labels?.[w.name] || w.label).split(':')[0] ?? '') : 'Image';
    }
    const f = tpl.fields.find((x) => x.key === target.key);
    if (!f) return '';
    if (f.kind === 'list' && target.index !== undefined) return `${cap(singular(f))} ${target.index + 1} of ${(draft?.[f.key] || []).length}`;
    return shortLabel(f);
  }

  /* ---------- render ---------- */
  if (!slides) return <div className="flex h-screen items-center justify-center text-gray-400">Loading deck…</div>;

  const pill = (on: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-semibold transition ${on ? 'bg-gray-800 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`;
  const selectCls = 'rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm';

  return (
    <div className="flex h-screen flex-col bg-white text-gray-900">
      <style>{`.btn-sm{border:1px solid #d1d5db;border-radius:12px;background:#fff;font-size:13px;font-weight:600;padding:9px 14px;cursor:pointer;color:#374151}.btn-sm:hover{background:#f9fafb}.btn-sm:disabled{opacity:.4;cursor:default}.ico{border:1px solid #e5e7eb;border-radius:6px;background:#fff;font-size:10px;line-height:1;padding:5px 7px;cursor:pointer;color:#4b5563}.ico:hover{background:#f3f4f6}.ico:disabled{opacity:.3;cursor:default}`}</style>

      <header className="flex items-center gap-4 border-b border-gray-200 px-5 py-3">
        <span className="h-3.5 w-3.5 rounded-full" style={{ background: ACCENT }} />
        <span className="text-sm font-bold uppercase tracking-[.2em]">{deckName}</span>
        <a className="rounded-xl border border-gray-300 px-3.5 py-2 text-sm font-semibold hover:bg-gray-50" href={deckPath} target="_blank" rel="noopener">
          Open deck ↗
        </a>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- left: slide list ---------- */}
        <aside className="flex w-[352px] shrink-0 flex-col border-r border-gray-200">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {slides.map((s, i) => {
              const hidden = s.visible === false;
              return (
                <div
                  key={s.id}
                  onClick={() => void select(s)}
                  className={`cursor-pointer rounded-xl border px-4 py-3 ${s.id === selId ? 'border-gray-800 ring-1 ring-gray-800' : 'border-gray-200 hover:border-gray-400'} ${hidden ? 'opacity-50' : ''}`}
                >
                  <div className="flex items-baseline gap-3">
                    <span className="w-5 shrink-0 text-[11px] font-semibold text-gray-400">{String(i + 1).padStart(2, '0')}</span>
                    <span className="truncate text-[13px] font-bold uppercase tracking-[.08em] text-gray-900">{slideLabel(s)}</span>
                  </div>
                  <div className="mt-1.5 flex items-center gap-3">
                    <span className="w-5 shrink-0" />
                    <span className="flex-1 text-[10px] font-semibold uppercase tracking-[.2em] text-gray-400">{getTemplate(deck, s.template)?.category ?? s.template}</span>
                    <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <button className="ico" disabled={i === 0} onClick={() => void move(s, -1)} title="Move up">▲</button>
                      <button className="ico" disabled={i === slides.length - 1} onClick={() => void move(s, 1)} title="Move down">▼</button>
                      <button className="ico" onClick={() => void toggleVisible(s)} title={hidden ? 'Hidden — click to show' : 'Visible — click to hide'}>
                        {hidden ? '◌' : '👁'}
                      </button>
                      <button className="ico" onClick={() => void deleteSlide(s)} title="Delete slide">✕</button>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 border-t border-gray-200 p-3">
            <select className={`${selectCls} min-w-0 flex-1`} value={addTpl} onChange={(e) => setAddTpl(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold hover:bg-gray-50" onClick={() => void addSlide()}>
              + Add slide
            </button>
          </div>
        </aside>

        {/* ---------- center: toolbar + preview ---------- */}
        <main className="min-w-0 flex-1 overflow-y-auto bg-gray-50/60 p-5">
          {selected && tpl ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex gap-1">
                  {(['en', 'sr'] as Lang[]).map((l) => (
                    <button key={l} className={pill(previewLang === l)} onClick={() => setPreviewLang(l)}>
                      {LANG_LABEL[l]}
                    </button>
                  ))}
                </div>
                <span className="mx-1 h-6 w-px bg-gray-300" />
                <button className={pill(device === 'desktop')} onClick={() => setDevice('desktop')}>Desktop</button>
                <button className={pill(device === 'phone')} onClick={() => setDevice('phone')}>Phone</button>
                <span className="mx-1 h-6 w-px bg-gray-300" />
                <select className={selectCls} value={selected.template} onChange={(e) => void switchTemplate(e.target.value)} title="Slide style">
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={selected.visible !== false} onChange={() => void toggleVisible(selected)} /> Visible
                </label>
                <select className={selectCls} value="" onChange={(e) => e.target.value && restoreStarter(parseInt(e.target.value, 10))} disabled={!starterOptions.length} title="Restore from starter">
                  <option value="">Restore from starter…</option>
                  {starterOptions.map((s, i) => (
                    <option key={i} value={i}>
                      {s.label}
                    </option>
                  ))}
                </select>
                <span className="flex-1" />
                <span className="text-sm text-gray-500">Writing in</span>
                <select className={selectCls} value={writingLang} onChange={(e) => setWritingLang(e.target.value as Lang)}>
                  <option value="en">EN</option>
                  <option value="sr">CG</option>
                </select>
                <button className="btn-sm" disabled={translating} onClick={() => void translate('slide')}>
                  {translating ? 'Translating…' : 'Translate slide'}
                </button>
              </div>
              <div className="mt-3 flex items-center gap-3">
                {renderSaveButton()}
                {renderSaveStatus()}
                <span className="flex-1" />
                <button className="btn-sm" onClick={() => void duplicateSlide()}>Duplicate slide</button>
              </div>

              <div ref={previewPaneRef} className="mt-4 flex justify-center overflow-hidden rounded-2xl bg-gray-800 shadow-md" style={{ height: frame.h * scale + 2 }}>
                <iframe
                  ref={iframeRef}
                  title="Slide preview"
                  srcDoc={previewDoc}
                  onLoad={wirePreview}
                  style={{ width: frame.w, height: frame.h, border: 0, transform: `scale(${scale})`, transformOrigin: 'top center', flexShrink: 0 }}
                />
              </div>
              <p className="mt-2 text-sm text-gray-500">Click any part of the slide to edit it. Dashed chips add what isn’t there yet.</p>
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">Add a slide to begin.</div>
          )}
        </main>

        {/* ---------- right: drawer ---------- */}
        {target && tpl && draft && (
          <aside className="flex w-[440px] shrink-0 flex-col border-l border-gray-200 bg-white">
            <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
              <h2 className="text-base font-bold text-gray-900">{drawerTitle()}</h2>
              <button className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50" onClick={() => setTarget(null)} aria-label="Close">
                ✕
              </button>
            </header>
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">{renderDrawerBody()}</div>
            <footer className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
              {renderSaveStatus()}
              {renderSaveButton()}
            </footer>
          </aside>
        )}
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
