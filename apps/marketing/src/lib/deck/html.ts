/* eslint-disable @typescript-eslint/no-explicit-any */
// Small HTML helpers shared by both deck template modules.
// `data-edit="<field>"` / `data-edit="<list>.<index>"` markers let the admin
// map a click in the preview to the field being edited; they are inert publicly.
import type { Bi } from './types';

export function esc(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Escape + preserve intentional line breaks. */
export function escBr(s: unknown): string {
  return esc(s).replace(/\n/g, '<br>');
}

export function ed(path?: string): string {
  return path ? ` data-edit="${esc(path)}"` : '';
}

export function bi(v: unknown): Bi {
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const en = String(o.en ?? '');
    const sr = String(o.sr ?? '');
    return { en: en || sr, sr: sr || en };
  }
  return { en: String(v ?? ''), sr: String(v ?? '') };
}

/** <tag class="cls en">..</tag><tag class="cls sr">..</tag> pair for a bilingual value. */
export function dual(tag: string, v: unknown, cls = '', edit?: string, br = false): string {
  const { en, sr } = bi(v);
  const c = cls ? `${cls} ` : '';
  const e = br ? escBr : esc;
  return `<${tag} class="${c}en"${ed(edit)}>${e(en)}</${tag}><${tag} class="${c}sr"${ed(edit)}>${e(sr)}</${tag}>`;
}

/** Bilingual list value: legacy string[] applies to both languages. */
export function biLines(v: unknown): { en: string[]; sr: string[] } {
  if (Array.isArray(v)) return { en: v.map(String), sr: v.map(String) };
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    const en = Array.isArray(o.en) ? o.en.map(String) : [];
    const sr = Array.isArray(o.sr) ? o.sr.map(String) : [];
    return { en: en.length ? en : sr, sr: sr.length ? sr : en };
  }
  return { en: [], sr: [] };
}

/** Renders a wrapper twice (en/sr) around per-language content. */
export function dualWrap(tag: string, cls: string, edit: string | undefined, render: (lang: 'en' | 'sr') => string): string {
  const c = cls ? `${cls} ` : '';
  return `<${tag} class="${c}en"${ed(edit)}>${render('en')}</${tag}><${tag} class="${c}sr"${ed(edit)}>${render('sr')}</${tag}>`;
}

/** Per-slide well customisation stored in content: labels + hidden slots. */
export function wellHidden(c: any, name: string): boolean {
  return !!c?.hidden_wells?.[name];
}
export function wellLabel(c: any, name: string, fallback: string): string {
  return String(c?.labels?.[name] || fallback);
}

/** Inline <span class="en">..</span><span class="sr">..</span> pair. */
export function dualSpan(v: unknown): string {
  const { en, sr } = bi(v);
  return `<span class="en">${esc(en)}</span><span class="sr">${esc(sr)}</span>`;
}

/** Media element for an uploaded well asset (video by extension, else image). */
export function mediaTag(url?: string): string {
  if (!url) return '';
  const u = esc(url);
  return /\.(mp4|webm)(\?|$)/i.test(String(url))
    ? `<video class="da-media" src="${u}" autoplay muted loop playsinline></video>`
    : `<img class="da-media" src="${u}" alt="">`;
}

/** Attributes + has-media class for a well element. */
export function wellAttrs(
  name: string,
  fit: 'cover' | 'flow',
  media: Record<string, string> | undefined,
  baseClass: string
): { cls: string; attrs: string; media: string } {
  const url = media?.[name];
  return {
    cls: `${baseClass}${url ? ' has-media' : ''}`,
    attrs: ` data-slot="${esc(name)}" data-fit="${fit}"`,
    media: mediaTag(url),
  };
}

export const LOGO_WHITE = '/assets/Balkina_icon_white.png';

export const USER_AVATAR_SVG =
  '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M12 12c2.65 0 4.8-2.15 4.8-4.8S14.65 2.4 12 2.4 7.2 4.55 7.2 7.2 9.35 12 12 12Zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8Z"/></svg>';

export const APPLE_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>';

export const GPLAY_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 01-.61-.92V2.734a1 1 0 01.609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-1.292l2.545 1.473c.68.394.68 1.03 0 1.424l-2.545 1.473-2.534-2.534 2.534-2.536zM5.864 2.658L16.8 8.99l-2.302 2.302-8.634-8.634z"/></svg>';
