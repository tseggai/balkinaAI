'use client';

import { useEffect, useRef, useState } from 'react';
import { ProgressRing } from '@/components/progress-ring';
import { boxesFor, TYPE, type Format } from '@/lib/ig/overlay';

export interface PreviewBusy { done: number; total: number; label: string }

type Lang = 'sr' | 'en';

export interface PreviewSlide {
  lang: Lang;
  finalUrl: string | null;   // the Canva render with this language's text baked in
  copy: Record<string, string>;
}

const FIELDS = ['eyebrow', 'headline', 'subline'] as const;
type Field = (typeof FIELDS)[number];

const RefreshIcon = () => (
  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
);

/**
 * The post as it will look, editable in place. In draft mode the copy is laid over a text-free render
 * of the template (positions from lib/ig/overlay.ts, approximate); in final mode the Canva render is
 * shown as is. Hover a line → Rewrite; click a line → edit; hover the photo → Shuffle / Change.
 */
export function PostPreview({ format, layout, slides, baseUrl, templateUrl, draft, busyField, busy, onEdit, onRewrite, onShuffle, onChangePhoto, onOpen }: {
  format: Format;
  layout: string;
  slides: PreviewSlide[];       // primary language first
  baseUrl: string | null;       // text-free render for the current photo
  templateUrl: string | null;   // the template as published, before the first generate
  draft: boolean;               // true = show copy over the base (edits pending or not rendered yet)
  busyField: string | null;
  busy?: PreviewBusy | null;    // a step is running for this image: ring + label over it
  onEdit: (lang: Lang, field: string, value: string) => void;
  onRewrite: (field: string) => void;
  onShuffle?: () => void;
  onChangePhoto?: () => void;
  onOpen?: (url: string) => void;
}) {
  const [i, setI] = useState(0);
  const [editing, setEditing] = useState<Field | null>(null);
  const [hover, setHover] = useState<Field | null>(null);
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const n = slides.length;
  useEffect(() => { if (i >= n) setI(0); }, [n, i]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const slide = slides[i];
  if (!slide) return null;
  const boxes = boxesFor(layout, format);
  const showFinal = !draft && Boolean(slide.finalUrl);
  const image = showFinal ? slide.finalUrl : baseUrl ?? templateUrl;
  const overlay = !showFinal && Boolean(baseUrl);
  const aspect = format === 'sq' ? 'aspect-square' : 'aspect-[9/16]';

  const commit = (field: Field, el: HTMLElement) => {
    const value = (el.innerText ?? '').replace(/\s+/g, ' ').trim();
    setEditing(null);
    if (value !== (slide.copy[field] ?? '')) onEdit(slide.lang, field, value);
  };

  return (
    <div className="group/preview">
      <div ref={ref} className={`relative ${aspect} w-full overflow-hidden rounded-xl bg-gray-100 font-quicksand`}>
        {image ? (
          <img src={image} alt="" className={`h-full w-full object-cover ${showFinal ? 'cursor-zoom-in' : ''}`} onClick={() => showFinal && slide.finalUrl && onOpen?.(slide.finalUrl)} draggable={false} />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-xs text-gray-400">No template yet</div>
        )}

        {/* Photo actions (draft mode only: the photo is swappable until rendered) */}
        {(onShuffle || onChangePhoto) && !showFinal && baseUrl && (
          <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition group-hover/preview:opacity-100">
            {onShuffle && <button type="button" onClick={onShuffle} className="flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-800 shadow hover:bg-white"><RefreshIcon /> Shuffle photo</button>}
            {onChangePhoto && <button type="button" onClick={onChangePhoto} className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold text-gray-800 shadow hover:bg-white">Change…</button>}
          </div>
        )}

        {/* Editable copy over the text-free render, at the template's own positions and type scale */}
        {overlay && width > 0 && FIELDS.map((field) => {
          const b = boxes[field];
          const text = slide.copy[field] ?? '';
          const fixed = field === 'eyebrow';
          const isEditing = editing === field;
          const isHover = hover === field;
          const spec = fixed ? TYPE[format].eyebrow : TYPE[format][field];
          const fontSize = spec.size * width;
          // Text boxes are stored by their ascender line; the CSS line box starts `top` em above it.
          const top = fixed ? `${b.y * 100}%` : `calc(${b.y * 100}% - ${(spec as { top: number }).top * fontSize}px)`;
          return (
            <div
              key={field}
              className="absolute"
              style={{ left: `${b.x * 100}%`, top, width: fixed ? 'auto' : `${b.w * 100}%`, height: fixed ? `${boxes.eyebrow.h * 100}%` : undefined, maxWidth: `${(1 - b.x - 0.04) * 100}%` }}
              onMouseEnter={() => setHover(field)}
              onMouseLeave={() => setHover((h) => (h === field ? null : h))}
            >
              {fixed ? (
                <div
                  className="flex h-full items-center whitespace-nowrap bg-[#FFE300] font-bold uppercase text-[#232B5E]"
                  style={{ fontSize, lineHeight: 1, paddingLeft: TYPE[format].eyebrow.padX * width, paddingRight: TYPE[format].eyebrow.padX * width, borderRadius: TYPE[format].eyebrow.radius * width, letterSpacing: `${TYPE[format].eyebrow.tracking}em` }}
                >
                  {text}
                </div>
              ) : (
                <div
                  contentEditable
                  suppressContentEditableWarning
                  spellCheck={false}
                  onFocus={() => setEditing(field)}
                  onBlur={(e) => commit(field, e.currentTarget)}
                  onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); (e.currentTarget as HTMLElement).blur(); } if (e.key === 'Escape') { (e.currentTarget as HTMLElement).innerText = text; (e.currentTarget as HTMLElement).blur(); } }}
                  className={`cursor-text text-white outline-none transition ${isEditing ? 'rounded-sm ring-2 ring-white/90 ring-offset-1 ring-offset-black/20' : isHover ? 'rounded-sm ring-1 ring-white/60' : ''}`}
                  style={{ fontSize, lineHeight: (spec as { lineHeight: number }).lineHeight, fontWeight: (spec as { weight: number }).weight, letterSpacing: 0, minHeight: fontSize * (spec as { lineHeight: number }).lineHeight }}
                >
                  {text}
                </div>
              )}
              {!fixed && (isHover || isEditing) && (
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => onRewrite(field)}
                  disabled={busyField !== null}
                  className="absolute -top-6 right-0 flex items-center gap-1 rounded-full bg-white px-2 py-0.5 text-[11px] font-semibold text-gray-800 shadow disabled:opacity-60"
                >
                  <RefreshIcon /> {busyField === field ? 'Rewriting…' : 'Rewrite'}
                </button>
              )}
            </div>
          );
        })}

        {!overlay && !showFinal && image && !busy && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/50 to-transparent px-3 pb-2 pt-6 text-[11px] text-white">{format === 'st' && width < 260 ? 'Template' : 'Template as published · Generate to fill it'}</div>
        )}

        {/* Work in progress on this image */}
        {busy && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
            <div className="flex flex-col items-center gap-2 rounded-2xl bg-white/95 px-4 py-3 text-center shadow-lg">
              <div className="relative text-brand-600">
                <ProgressRing done={busy.done} total={busy.total} size={format === 'st' ? 48 : 56} />
                <span className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold text-gray-800">{busy.done}/{busy.total}</span>
              </div>
              <span className="max-w-[9rem] text-[11px] font-medium leading-tight text-gray-700">{busy.label}</span>
            </div>
          </div>
        )}

        {n > 1 && (
          <>
            <button type="button" aria-label="Previous" onClick={() => setI((x) => (x - 1 + n) % n)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow opacity-0 transition group-hover/preview:opacity-100">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <button type="button" aria-label="Next" onClick={() => setI((x) => (x + 1) % n)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow opacity-0 transition group-hover/preview:opacity-100">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
            <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
              {slides.map((_, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${k === i ? 'bg-white' : 'bg-white/50'} shadow`} />)}
            </div>
          </>
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500">
        <span>{slide.lang === 'sr' ? 'Serbian' : 'English'}{showFinal ? ' · rendered' : overlay ? ' · draft (positions approximate until rendered)' : ''}</span>
        {n > 1 && <span>{i + 1} / {n}</span>}
      </div>
    </div>
  );
}
