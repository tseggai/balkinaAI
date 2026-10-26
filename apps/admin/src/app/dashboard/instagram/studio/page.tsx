'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ConfirmDialog, type ConfirmRequest } from '@/components/confirm-dialog';
import { Modal } from '@/components/modal';
import { StudioBatchModal, type BatchRequest } from '@/components/studio-batch-modal';
import { renderProgress, StudioPostCard, type Format, type Kind, type Lang, type StudioPostView } from '@/components/studio-post-card';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT, SECTION_TITLE, SELECT } from '@/components/prospect-crm';

interface Catalogue {
  verticals: { value: string; label: string }[];
  tones: { value: string; label: string; hint: string }[];
  photos: { name: string; url: string; source: 'stock' | 'upload' }[];
  layouts: { layout: string; sq: boolean; st: boolean; fields: string[]; preview: string | null }[];
  cadence: { post_time: string; days: number[]; timezone: string };
  posts: StudioPostView[];
  canva: boolean;
  openai: boolean;
  instagram: boolean;
}

interface Progress { title: string; done: number; total: number; detail: string }
type Filter = 'all' | 'draft' | 'scheduled' | 'published' | 'failed';

const LABEL = 'mb-1 block text-xs font-medium text-gray-500';
const FIELD_LABELS: Record<string, string> = {
  eyebrow: 'Eyebrow (audience tag)', headline: 'Headline', subline: 'Subline', url: 'URL', button: 'Button', big: 'Big number',
  step1_title: 'Step 1 title', step1_text: 'Step 1 text', step2_title: 'Step 2 title', step2_text: 'Step 2 text', step3_title: 'Step 3 title', step3_text: 'Step 3 text',
};
const STEP_LABEL: Record<Format, string> = { sq: 'square', st: 'story' };

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function StudioPage() {
  const [cat, setCat] = useState<Catalogue | null>(null);
  // brief
  const [vertical, setVertical] = useState('salon');
  const [tone, setTone] = useState('friendly');
  const [lang, setLang] = useState<Lang>('sr');            // primary (first slide / first story)
  const [bilingual, setBilingual] = useState(true);
  const [layout, setLayout] = useState('');
  const [brief, setBrief] = useState('');
  const [photo, setPhoto] = useState('');
  // copy
  const [copy, setCopy] = useState<Partial<Record<Lang, Record<string, string>>>>({});
  const [editLang, setEditLang] = useState<Lang>('sr');
  const [caption, setCaption] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  // post + schedule
  const [post, setPost] = useState<StudioPostView | null>(null);
  const [kinds, setKinds] = useState<Kind[]>(['feed', 'story']);
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 3600 * 1000)));
  // ui
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const stopRef = useRef(false);
  const [notice, setNotice] = useState<{ title: string; lines: string[] } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [batchOpen, setBatchOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkShift, setBulkShift] = useState('7');
  const [bulkTime, setBulkTime] = useState('18:00');
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/studio');
    if (!res.ok) return null;
    const data = (await res.json()) as Catalogue;
    setCat(data);
    setLayout((l) => l || data.layouts[0]?.layout || '');
    setPhoto((p) => p || data.photos[0]?.url || '');
    return data;
  }, []);
  useEffect(() => { void load(); }, [load]);

  const notify = (title: string, lines: string[]) => setNotice({ title, lines });
  const api = async (path: string, body: unknown, method = 'POST') => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  };

  const layoutInfo = cat?.layouts.find((l) => l.layout === layout) ?? null;
  const hasStory = (l: string) => Boolean(cat?.layouts.find((x) => x.layout === l)?.st);
  const langs: Lang[] = bilingual ? ['sr', 'en'] : [lang];
  const currentCopy = copy[editLang] ?? {};
  const hasCopy = fields.length > 0 && Boolean(copy[lang]?.headline);
  const ready = Boolean(cat?.canva && cat.openai && cat.layouts.length > 0);

  /* ---------- pipeline: render steps, one request each, two at a time ---------- */

  /** Steps a post still needs: formats × languages (primary first) minus what is rendered. */
  const stepsFor = (p: StudioPostView): { format: Format; lang: Lang }[] => {
    const formats: Format[] = hasStory(p.layout) && p.kinds.includes('story') ? ['sq', 'st'] : ['sq'];
    const langs = [p.lang, ...(p.langs.length ? p.langs : [p.lang]).filter((l) => l !== p.lang)];
    const out: { format: Format; lang: Lang }[] = [];
    for (const format of formats) for (const lang of langs) if (!p.renders[format]?.[lang]) out.push({ format, lang });
    return out;
  };

  /**
   * The first render runs alone so the photo is uploaded to Canva once and cached on the post; the
   * remaining renders run two at a time (each is its own request, so the 60 s cap applies per render).
   */
  const renderSteps = async (p: StudioPostView, label: string, offset = 0, total = 0): Promise<StudioPostView | null> => {
    let cur = p;
    const want = renderProgress(cur, hasStory(cur.layout)).total;
    const base = total || want;
    const runOne = async (step: { format: Format; lang: Lang }): Promise<StudioPostView | null> => {
      const { ok, data } = await api(`/api/admin/studio/posts/${cur.id}`, { action: 'render', ...step }, 'PATCH');
      if (!ok) { notify('Render failed', [`${STEP_LABEL[step.format]} ${step.lang.toUpperCase()}: ${String(data.error ?? 'Unknown error')}`]); return null; }
      return data.post as StudioPostView;
    };
    const merge = (results: (StudioPostView | null)[]) => {
      // Every response carries the row after its own atomic merge; the union of renders is the truth.
      for (const r of results) {
        if (!r) continue;
        const renders = { ...cur.renders };
        const designs = { ...cur.designs };
        for (const f of ['sq', 'st'] as Format[]) { renders[f] = { ...(renders[f] ?? {}), ...(r.renders[f] ?? {}) }; designs[f] = { ...(designs[f] ?? {}), ...(r.designs[f] ?? {}) }; }
        cur = { ...r, renders, designs };
      }
      if (post?.id === cur.id || !post) setPost(cur);
    };
    let first = true;
    for (let guard = 0; guard < 6; guard++) {
      if (stopRef.current) return cur;
      const pending = stepsFor(cur);
      if (pending.length === 0) break;
      const batch = first ? pending.slice(0, 1) : pending.slice(0, 2);
      first = false;
      const done = want - pending.length;
      setProgress({ title: label, done: offset + done, total: base, detail: `Rendering ${batch.map((s) => `${STEP_LABEL[s.format]} ${s.lang.toUpperCase()}`).join(' + ')} (${done + 1}${batch.length > 1 ? `–${done + batch.length}` : ''} of ${want})…` });
      const results = await Promise.all(batch.map(runOne));
      merge(results);
      if (results.some((r) => !r)) return null;
    }
    return cur;
  };

  /* ---------- single post ---------- */

  const writeCopy = async () => {
    setBusy('copy');
    const { ok, data } = await api('/api/admin/studio/copy', { vertical, tone, layout, brief: brief || undefined, langs });
    setBusy('');
    if (!ok) return notify('Could not write copy', [String(data.error ?? 'Unknown error')]);
    setCopy(data.copy as Partial<Record<Lang, Record<string, string>>>);
    setCaption(String(data.caption ?? ''));
    setFields(data.fields as string[]);
    setEditLang(lang);
    setPost(null);
  };

  const setField = (name: string, value: string) => setCopy((c) => ({ ...c, [editLang]: { ...(c[editLang] ?? {}), [name]: value } }));

  const upload = async (file: File) => {
    setBusy('upload');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/studio/upload', { method: 'POST', body: form });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setBusy('');
    if (!res.ok || !data.url) return notify('Upload failed', [data.error ?? 'Unknown error']);
    setPhoto(data.url);
    await load();
  };

  const render = async () => {
    setBusy('render');
    stopRef.current = false;
    const r = post
      ? await api(`/api/admin/studio/posts/${post.id}`, { action: 'rerender', copy, caption, photo_url: photo, langs, primary: lang }, 'PATCH')
      : await api('/api/admin/studio/posts', { vertical, tone, lang, langs, layout, brief: brief || undefined, copy, caption, photo_url: photo, kinds });
    if (!r.ok) { setBusy(''); return notify('Could not save the post', [String(r.data.error ?? 'Unknown error')]); }
    const created = r.data.post as StudioPostView;
    setPost(created);
    const done = await renderSteps(created, 'Rendering');
    setProgress(null);
    setBusy('');
    if (done) setPost(done);
    await load();
  };

  const act = async (p: StudioPostView, body: Record<string, unknown>, label: string) => {
    setBusy(p.id);
    const { ok, data } = await api(`/api/admin/studio/posts/${p.id}`, body, 'PATCH');
    setBusy('');
    if (!ok) notify(`${label} failed`, [String(data.error ?? 'Unknown error')]);
    else if (body.action === 'publish') {
      const results = (data.results as { kind: Kind; lang?: Lang; status: string; error?: string }[] | undefined) ?? [];
      notify(results.some((r) => r.status === 'failed') ? 'Posted with errors' : 'Posted', results.map((r) => `${r.kind}${r.lang ? ` ${r.lang.toUpperCase()}` : ''}: ${r.status}${r.error ? ` — ${r.error}` : ''}`));
    }
    if (ok && post?.id === p.id) setPost(data.post as StudioPostView);
    await load();
  };

  const schedule = (p: StudioPostView) => act(p, { action: 'schedule', scheduled_at: new Date(when).toISOString(), kinds, caption }, 'Schedule');
  const publishNow = (p: StudioPostView) =>
    setConfirm({
      title: 'Post to Instagram now?',
      body: `${p.layout} · ${p.kinds.join(' + ')}${p.langs.length > 1 ? ' · SR→EN carousel + two stories' : ''}. This publishes immediately to @balkina.ai.`,
      confirmLabel: 'Post now',
      onConfirm: async () => { setConfirm(null); await act(p, { action: 'publish', ...(post?.id === p.id ? { kinds, caption } : {}) }, 'Publish'); },
    });
  const remove = (p: StudioPostView) =>
    setConfirm({
      title: 'Delete this post?',
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

  const openPost = (p: StudioPostView) => {
    setPost(p);
    setVertical(p.vertical); setTone(p.tone); setLang(p.lang); setBilingual(p.langs.length > 1); setLayout(p.layout); setBrief(p.brief ?? ''); setPhoto(p.photo_url);
    setCopy(p.copy); setCaption(p.caption ?? ''); setFields(Object.keys(p.copy[p.lang] ?? {})); setEditLang(p.lang); setKinds(p.kinds);
    if (p.scheduled_at) setWhen(toLocalInput(new Date(p.scheduled_at)));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /* ---------- batch: create drafts, then copy + renders + schedule per post ---------- */

  const finish = async (list: StudioPostView[], title: string) => {
    stopRef.current = false;
    setBusy('batch');
    const perPost = (p: StudioPostView) => renderProgress(p, hasStory(p.layout)).total + 1;
    const total = list.reduce((n, p) => n + perPost(p), 0);
    let offset = 0;
    let failed = 0;
    for (const [i, p0] of list.entries()) {
      if (stopRef.current) break;
      let p = p0;
      setProgress({ title, done: offset, total, detail: `Post ${i + 1} of ${list.length}: writing copy…` });
      if (!p.copy[p.lang]?.headline) {
        const w = await api(`/api/admin/studio/posts/${p.id}`, { action: 'write' }, 'PATCH');
        if (!w.ok) { failed++; offset += perPost(p); continue; }
        p = w.data.post as StudioPostView;
      }
      offset += 1;
      const done = await renderSteps(p, title, offset, total);
      if (!done) { failed++; offset += perPost(p) - 1; continue; }
      p = done;
      offset += perPost(p) - 1;
      const prog = renderProgress(p, hasStory(p.layout));
      if (p.scheduled_at && p.status === 'draft' && prog.done >= prog.total) {
        await api(`/api/admin/studio/posts/${p.id}`, { action: 'schedule', scheduled_at: p.scheduled_at }, 'PATCH');
      }
    }
    setProgress(null);
    setBusy('');
    const data = await load();
    const stopped = stopRef.current;
    notify(stopped ? 'Stopped' : 'Batch finished', [
      `${list.length - failed} of ${list.length} posts ready${failed ? `, ${failed} failed (open them to see the error)` : ''}.`,
      ...(stopped ? ['Use "Finish unfinished" to continue where it stopped.'] : []),
      ...(data ? [`${data.posts.filter((p) => p.status === 'scheduled').length} scheduled in total.`] : []),
    ]);
  };

  const startBatch = async (req: BatchRequest) => {
    setBatchOpen(false);
    setBusy('batch');
    setProgress({ title: 'Creating drafts', done: 0, total: 1, detail: '' });
    const { ok, data } = await api('/api/admin/studio/batch', req);
    if (!ok) { setBusy(''); setProgress(null); return notify('Batch failed', [String(data.error ?? 'Unknown error')]); }
    await finish(data.posts as StudioPostView[], 'Generating batch');
  };

  const posts = useMemo(() => cat?.posts ?? [], [cat]);
  const unfinished = useMemo(() => {
    const storyLayouts = new Set((cat?.layouts ?? []).filter((l) => l.st).map((l) => l.layout));
    return posts.filter((p) => {
      if (p.status !== 'draft' && p.status !== 'scheduled') return false;
      const prog = renderProgress(p, storyLayouts.has(p.layout));
      return !p.copy[p.lang]?.headline || prog.done < prog.total;
    });
  }, [posts, cat]);
  const visible = useMemo(() => posts.filter((p) => filter === 'all' || p.status === filter), [posts, filter]);
  const allVisibleSelected = visible.length > 0 && visible.every((p) => selected.has(p.id));

  const bulk = async (body: Record<string, unknown>, what: string) => {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    setBusy('bulk');
    const { ok, data } = await api('/api/admin/studio/posts/bulk', { ids, ...body });
    setBusy('');
    notify(ok ? 'Updated' : 'Could not update', [ok ? `${what} for ${data.changed} post${data.changed === 1 ? '' : 's'}.` : String(data.error ?? 'Unknown error')]);
    if (body.action === 'delete') setSelected(new Set());
    await load();
  };

  if (!cat) return <div className="p-8 text-gray-400">Loading…</div>;

  const rendersOf = (p: StudioPostView | null): { format: Format; lang: Lang; url: string }[] => {
    if (!p) return [];
    const out: { format: Format; lang: Lang; url: string }[] = [];
    for (const f of ['sq', 'st'] as Format[]) for (const l of [p.lang, ...p.langs.filter((x) => x !== p.lang)]) { const u = p.renders[f]?.[l]; if (u) out.push({ format: f, lang: l, url: u }); }
    return out;
  };
  const postRenders = rendersOf(post);
  const postProg = post ? renderProgress(post, hasStory(post.layout)) : null;
  const rendered = Boolean(post?.renders.sq?.[post.lang]);

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/instagram" className="text-sm text-gray-500 hover:text-gray-700">← Instagram</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Studio</h1>
          <p className="mt-1 text-sm text-gray-500">One post by hand, or a whole batch on a cadence. Feed posts go out as an SR→EN carousel, stories as one per language.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {unfinished.length > 0 && <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={() => void finish(unfinished, 'Finishing posts')}>Finish unfinished ({unfinished.length})</button>}
          <button type="button" className={BTN_PRIMARY} disabled={!ready || Boolean(busy)} onClick={() => setBatchOpen(true)}>Generate batch</button>
        </div>
      </div>

      {!ready && (
        <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {!cat.canva ? 'Connect Canva on the Instagram page first. ' : ''}
          {!cat.openai ? 'OPENAI_API_KEY is missing in the admin project. ' : ''}
          {cat.canva && cat.layouts.length === 0 ? 'No square templates synced yet — publish one in Canva and click "Sync from Canva". ' : ''}
        </div>
      )}

      {progress && (
        <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="font-semibold text-brand-800">{progress.title} · {progress.done}/{progress.total}</span>
            <div className="flex items-center gap-3">
              <span className="text-brand-700">{progress.detail}</span>
              <button type="button" className="text-xs font-medium text-brand-700 hover:underline" onClick={() => { stopRef.current = true; }}>Stop after this step</button>
            </div>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-brand-600 transition-all" style={{ width: `${Math.round((progress.done / Math.max(1, progress.total)) * 100)}%` }} /></div>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        {/* ── Left: brief + copy ──────────────────────────────────────── */}
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className={SECTION_TITLE}>1 · Brief</h2>
              {post && <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => { setPost(null); setCopy({}); setFields([]); setCaption(''); }}>New post</button>}
            </div>
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
                <label className={LABEL}>Languages</label>
                <div className="flex gap-1">
                  <button type="button" onClick={() => { setBilingual(true); setLang('sr'); }} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${bilingual ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>SR + EN</button>
                  <button type="button" onClick={() => { setBilingual(false); setLang('sr'); setEditLang('sr'); }} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${!bilingual && lang === 'sr' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>SR</button>
                  <button type="button" onClick={() => { setBilingual(false); setLang('en'); setEditLang('en'); }} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${!bilingual && lang === 'en' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>EN</button>
                </div>
                {bilingual && (
                  <label className="mt-1.5 flex items-center gap-2 text-xs text-gray-500">
                    First slide
                    <select className="rounded border border-gray-300 px-1.5 py-0.5 text-xs" value={lang} onChange={(e) => setLang(e.target.value as Lang)}><option value="sr">SR</option><option value="en">EN</option></select>
                  </label>
                )}
              </div>
            </div>
            <div className="mt-3">
              <label className={LABEL}>Brief (optional)</label>
              <textarea className={INPUT} rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. push the SMS reminder benefit; mention summer season; keep it under two lines" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className={BTN_PRIMARY} disabled={!ready || Boolean(busy) || !layout} onClick={writeCopy}>{busy === 'copy' ? 'Writing…' : hasCopy ? 'Write again' : 'Write copy'}</button>
              {layoutInfo && <span className="text-xs text-gray-500">{layoutInfo.st ? 'Square + story' : 'Square only'} · fields: {layoutInfo.fields.join(', ')}</span>}
            </div>
          </section>

          {hasCopy && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={SECTION_TITLE}>2 · Copy</h2>
                <div className="flex gap-1">
                  {langs.map((l) => (
                    <button key={l} type="button" onClick={() => setEditLang(l)} className={`rounded-full px-3 py-1 text-xs font-semibold ${editLang === l ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l.toUpperCase()}{l === lang && bilingual ? ' · first' : ''}</button>
                  ))}
                </div>
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
                  <label className={LABEL}>Feed caption (both languages + hashtags)</label>
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
            <div className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
              {cat.photos.map((p) => (
                <button key={p.url} type="button" onClick={() => setPhoto(p.url)} className={`overflow-hidden rounded-lg border-2 ${photo === p.url ? 'border-brand-600' : 'border-transparent'}`} title={p.name}>
                  <img src={p.url} alt={p.name} className="aspect-square w-full object-cover" loading="lazy" />
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
            <p className="mt-1 text-xs text-gray-400">Uploads join the library and are matched to batches by name (e.g. “barber-shave.jpg” goes to barbers). JPEG, PNG or WebP up to 8 MB.</p>
          </section>

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={SECTION_TITLE}>4 · Render{postProg ? ` (${postProg.done}/${postProg.total})` : ''}</h2>
              <button type="button" className={BTN_PRIMARY} disabled={!ready || !hasCopy || !photo || Boolean(busy)} onClick={render}>{busy === 'render' ? 'Rendering…' : rendered ? 'Render again' : 'Render'}</button>
            </div>
            {postRenders.length > 0 ? (
              <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {postRenders.map((r) => (
                  <button key={`${r.format}-${r.lang}`} type="button" onClick={() => setPreview(r.url)} className="overflow-hidden rounded-lg border border-gray-200 text-left">
                    <img src={r.url} alt={`${r.format} ${r.lang}`} className="w-full" />
                    <div className="px-2 py-1 text-[11px] text-gray-500">{STEP_LABEL[r.format]} · {r.lang.toUpperCase()}</div>
                  </button>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-gray-400">Write the copy and pick a photo, then render. Each image takes 20–40 seconds; a bilingual post with a story is four images.</p>
            )}
            {post?.designs.sq?.[post.lang] && (
              <p className="mt-2 text-xs text-gray-400">
                Tweak in Canva: {postRenders.map((r) => {
                  const id = post.designs[r.format]?.[r.lang];
                  return id ? <a key={`${r.format}-${r.lang}`} href={`https://www.canva.com/design/${id}/edit`} target="_blank" rel="noreferrer" className="mr-2 text-brand-600 hover:underline">{STEP_LABEL[r.format]} {r.lang.toUpperCase()}</a> : null;
                })}
                (edits there are not pulled back; re-render from here instead).
              </p>
            )}
          </section>

          {post && rendered && (
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
                      <button key={k.join('+')} type="button" disabled={k.includes('story') && !hasStory(post.layout)} onClick={() => setKinds(k)} className={`rounded-full px-3 py-1 text-xs font-semibold disabled:opacity-40 ${k.join('+') === kinds.join('+') ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        {k.length === 2 ? 'Feed + story' : k[0] === 'feed' ? 'Feed only' : 'Story only'}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={BTN_PRIMARY} disabled={Boolean(busy) || !when} onClick={() => schedule(post)}>{post.status === 'scheduled' ? 'Reschedule' : 'Schedule'}</button>
                <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy) || !cat.instagram} onClick={() => publishNow(post)}>Post now</button>
                {post.status === 'scheduled' && <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={() => act(post, { action: 'unschedule' }, 'Unschedule')}>Unschedule</button>}
                <button type="button" className={`${BTN_DANGER} ml-auto`} disabled={Boolean(busy)} onClick={() => remove(post)}>Delete</button>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {post.langs.length > 1 ? `Feed: 2-slide carousel (${post.lang.toUpperCase()} first). Stories: ${post.lang.toUpperCase()} then ${post.langs.find((l) => l !== post.lang)?.toUpperCase()}. ` : ''}
                {post.status === 'scheduled' && post.scheduled_at ? `Scheduled for ${new Date(post.scheduled_at).toLocaleString()} · the publisher picks it up within 15 minutes.` : ''}
              </p>
            </section>
          )}
        </div>
      </div>

      {/* ── Posts ───────────────────────────────────────────────────────── */}
      <div className="mt-8">
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <h2 className={SECTION_TITLE}>Studio posts</h2>
          <select className={SELECT} value={filter} onChange={(e) => { setFilter(e.target.value as Filter); }}>
            <option value="all">All ({posts.length})</option>
            <option value="scheduled">Scheduled ({posts.filter((p) => p.status === 'scheduled').length})</option>
            <option value="draft">Drafts ({posts.filter((p) => p.status === 'draft').length})</option>
            <option value="published">Published ({posts.filter((p) => p.status === 'published').length})</option>
            <option value="failed">Failed ({posts.filter((p) => p.status === 'failed').length})</option>
          </select>
          <label className="flex items-center gap-2 text-xs text-gray-500">
            <input type="checkbox" checked={allVisibleSelected} onChange={() => setSelected(allVisibleSelected ? new Set() : new Set(visible.map((p) => p.id)))} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
            Select all
          </label>
          {selected.size > 0 && (
            <div className="flex w-full flex-wrap items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm md:w-auto">
              <span className="font-semibold text-brand-700">{selected.size} selected</span>
              <div className="flex items-center gap-1">
                <input type="number" className={`${INPUT.replace('w-full ', '')} w-20 py-1`} value={bulkShift} onChange={(e) => setBulkShift(e.target.value)} />
                <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={() => bulk({ action: 'shift_days', days: Number(bulkShift) }, `Shifted by ${bulkShift} day(s)`)}>Shift days</button>
              </div>
              <div className="flex items-center gap-1">
                <input type="time" className={`${INPUT.replace('w-full ', '')} w-32 py-1`} value={bulkTime} onChange={(e) => setBulkTime(e.target.value)} />
                <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={() => bulk({ action: 'set_time', time: bulkTime, tz_offset_minutes: new Date().getTimezoneOffset() }, `Time set to ${bulkTime}`)}>Set time</button>
              </div>
              <select className={SELECT} disabled={Boolean(busy)} defaultValue="" onChange={(e) => { if (e.target.value) void bulk({ action: 'kinds', kinds: e.target.value.split('+') }, `Kinds set to ${e.target.value}`); e.target.value = ''; }}>
                <option value="">Post…</option>
                <option value="feed+story">Feed + story</option>
                <option value="feed">Feed only</option>
                <option value="story">Story only</option>
              </select>
              <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={() => bulk({ action: 'unschedule' }, 'Unscheduled')}>Unschedule</button>
              <button type="button" className={BTN_DANGER} disabled={Boolean(busy)} onClick={() => setConfirm({ title: `Delete ${selected.size} post(s)?`, body: 'Published posts are kept. Drafts and scheduled posts are removed.', confirmLabel: 'Delete', danger: true, onConfirm: async () => { setConfirm(null); await bulk({ action: 'delete' }, 'Deleted'); } })}>Delete</button>
              <button type="button" className="text-xs text-gray-500 hover:underline" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
        </div>
        {visible.length === 0 ? (
          <p className="text-sm text-gray-400">{posts.length === 0 ? 'Nothing yet. Rendered posts show up here with their status.' : 'Nothing matches this filter.'}</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((p) => (
              <StudioPostCard
                key={p.id}
                post={p}
                busy={busy === p.id || busy === 'batch'}
                active={post?.id === p.id}
                selected={selected.has(p.id)}
                hasStory={hasStory(p.layout)}
                canPublish={cat.instagram}
                onSelect={() => setSelected((s) => { const n = new Set(s); if (n.has(p.id)) n.delete(p.id); else n.add(p.id); return n; })}
                onOpen={() => openPost(p)}
                onPreview={(url) => setPreview(url)}
                onPublish={() => publishNow(p)}
                onCancel={() => act(p, { action: 'unschedule' }, 'Unschedule')}
                onDelete={() => remove(p)}
              />
            ))}
          </div>
        )}
      </div>

      <StudioBatchModal open={batchOpen} onClose={() => setBatchOpen(false)} onStart={(req) => void startBatch(req)} verticals={cat.verticals} tones={cat.tones} layouts={cat.layouts} cadence={cat.cadence} />
      <ConfirmDialog request={confirm} busy={busy !== '' && busy !== 'batch'} onClose={() => (busy && busy !== 'batch' ? undefined : setConfirm(null))} />
      <Modal open={Boolean(notice)} onClose={() => setNotice(null)} title={notice?.title ?? ''} footer={<button type="button" className={BTN_PRIMARY} onClick={() => setNotice(null)}>OK</button>}>
        <ul className="space-y-1">{notice?.lines.map((l, i) => <li key={i} className="break-words">{l}</li>)}</ul>
      </Modal>
      <Modal open={Boolean(preview)} onClose={() => setPreview(null)} title="Preview" width="max-w-2xl" footer={<button type="button" className={BTN_PRIMARY} onClick={() => setPreview(null)}>Close</button>}>
        {preview && <img src={preview} alt="" className="mx-auto max-h-[70vh] rounded-lg" />}
      </Modal>
    </div>
  );
}
