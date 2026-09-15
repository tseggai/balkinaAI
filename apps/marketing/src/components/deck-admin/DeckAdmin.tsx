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

const KEY_STORAGE = 'deck_upload_key';
const DESKTOP = { w: 1280, h: 800 };
const PHONE = { w: 390, h: 760 };
type Lang = 'en' | 'sr';
const LANG_LABEL: Record<Lang, string> = { en: 'EN', sr: 'CG' };

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
  if (f.kind === 'lines' || f.kind === 'list') return [];
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
  );
}
function fieldLabelSingular(f: FieldDef): string {
  return f.itemLabel || 'item';
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Convert content when switching a slide to another template: keep fields that exist with the same shape. */
function convertContent(from: TemplateDef | undefined, to: TemplateDef, content: any): any {
  const next: any = { ...clone(to.blank), media: content?.media || {} };
  for (const f of to.fields) {
    const v = content?.[f.key];
    if (v === undefined) continue;
    const src = from?.fields.find((x) => x.key === f.key);
    if (!src || (src.kind === f.kind && !!src.bilingual === !!f.bilingual)) next[f.key] = clone(v);
  }
  return next;
}

/** Drawer target: a top-level field, or one item of a list field. */
interface Target {
  key: string;
  index?: number;
}
function parseTarget(path: string): Target {
  const dot = path.indexOf('.');
  if (dot < 0) return { key: path };
  return { key: path.slice(0, dot), index: parseInt(path.slice(dot + 1), 10) };
}

/* ------------------------------------------------------------------ */

export default function DeckAdmin({ deck }: { deck: DeckId }) {
  const templates = DECK_TEMPLATES[deck];
  const bilingualDeck = deck === 'tenant';
  const deckPath = deck === 'tenant' ? '/tenant-deck' : '/deck';
  const deckName = deck === 'tenant' ? 'Tenant deck' : 'White-label deck';

  const [slides, setSlides] = useState<SlideRow[] | null>(null);
  const [selId, setSelId] = useState<string | null>(null);
  const [draft, setDraftState] = useState<any>(null);
  const [saveState, setSaveState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [addTpl, setAddTpl] = useState(templates[0]?.id ?? '');
  const [previewLang, setPreviewLang] = useState<Lang>('sr');
  const [writingLang, setWritingLang] = useState<Lang>('en');
  const [device, setDevice] = useState<'desktop' | 'phone'>('desktop');
  const [scale, setScale] = useState(0.5);
  const [target, setTarget] = useState<Target | null>(null);
  const [translating, setTranslating] = useState(false);
  const [busyWell, setBusyWell] = useState<string | null>(null);

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
      setScale(device === 'desktop' ? Math.min((el.clientWidth - 2) / DESKTOP.w, 0.8) : Math.min((el.clientWidth - 2) / PHONE.w, 1));
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
      const fonts = bilingualDeck
        ? '<link href="https://fonts.googleapis.com/css2?family=Quicksand:wght@300..700&display=swap" rel="stylesheet">'
        : '';
      const sel = target ? `[data-edit="${target.index !== undefined ? `${target.key}.${target.index}` : target.key}"]` : null;
      const adminCss = `
        [data-edit]{cursor:pointer;transition:outline-color .15s;}
        [data-edit]:hover{outline:1.5px dashed rgba(64,132,255,.75);outline-offset:4px;}
        ${sel ? `${sel}{outline:2px solid #2f6bff!important;outline-offset:4px;}` : ''}
        [data-slot]{outline:1.5px dashed rgba(64,132,255,.45);outline-offset:3px;cursor:pointer;}
        [data-slot]:hover{outline-color:#2f6bff;outline-style:solid;}
        .img-well:not(.has-media){display:flex!important;min-height:84px;align-items:center;justify-content:center;background:rgba(127,127,127,.15);}
        .img-well:not(.has-media)::before{content:"+ " attr(data-label);font:13px/1.4 system-ui,sans-serif;opacity:.85;padding:0 14px;text-align:center;letter-spacing:0;text-transform:none;font-style:normal;}
        .bgwell:not(.has-media)::before{content:"+ background photo";position:absolute;top:12px;left:12px;font:12px system-ui,sans-serif;background:rgba(0,0,0,.55);color:#fff;padding:6px 10px;border-radius:8px;z-index:5;}
        .da-chip{display:inline-block;list-style:none;margin:10px 6px 0 0;padding:6px 14px;border:1.5px dashed rgba(255,255,255,.45);border-radius:999px;font:12px system-ui,sans-serif;color:rgba(255,255,255,.75);cursor:pointer;background:none;letter-spacing:0;text-transform:none;font-style:normal;}
        .da-chip::before{display:none!important;}
        .da-chip:hover{border-color:#fff;color:#fff;}
      `;
      setPreviewDoc(
        `<!doctype html><html lang="${bilingualDeck ? 'sr' : 'en'}"${bilingualDeck ? ` data-lang="${previewLang}"` : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">${fonts}</head><body><style>${DECK_CSS[deck]}</style><style>${adminCss}</style>${section}</body></html>`
      );
    }, 250);
    return () => clearTimeout(t);
  }, [deck, bilingualDeck, selected, draft, previewLang, target]);

  /* ---------- wire clicks + "add" chips inside the preview ---------- */
  const wirePreview = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc || !tpl) return;
    doc.querySelectorAll('a').forEach((a) => ((a as HTMLAnchorElement).onclick = (e) => e.preventDefault()));
    doc.querySelectorAll('[data-slot]').forEach((el) => {
      (el as HTMLElement).onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        uploadWellRef.current = el.getAttribute('data-slot');
        fileRef.current?.click();
      };
    });
    doc.querySelectorAll('[data-edit]').forEach((el) => {
      (el as HTMLElement).onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setTarget(parseTarget(el.getAttribute('data-edit') || ''));
      };
    });
    const inner = doc.querySelector('.inner');
    for (const f of tpl.fields) {
      if (f.kind === 'list') {
        const items = doc.querySelectorAll(`[data-edit^="${f.key}."]`);
        const last = items[items.length - 1] as HTMLElement | undefined;
        const chip = doc.createElement(last?.tagName === 'LI' ? 'li' : 'div');
        chip.className = 'da-chip';
        chip.textContent = `+ ${fieldLabelSingular(f)}`;
        chip.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          addListItem(f);
        };
        if (last?.parentNode) last.parentNode.insertBefore(chip, last.nextSibling);
        else inner?.appendChild(chip);
      } else if (f.optional && !doc.querySelector(`[data-edit="${f.key}"]`)) {
        const chip = doc.createElement('div');
        chip.className = 'da-chip';
        chip.textContent = `+ ${f.label.replace(/\s*\(.*\)$/, '').toLowerCase()}`;
        chip.onclick = (e) => {
          e.preventDefault();
          e.stopPropagation();
          setTarget({ key: f.key });
        };
        inner?.appendChild(chip);
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
    dirtyRef.current = draftRef.current !== content; // edits made while saving stay dirty
    setSlides((prev) => (prev ? prev.map((s) => (s.id === selId ? j.slide : s)) : prev));
    setSaveState(dirtyRef.current ? 'dirty' : 'saved');
    if (dirtyRef.current) saveTimer.current = setTimeout(() => void save(), 900);
    return true;
  }

  async function select(s: SlideRow) {
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
    dirtyRef.current = false;
    const rest = slides.filter((x) => x.id !== s.id);
    setSlides(rest);
    if (s.id === selId) {
      const next = rest[0];
      setSelId(next?.id ?? null);
      setDraft(next ? clone(next.content || {}) : null, false);
      setTarget(null);
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
  type Slot = { get: (d: any) => any; set: (d: any, v: string) => void };
  function bilingualSlots(scope: 'slide' | Target): Slot[] {
    if (!tpl) return [];
    const out: Slot[] = [];
    const fieldsFor = (f: FieldDef, base: (d: any) => any, setBase: (d: any) => any) => {
      if (f.kind === 'list') return;
      if (!f.bilingual) return;
      out.push({
        get: (d) => base(d)?.[f.key],
        set: (d, v) => {
          const o = setBase(d);
          const cur = o[f.key] && typeof o[f.key] === 'object' ? o[f.key] : { en: '', sr: '' };
          o[f.key] = { ...cur, [otherLang]: v };
        },
      });
    };
    const listItem = (f: FieldDef, i: number) =>
      (f.item || []).forEach((sf) =>
        fieldsFor(
          sf,
          (d) => d?.[f.key]?.[i],
          (d) => {
            d[f.key] = d[f.key] || [];
            d[f.key][i] = d[f.key][i] || {};
            return d[f.key][i];
          }
        )
      );
    if (scope === 'slide') {
      for (const f of tpl.fields) {
        if (f.kind === 'list') (draftRef.current?.[f.key] || []).forEach((_: any, i: number) => listItem(f, i));
        else
          fieldsFor(
            f,
            (d) => d,
            (d) => d
          );
      }
    } else {
      const f = tpl.fields.find((x) => x.key === scope.key);
      if (!f) return [];
      if (scope.index !== undefined) listItem(f, scope.index);
      else
        fieldsFor(
          f,
          (d) => d,
          (d) => d
        );
    }
    return out;
  }
  async function translate(scope: 'slide' | Target) {
    const slots = bilingualSlots(scope);
    const texts = slots.map((s) => String(s.get(draftRef.current)?.[writingLang] ?? ''));
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
      updateDraft((d) => {
        d.media = { ...(d.media || {}), [well]: j.publicUrl };
      });
    } finally {
      setBusyWell(null);
    }
  }
  function removeMedia(well: string) {
    updateDraft((d) => {
      if (d.media) delete d.media[well];
    });
  }

  /* ---------- drawer field controls ---------- */
  function renderTextRows(field: FieldDef, value: any, onChange: (v: any) => void) {
    const area = field.kind === 'area';
    const cls = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-snug focus:border-gray-900 focus:outline-none';
    if (field.bilingual) {
      const v = value && typeof value === 'object' ? value : { en: String(value ?? ''), sr: String(value ?? '') };
      const order: Lang[] = writingLang === 'en' ? ['en', 'sr'] : ['sr', 'en'];
      return (
        <div className="space-y-2">
          {order.map((lang) => (
            <div key={lang} className="grid grid-cols-[34px_1fr] items-start gap-2">
              <span className={`pt-2 text-[11px] font-bold ${lang === writingLang ? 'text-amber-600' : 'text-gray-400'}`}>{LANG_LABEL[lang]}</span>
              {area ? (
                <textarea className={cls} rows={3} value={v[lang] ?? ''} onChange={(e) => onChange({ ...v, [lang]: e.target.value })} />
              ) : (
                <input className={cls} value={v[lang] ?? ''} onChange={(e) => onChange({ ...v, [lang]: e.target.value })} />
              )}
            </div>
          ))}
        </div>
      );
    }
    return area ? (
      <textarea className={cls} rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    ) : (
      <input className={cls} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
    );
  }

  function renderControl(field: FieldDef, value: any, onChange: (v: any) => void) {
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
      return (
        <textarea
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          rows={4}
          value={Array.isArray(value) ? value.join('\n') : String(value ?? '')}
          onChange={(e) => onChange(e.target.value.split('\n'))}
        />
      );
    }
    return renderTextRows(field, value, onChange);
  }

  function renderDrawer() {
    if (!target || !tpl || !draft) return null;
    const f = tpl.fields.find((x) => x.key === target.key);
    if (!f) return null;
    const isItem = f.kind === 'list' && target.index !== undefined;
    const arr: any[] = isItem ? draft[f.key] || [] : [];
    const item = isItem ? arr[target.index as number] : null;
    if (isItem && !item) return null;
    const hasBilingual = isItem ? (f.item || []).some((sf) => sf.bilingual) : !!f.bilingual;
    const title = isItem ? `${cap(fieldLabelSingular(f))} ${(target.index as number) + 1} of ${arr.length}` : f.label.replace(/\s*\(.*\)$/, '');

    return (
      <aside className="fixed inset-y-0 right-0 z-30 flex w-[460px] max-w-full flex-col border-l border-gray-200 bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          <button className="rounded-lg border border-gray-300 px-2.5 py-1 text-sm hover:bg-gray-50" onClick={() => setTarget(null)} aria-label="Close">
            ✕
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
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

          {bilingualDeck && hasBilingual && (
            <div className="flex items-center gap-3 pt-1">
              <button
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50 disabled:opacity-50"
                disabled={translating}
                onClick={() => translate(target)}
              >
                {translating ? 'Translating…' : `Translate ${LANG_LABEL[writingLang]} → ${LANG_LABEL[otherLang]}`}
              </button>
              <span className="text-xs text-gray-400">Overwrites the {LANG_LABEL[otherLang]} row.</span>
            </div>
          )}

          {isItem && (
            <div className="flex flex-wrap gap-2 pt-1">
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
                Delete {fieldLabelSingular(f)}
              </button>
            </div>
          )}
        </div>
        <footer className="flex items-center justify-between border-t border-gray-200 px-5 py-3">
          {renderSaveStatus()}
          {renderSaveButton()}
        </footer>
      </aside>
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
        className={`rounded-full px-4 py-2 text-sm font-bold ${active ? 'bg-gray-900 text-white hover:bg-black' : 'bg-gray-200 text-gray-400'}`}
        disabled={!active}
        onClick={() => void save()}
      >
        Save slide
      </button>
    );
  }

  /* ---------- render ---------- */
  if (!slides) return <div className="flex h-screen items-center justify-center text-gray-400">Loading deck…</div>;

  const pill = (on: boolean) =>
    `rounded-xl px-4 py-2 text-sm font-semibold transition ${on ? 'bg-gray-900 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'}`;

  return (
    <div className="flex h-screen flex-col bg-gray-50 text-gray-900">
      <style>{`.btn-sm{border:1px solid #d1d5db;border-radius:10px;background:#fff;font-size:13px;font-weight:600;padding:8px 12px;cursor:pointer}.btn-sm:hover{background:#f9fafb}.btn-sm:disabled{opacity:.4;cursor:default}.ico{border:1px solid #e5e7eb;border-radius:6px;background:#fff;font-size:11px;line-height:1;padding:5px 7px;cursor:pointer;color:#374151}.ico:hover{background:#f3f4f6}.ico:disabled{opacity:.3;cursor:default}`}</style>

      <header className="flex items-center gap-4 border-b border-gray-200 bg-white px-5 py-3">
        <span className="h-3 w-3 rounded-full bg-amber-400" />
        <span className="text-sm font-bold uppercase tracking-[.2em]">{deckName}</span>
        <a className="rounded-xl border border-gray-300 px-3 py-1.5 text-sm font-semibold hover:bg-gray-50" href={deckPath} target="_blank" rel="noopener">
          Open deck ↗
        </a>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* ---------- left: slide list ---------- */}
        <aside className="flex w-80 shrink-0 flex-col border-r border-gray-200 bg-gray-50">
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
            {slides.map((s, i) => {
              const hidden = s.visible === false;
              return (
                <div
                  key={s.id}
                  onClick={() => void select(s)}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border bg-white px-3 py-3 ${
                    s.id === selId ? 'border-gray-900 ring-1 ring-gray-900' : 'border-gray-200 hover:border-gray-400'
                  } ${hidden ? 'opacity-55' : ''}`}
                >
                  <span className="pt-0.5 text-[11px] font-bold text-gray-400">{String(i + 1).padStart(2, '0')}</span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-bold uppercase tracking-wide text-gray-900">{slideLabel(s)}</div>
                    <div className="mt-1 text-[10px] font-semibold uppercase tracking-[.18em] text-gray-400">
                      {getTemplate(deck, s.template)?.name.replace(/\s*\(.*\)$/, '') ?? s.template}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button className="ico" disabled={i === 0} onClick={() => void move(s, -1)} title="Move up">▲</button>
                    <button className="ico" disabled={i === slides.length - 1} onClick={() => void move(s, 1)} title="Move down">▼</button>
                    <button className="ico" onClick={() => void toggleVisible(s)} title={hidden ? 'Hidden — click to show' : 'Visible — click to hide'}>
                      {hidden ? '◌' : '👁'}
                    </button>
                    <button className="ico text-red-600" onClick={() => void deleteSlide(s)} title="Delete slide">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-2 border-t border-gray-200 bg-white p-3">
            <select className="min-w-0 flex-1 rounded-xl border border-gray-300 px-2 py-2 text-sm" value={addTpl} onChange={(e) => setAddTpl(e.target.value)}>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
            <button className="rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white hover:bg-black" onClick={() => void addSlide()}>
              + Add slide
            </button>
          </div>
        </aside>

        {/* ---------- center: toolbar + preview ---------- */}
        <main className="min-w-0 flex-1 overflow-y-auto p-5">
          {selected && tpl ? (
            <>
              <div className="flex flex-wrap items-center gap-2">
                {bilingualDeck && (
                  <div className="flex gap-1">
                    {(['en', 'sr'] as Lang[]).map((l) => (
                      <button key={l} className={pill(previewLang === l)} onClick={() => setPreviewLang(l)}>
                        {LANG_LABEL[l]}
                      </button>
                    ))}
                  </div>
                )}
                <span className="mx-1 h-6 w-px bg-gray-300" />
                <button className={pill(device === 'desktop')} onClick={() => setDevice('desktop')}>Desktop</button>
                <button className={pill(device === 'phone')} onClick={() => setDevice('phone')}>Phone</button>
                <span className="mx-1 h-6 w-px bg-gray-300" />
                <select className="rounded-xl border border-gray-300 px-3 py-2 text-sm" value={selected.template} onChange={(e) => void switchTemplate(e.target.value)} title="Slide style">
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <label className="ml-1 flex items-center gap-2 text-sm text-gray-700">
                  <input type="checkbox" checked={selected.visible !== false} onChange={() => void toggleVisible(selected)} /> Visible
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {bilingualDeck && (
                  <>
                    <span className="text-sm text-gray-500">Writing in</span>
                    <select className="rounded-xl border border-gray-300 px-3 py-2 text-sm" value={writingLang} onChange={(e) => setWritingLang(e.target.value as Lang)}>
                      <option value="en">EN</option>
                      <option value="sr">CG</option>
                    </select>
                    <button className="btn-sm" disabled={translating} onClick={() => void translate('slide')}>
                      {translating ? 'Translating…' : `Translate slide → ${LANG_LABEL[otherLang]}`}
                    </button>
                    <span className="mx-1 h-6 w-px bg-gray-300" />
                  </>
                )}
                <button className="btn-sm" onClick={() => void duplicateSlide()}>Duplicate slide</button>
                <span className="flex-1" />
                {renderSaveStatus()}
                {renderSaveButton()}
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
              <p className="mt-2 text-xs text-gray-500">Click any part of the slide to edit it. Dashed chips add what isn’t there yet; dashed boxes take an image or a short video.</p>

              {tpl.wells.length > 0 && (
                <section className="mt-4 rounded-xl border border-gray-200 bg-white p-3">
                  <h3 className="mb-2 text-[11px] font-bold uppercase tracking-wider text-gray-400">Images on this slide</h3>
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
                                className="ico"
                                onClick={() => {
                                  uploadWellRef.current = w.name;
                                  fileRef.current?.click();
                                }}
                              >
                                {url ? 'Replace' : 'Upload'}
                              </button>
                              {url && (
                                <button className="ico text-red-600" onClick={() => removeMedia(w.name)}>
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
            </>
          ) : (
            <div className="flex h-full items-center justify-center text-gray-400">Add a slide to begin.</div>
          )}
        </main>
      </div>

      {renderDrawer()}

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
