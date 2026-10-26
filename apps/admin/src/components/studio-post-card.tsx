'use client';

import { BTN_DANGER, BTN_SECONDARY } from '@/components/prospect-crm';

type Lang = 'sr' | 'en';
type Kind = 'feed' | 'story';

/** The ig_posts row as the studio page sees it. */
export interface StudioPostView {
  id: string;
  created_at: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
  vertical: string;
  tone: string;
  lang: Lang;
  layout: string;
  brief: string | null;
  copy: Partial<Record<Lang, Record<string, string>>>;
  caption: string | null;
  photo_url: string;
  render_sq_url: string | null;
  render_st_url: string | null;
  design_sq_id: string | null;
  design_st_id: string | null;
  kinds: Kind[];
  scheduled_at: string | null;
  feed_media_id: string | null;
  feed_published_at: string | null;
  story_media_id: string | null;
  story_published_at: string | null;
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

/** One studio post: thumbnail, status, schedule and the actions that make sense for its state. */
export function StudioPostCard({ post, busy, active, canPublish, onOpen, onPreview, onPublish, onCancel, onDelete }: {
  post: StudioPostView;
  busy: boolean;
  active: boolean;
  canPublish: boolean;
  onOpen: () => void;
  onPreview: (url: string) => void;
  onPublish: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const headline = post.copy[post.lang]?.headline ?? '';
  const published = Boolean(post.feed_media_id || post.story_media_id);
  const when = post.status === 'published' ? post.feed_published_at ?? post.story_published_at : post.scheduled_at;
  return (
    <div className={`rounded-xl border bg-white p-3 ${active ? 'border-brand-400 ring-1 ring-brand-200' : 'border-gray-200'} ${post.status === 'cancelled' ? 'opacity-60' : ''}`}>
      <div className="flex gap-3">
        <button type="button" className="shrink-0" onClick={() => post.render_sq_url && onPreview(post.render_sq_url)}>
          {post.render_sq_url ? (
            <img src={post.render_sq_url} alt="" className="h-20 w-20 rounded-md object-cover" loading="lazy" />
          ) : (
            <div className="flex h-20 w-20 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">no render</div>
          )}
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS[post.status]}`}>{post.status}</span>
            <span className="text-[11px] text-gray-400">{post.layout} · {post.lang.toUpperCase()} · {post.vertical}</span>
          </div>
          <button type="button" onClick={onOpen} className="mt-1 line-clamp-2 text-left text-sm font-medium text-gray-900 hover:text-brand-600">{headline || '(no headline)'}</button>
          <div className="mt-1 text-xs text-gray-500">
            {when ? new Date(when).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'not scheduled'}
            {post.kinds.length === 1 ? ` · ${post.kinds[0]} only` : ''}
            {post.render_st_url ? '' : ' · square only'}
          </div>
          {post.error && <div className="mt-1 truncate text-xs text-red-600" title={post.error}>{post.error}</div>}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
        <button type="button" className={BTN_SECONDARY} onClick={onOpen}>Open</button>
        {!published && post.status !== 'cancelled' && post.render_sq_url && (
          <button type="button" className={BTN_SECONDARY} disabled={busy || !canPublish} onClick={onPublish}>Post now</button>
        )}
        {post.status === 'scheduled' && <button type="button" className={BTN_SECONDARY} disabled={busy} onClick={onCancel}>Unschedule</button>}
        {!published && post.status !== 'cancelled' && <button type="button" className={`${BTN_DANGER} ml-auto`} disabled={busy} onClick={onDelete}>Delete</button>}
        {published && post.status !== 'cancelled' && post.status !== 'published' && <button type="button" className={`${BTN_DANGER} ml-auto`} disabled={busy} onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}
