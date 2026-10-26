'use client';

import { BTN_DANGER, BTN_SECONDARY } from '@/components/prospect-crm';

export type Lang = 'sr' | 'en';
export type Kind = 'feed' | 'story';
export type Format = 'sq' | 'st';
export type Renders = Partial<Record<Format, Partial<Record<Lang, string>>>>;

/** The ig_posts row as the studio page sees it. */
export interface StudioPostView {
  id: string;
  created_at: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
  vertical: string;
  tone: string;
  lang: Lang;
  langs: Lang[];
  layout: string;
  brief: string | null;
  copy: Partial<Record<Lang, Record<string, string>>>;
  caption: string | null;
  photo_url: string;
  render_sq_url: string | null;
  render_st_url: string | null;
  design_sq_id: string | null;
  design_st_id: string | null;
  renders: Renders;
  designs: Renders;
  kinds: Kind[];
  scheduled_at: string | null;
  batch_id: string | null;
  feed_media_id: string | null;
  feed_published_at: string | null;
  story_media_id: string | null;
  story_published_at: string | null;
  story2_media_id: string | null;
  story2_published_at: string | null;
  error: string | null;
  attempts: number;
}

const STATUS: Record<StudioPostView['status'], string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-brand-50 text-brand-700',
  published: 'bg-emerald-50 text-emerald-700',
  failed: 'bg-red-50 text-red-700',
  cancelled: 'bg-gray-100 text-gray-400',
};

/** How many renders exist vs. how many the post wants. */
export function renderProgress(p: StudioPostView, hasStory: boolean): { done: number; total: number } {
  const formats: Format[] = hasStory && p.kinds.includes('story') ? ['sq', 'st'] : ['sq'];
  const langs = p.langs.length ? p.langs : [p.lang];
  let done = 0;
  for (const f of formats) for (const l of langs) if (p.renders[f]?.[l]) done++;
  return { done, total: formats.length * langs.length };
}

/** One studio post: thumbnail, status, schedule and the actions that make sense for its state. */
export function StudioPostCard({ post, busy, active, selected, hasStory, canPublish, onSelect, onOpen, onPreview, onPublish, onCancel, onDelete }: {
  post: StudioPostView;
  busy: boolean;
  active: boolean;
  selected: boolean;
  hasStory: boolean;
  canPublish: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onPreview: (url: string) => void;
  onPublish: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const headline = post.copy[post.lang]?.headline ?? '';
  const published = Boolean(post.feed_media_id || post.story_media_id);
  const when = post.status === 'published' ? post.feed_published_at ?? post.story_published_at : post.scheduled_at;
  const thumb = post.renders.sq?.[post.lang] ?? post.render_sq_url;
  const prog = renderProgress(post, hasStory);
  const needsWork = !headline || prog.done < prog.total;
  return (
    <div className={`rounded-xl border bg-white p-3 ${active ? 'border-brand-400 ring-1 ring-brand-200' : selected ? 'border-brand-300 bg-brand-50/40' : 'border-gray-200'} ${post.status === 'cancelled' ? 'opacity-60' : ''}`}>
      <div className="flex gap-3">
        <input type="checkbox" checked={selected} onChange={onSelect} className="mt-1 h-4 w-4 shrink-0 rounded border-gray-300 text-brand-600" aria-label="Select post" />
        <button type="button" className="shrink-0" onClick={() => thumb && onPreview(thumb)}>
          {thumb ? (
            <img src={thumb} alt="" className="h-20 w-20 rounded-md object-cover" loading="lazy" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-md bg-gray-100 text-center text-[11px] text-gray-400">{headline ? 'not rendered' : 'no copy'}</div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS[post.status]}`}>{post.status}</span>
            <span className="text-[11px] text-gray-400">{post.layout} · {(post.langs.length ? post.langs : [post.lang]).map((l) => l.toUpperCase()).join('+')} · {post.vertical}</span>
          </div>
          <button type="button" onClick={onOpen} className="mt-1 line-clamp-2 text-left text-sm font-medium text-gray-900 hover:text-brand-600">{headline || '(copy not written yet)'}</button>
          <div className="mt-1 text-xs text-gray-500">
            {when ? new Date(when).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'not scheduled'}
            {post.kinds.length === 1 ? ` · ${post.kinds[0]} only` : ''}
            {needsWork && post.status !== 'published' ? ` · renders ${prog.done}/${prog.total}` : ''}
          </div>
          {post.error && <div className="mt-1 truncate text-xs text-red-600" title={post.error}>{post.error}</div>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button type="button" className={BTN_SECONDARY} onClick={onOpen}>Open</button>
        {!published && post.status !== 'cancelled' && thumb && (
          <button type="button" className={BTN_SECONDARY} disabled={busy || !canPublish} onClick={onPublish}>Post now</button>
        )}
        {post.status === 'scheduled' && <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={onCancel}>Unschedule</button>}
        {!published && post.status !== 'cancelled' && <button type="button" className={`${BTN_DANGER} ml-auto`} disabled={busy} onClick={onDelete}>Delete</button>}
      </div>
    </div>
  );
}
