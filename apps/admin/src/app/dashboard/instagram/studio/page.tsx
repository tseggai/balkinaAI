'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog, type ConfirmRequest } from '@/components/confirm-dialog';
import { Modal } from '@/components/modal';
import { StudioPostCard, type StudioPostView } from '@/components/studio-post-card';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT, SECTION_TITLE, SELECT } from '@/components/prospect-crm';

type Lang = 'sr' | 'en';
type Kind = 'feed' | 'story';

interface Catalogue {
  verticals: { value: string; label: string }[];
  tones: { value: string; label: string; hint: string }[];
  photos: { name: string; url: string }[];
  layouts: { layout: string; sq: boolean; st: boolean; fields: string[]; preview: string | null }[];
  posts: StudioPostView[];
  canva: boolean;
  openai: boolean;
  instagram: boolean;
}

const LABEL = 'mb-1 block text-xs font-medium text-gray-500';
const FIELD_LABELS: Record<string, string> = {
  eyebrow: 'Eyebrow (audience tag)', headline: 'Headline', subline: 'Subline', url: 'URL', button: 'Button', big: 'Big number',
  step1_title: 'Step 1 title', step1_text: 'Step 1 text', step2_title: 'Step 2 title', step2_text: 'Step 2 text', step3_title: 'Step 3 title', step3_text: 'Step 3 text',
};

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function StudioPage() {
  const [cat, setCat] = useState<Catalogue | null>(null);
  const [vertical, setVertical] = useState('salon');
  const [tone, setTone] = useState('friendly');
  const [lang, setLang] = useState<Lang>('sr');
  const [layout, setLayout] = useState('');
  const [brief, setBrief] = useState('');
  const [photo, setPhoto] = useState('');
  const [copy, setCopy] = useState<Partial<Record<Lang, Record<string, string>>>>({});
  const [caption, setCaption] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [post, setPost] = useState<StudioPostView | null>(null);
  const [kinds, setKinds] = useState<Kind[]>(['feed', 'story']);
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 3600 * 1000)));
  const [busy, setBusy] = useState('');
  const [notice, setNotice] = useState<{ title: string; lines: string[] } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/studio');
    if (!res.ok) return;
    const data = (await res.json()) as Catalogue;
    setCat(data);
    setLayout((l) => l || data.layouts[0]?.layout || '');
    setPhoto((p) => p || data.photos[0]?.url || '');
  }, []);
  useEffect(() => { void load(); }, [load]);

  const notify = (title: string, lines: string[]) => setNotice({ title, lines });
  const api = async (path: string, body: unknown, method = 'POST') => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  };

  const layoutInfo = cat?.layouts.find((l) => l.layout === layout) ?? null;
  const currentCopy = copy[lang] ?? {};
  const hasCopy = fields.length > 0 && Boolean(currentCopy.headline);

  const writeCopy = async () => {
    setBusy('copy');
    const { ok, data } = await api('/api/admin/studio/copy', { vertical, tone, layout, brief: brief || undefined, langs: ['sr', 'en'] });
    setBusy('');
    if (!ok) return notify('Could not write copy', [String(data.error ?? 'Unknown error')]);
    setCopy(data.copy as Partial<Record<Lang, Record<string, string>>>);
    setCaption(String(data.caption ?? ''));
    setFields(data.fields as string[]);
    setPost(null);
  };

  const setField = (name: string, value: string) => setCopy((c) => ({ ...c, [lang]: { ...(c[lang] ?? {}), [name]: value } }));

  const upload = async (file: File) => {
    setBusy('upload');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/studio/upload', { method: 'POST', body: form });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setBusy('');
    if (!res.ok || !data.url) return notify('Upload failed', [data.error ?? 'Unknown error']);
    setPhoto(data.url);
  };

  const render = async () => {
    setBusy('render');
    const body = { vertical, tone, lang, layout, brief: brief || undefined, copy, caption, photo_url: photo, kinds };
    const { ok, data } = post
      ? await api(`/api/admin/studio/posts/${post.id}`, { action: 'rerender', copy, caption, photo_url: photo }, 'PATCH')
      : await api('/api/admin/studio/posts', body);
    setBusy('');
    if (!ok) return notify('Render failed', [String(data.error ?? 'Unknown error')]);
    setPost(data.post as StudioPostView);
    await load();
  };

  const act = async (p: StudioPostView, body: Record<string, unknown>, label: string) => {
    setBusy(p.id);
    const { ok, data } = await api(`/api/admin/studio/posts/${p.id}`, body, 'PATCH');
    setBusy('');
    if (!ok) notify(`${label} failed`, [String(data.error ?? 'Unknown error')]);
    else if (body.action === 'publish') {
      const results = (data.results as { kind: Kind; status: string; error?: string }[] | undefined) ?? [];
      notify(results.some((r) => r.status === 'failed') ? 'Posted with errors' : 'Posted', results.map((r) => `${r.kind}: ${r.status}${r.error ? ` — ${r.error}` : ''}`));
    }
    if (ok && post?.id === p.id) setPost(data.post as StudioPostView);
    await load();
  };

  const schedule = (p: StudioPostView) => act(p, { action: 'schedule', scheduled_at: new Date(when).toISOString(), kinds, caption }, 'Schedule');
  const publishNow = (p: StudioPostView) =>
    setConfirm({
      title: 'Post to Instagram now?',
      body: `${p.layout} · ${kinds.join(' + ')}. This publishes immediately to @balkina.ai.`,
      confirmLabel: 'Post now',
      onConfirm: async () => { setConfirm(null); await act(p, { action: 'publish', kinds, caption }, 'Publish'); },
    });
  const remove = (p: StudioPostView) =>
    setConfirm({
      title: 'Delete this draft?',
      body: 'The renders stay in storage; the post disappears from the studio.',
      confirmLabel: 'Delete',
      danger: true,
      onConfirm: async () => {
        setConfirm(null);
        const res = await fetch(`/api/admin/studio/posts/${p.id}`, { method: 'DELETE' });
        if (!res.ok) notify('Delete failed', [String(((await res.json().catch(() => ({}))) as { error?: string }).error ?? 'Unknown error')]);
        if (post?.id === p.id) setPost(null);
        await load();
      },
    });

  const ready = cat?.canva && cat.openai && (cat.layouts.length > 0);
  const posts = useMemo(() => cat?.posts ?? [], [cat]);

  if (!cat) return <div className="p-8 text-gray-400">Loading…</div>;

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/instagram" className="text-sm text-gray-500 hover:text-gray-700">← Instagram</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Studio</h1>
          <p className="mt-1 text-sm text-gray-500">Pick the audience, tone and layout, let the copywriter draft, drop in a photo, render through Canva, then schedule or post.</p>
        </div>
      </div>

      {!ready && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {!cat.canva ? 'Connect Canva on the Instagram page first. ' : ''}
          {!cat.openai ? 'OPENAI_API_KEY is missing in the admin project. ' : ''}
          {cat.canva && cat.layouts.length === 0 ? 'No square templates synced yet — publish one in Canva and click "Sync from Canva". ' : ''}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── Left: brief + copy ──────────────────────────────────────── */}
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className={SECTION_TITLE}>1 · Brief</h2>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Audience</label>
                <select className={`${SELECT} w-full`} value={vertical} onChange={(e) => setVertical(e.target.value)}>
                  {cat.verticals.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Tone</label>
                <select className={`${SELECT} w-full`} value={tone} onChange={(e) => setTone(e.target.value)} title={cat.tones.find((t) => t.value === tone)?.hint}>
                  {cat.tones.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Layout</label>
                <select className={`${SELECT} w-full`} value={layout} onChange={(e) => { setLayout(e.target.value); setPost(null); }}>
                  {cat.layouts.map((l) => <option key={l.layout} value={l.layout}>{l.layout}{l.st ? '' : ' (square only)'}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Language on the image</label>
                <div className="flex gap-1">
                  {(['sr', 'en'] as Lang[]).map((l) => (
                    <button key={l} type="button" onClick={() => { setLang(l); setPost(null); }} className={`flex-1 rounded-lg px-3 py-1.5 text-sm font-semibold ${lang === l ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l.toUpperCase()}</button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className={LABEL}>Brief (optional)</label>
              <textarea className={INPUT} rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. push the SMS reminder benefit; mention summer season; keep it under two lines" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className={BTN_PRIMARY} disabled={!ready || busy === 'copy' || !layout} onClick={writeCopy}>{busy === 'copy' ? 'Writing…' : hasCopy ? 'Write again' : 'Write copy'}</button>
              {layoutInfo && <span className="text-xs text-gray-500">{layoutInfo.sq && layoutInfo.st ? 'Square + story' : 'Square only'} · fields: {layoutInfo.fields.join(', ')}</span>}
            </div>
          </section>

          {hasCopy && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={SECTION_TITLE}>2 · Copy ({lang.toUpperCase()})</h2>
                <span className="text-xs text-gray-400">Edit anything before rendering.</span>
              </div>
              <div className="mt-3 space-y-3">
                {fields.map((f) => (
                  <div key={f}>
                    <label className={LABEL}>{FIELD_LABELS[f] ?? f}</label>
                    {f === 'headline' || f === 'subline' ? (
                      <textarea className={INPUT} rows={2} value={currentCopy[f] ?? ''} onChange={(e) => setField(f, e.target.value)} />
                    ) : (
                      <input className={INPUT} value={currentCopy[f] ?? ''} onChange={(e) => setField(f, e.target.value)} />
                    )}
                  </div>
                ))}
                <div>
                  <label className={LABEL}>Feed caption (SR + EN + hashtags)</label>
                  <textarea className={INPUT} rows={6} value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ── Right: photo + render + schedule ────────────────────────── */}
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className={SECTION_TITLE}>3 · Photo</h2>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-5">
              {cat.photos.map((p) => (
                <button key={p.url} type="button" onClick={() => setPhoto(p.url)} className={`overflow-hidden rounded-lg border-2 ${photo === p.url ? 'border-brand-600' : 'border-transparent'}`} title={p.name}>
                  <img src={p.url} alt={p.name} className="aspect-square w-full object-cover" />
                </button>
              ))}
              {photo && !cat.photos.some((p) => p.url === photo) && (
                <div className="overflow-hidden rounded-lg border-2 border-brand-600"><img src={photo} alt="" className="aspect-square w-full object-cover" /></div>
              )}
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'upload'} className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600">
                {busy === 'upload' ? 'Uploading…' : '+ Upload'}
              </button>
              <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
            </div>
            <input className={`${INPUT} mt-3`} value={photo} onChange={(e) => setPhoto(e.target.value)} placeholder="…or paste a public image URL" />
            <p className="mt-1 text-xs text-gray-400">Wide scene shots work best; the template crops to its frame. JPEG, PNG or WebP up to 8 MB.</p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={SECTION_TITLE}>4 · Render</h2>
              <button type="button" className={BTN_PRIMARY} disabled={!ready || !hasCopy || !photo || busy === 'render'} onClick={render}>{busy === 'render' ? 'Rendering…' : post ? 'Render again' : 'Render'}</button>
            </div>
            {post?.render_sq_url ? (
              <div className="mt-3 flex gap-3">
                <button type="button" onClick={() => setPreview(post.render_sq_url)} className="w-1/2 overflow-hidden rounded-lg border border-gray-200">
                  <img src={post.render_sq_url} alt="square" className="w-full" />
                </button>
                {post.render_st_url ? (
                  <button type="button" onClick={() => setPreview(post.render_st_url)} className="w-[28%] overflow-hidden rounded-lg border border-gray-200">
                    <img src={post.render_st_url} alt="story" className="w-full" />
                  </button>
                ) : (
                  <div className="flex w-[28%] items-center justify-center rounded-lg border border-dashed border-gray-200 p-2 text-center text-xs text-gray-400">No story template for this layout</div>
                )}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-400">Write the copy and pick a photo, then render. Takes 20–40 seconds per format.</p>
            )}
            {post?.design_sq_id && (
              <p className="mt-2 text-xs text-gray-400">
                Tweak in Canva: <a href={`https://www.canva.com/design/${post.design_sq_id}/edit`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">square</a>
                {post.design_st_id && <> · <a href={`https://www.canva.com/design/${post.design_st_id}/edit`} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">story</a></>}
                {' '}(edits there are not pulled back; re-render from here instead).
              </p>
            )}
          </section>

          {post?.render_sq_url && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className={SECTION_TITLE}>5 · Schedule or post</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Post at (your local time)</label>
                  <input type="datetime-local" className={INPUT} value={when} onChange={(e) => setWhen(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>What to post</label>
                  <div className="flex flex-wrap gap-1">
                    {([['feed', 'story'], ['feed'], ['story']] as Kind[][]).map((k) => (
                      <button key={k.join('+')} type="button" disabled={k.includes('story') && !post.render_st_url} onClick={() => setKinds(k)} className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40 ${k.join('+') === kinds.join('+') ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {k.length === 2 ? 'Feed + story' : k[0] === 'feed' ? 'Feed only' : 'Story only'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={BTN_PRIMARY} disabled={busy === post.id || !when} onClick={() => schedule(post)}>{post.status === 'scheduled' ? 'Reschedule' : 'Schedule'}</button>
                <button type="button" className={BTN_SECONDARY} disabled={busy === post.id || !cat.instagram} onClick={() => publishNow(post)}>Post now</button>
                {post.status === 'scheduled' && <button type="button" className={BTN_SECONDARY} disabled={busy === post.id} onClick={() => act(post, { action: 'unschedule' }, 'Unschedule')}>Unschedule</button>}
                <button type="button" className={`${BTN_DANGER} ml-auto`} disabled={busy === post.id} onClick={() => remove(post)}>Delete</button>
              </div>
              {post.status === 'scheduled' && post.scheduled_at && <p className="mt-2 text-xs text-emerald-700">Scheduled for {new Date(post.scheduled_at).toLocaleString()} · the publisher picks it up within 15 minutes of that time.</p>}
            </section>
          )}
        </div>
      </div>

      {/* ── Posts ───────────────────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className={SECTION_TITLE}>Studio posts</h2>
          <span className="text-xs text-gray-400">{posts.length} total</span>
        </div>
        {posts.length === 0 ? (
          <p className="text-sm text-gray-400">Nothing yet. Rendered posts show up here with their status.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {posts.map((p) => (
              <StudioPostCard
                key={p.id}
                post={p}
                busy={busy === p.id}
                active={post?.id === p.id}
                onOpen={() => {
                  setPost(p);
                  setVertical(p.vertical); setTone(p.tone); setLang(p.lang); setLayout(p.layout); setBrief(p.brief ?? ''); setPhoto(p.photo_url);
                  setCopy(p.copy); setCaption(p.caption ?? ''); setFields(Object.keys(p.copy[p.lang] ?? {})); setKinds(p.kinds);
                  if (p.scheduled_at) setWhen(toLocalInput(new Date(p.scheduled_at)));
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onPreview={(url) => setPreview(url)}
                onPublish={() => publishNow(p)}
                onCancel={() => act(p, { action: p.status === 'scheduled' ? 'unschedule' : 'cancel' }, 'Cancel')}
                onDelete={() => remove(p)}
                canPublish={cat.instagram}
              />
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog request={confirm} busy={Boolean(busy)} onClose={() => (busy ? undefined : setConfirm(null))} />
      <Modal open={Boolean(notice)} onClose={() => setNotice(null)} title={notice?.title ?? ''} footer={<button type="button" className={BTN_PRIMARY} onClick={() => setNotice(null)}>OK</button>}>
        <ul className="space-y-1">{notice?.lines.map((l, i) => <li key={i} className="break-words">{l}</li>)}</ul>
      </Modal>
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Preview" width="max-w-2xl" footer={<button type="button" className={BTN_PRIMARY} onClick={() => setPreview(null)}>Close</button>}>
        {preview && <img src={preview} alt="" className="mx-auto max-h-[70vh] rounded-lg" />}
      </Modal>
    </div>
  );
}
