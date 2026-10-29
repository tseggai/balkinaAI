'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { Carousel } from '@/components/carousel';
import { ConfirmDialog, type ConfirmRequest } from '@/components/confirm-dialog';
import { Modal } from '@/components/modal';
import { StudioBatchModal, type BatchRequest } from '@/components/studio-batch-modal';
import { renderProgress, StudioPostCard, type Format, type Kind, type Lang, type StudioPostView } from '@/components/studio-post-card';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT, SECTION_TITLE, SELECT } from '@/components/prospect-crm';

interface Catalogue {
  verticals: { value: string; label: string; category: string; photo: string[] }[];
  categories: { key: string; order: number; label: string; synced: boolean; story: boolean }[];
  tones: { value: string; label: string; hint: string }[];
  photos: { name: string; url: string; source: 'stock' | 'upload' }[];
  layouts: { layout: string; sq: boolean; st: boolean; fields: string[]; preview: string | null; previewSq: string | null; previewSt: string | null }[];
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
  eyebrow: 'Eyebrow (category)', headline: 'Headline', subline: 'Subline', url: 'URL', button: 'Button', big: 'Big number',
  step1_title: 'Step 1 title', step1_text: 'Step 1 text', step2_title: 'Step 2 title', step2_text: 'Step 2 text', step3_title: 'Step 3 title', step3_text: 'Step 3 text',
};
const FIXED_FIELDS = new Set(['eyebrow', 'url']);
const STEP_LABEL: Record<Format, string> = { sq: 'square', st: 'story' };

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const RefreshIcon = () => (
  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182" /></svg>
);

export default function StudioPage() {
  const [cat, setCat] = useState<Catalogue | null>(null);
  // brief
  const [vertical, setVertical] = useState('salon');
  const [tone, setTone] = useState('friendly');
  const [lang, setLang] = useState<Lang>('sr');            // primary (first slide / first story)
  const [bilingual, setBilingual] = useState(true);
  const [layoutPick, setLayoutPick] = useState('');         // '' = follow the audience's category
  const [brief, setBrief] = useState('');
  const [kinds, setKinds] = useState<Kind[]>(['feed', 'story']);
  // copy + photo (the working draft; `post` holds what is rendered)
  const [copy, setCopy] = useState<Partial<Record<Lang, Record<string, string>>>>({});
  const [editLang, setEditLang] = useState<Lang>('sr');
  const [caption, setCaption] = useState('');
  const [fields, setFields] = useState<string[]>([]);
  const [photo, setPhoto] = useState('');
  const [photoSeed, setPhotoSeed] = useState(0);
  const [dirty, setDirty] = useState(false);
  // post + schedule
  const [post, setPost] = useState<StudioPostView | null>(null);
  const [when, setWhen] = useState(() => toLocalInput(new Date(Date.now() + 3600 * 1000)));
  // ui
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState<Progress | null>(null);
  const stopRef = useRef(false);
  const [notice, setNotice] = useState<{ title: string; lines: string[] } | null>(null);
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [photoUrlDraft, setPhotoUrlDraft] = useState('');
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
    return data;
  }, []);
  useEffect(() => { void load(); }, [load]);

  const notify = (title: string, lines: string[]) => setNotice({ title, lines });
  const api = async (path: string, body: unknown, method = 'POST') => {
    const res = await fetch(path, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    return { ok: res.ok, data };
  };

  /* ---------- derived ---------- */

  const verticalInfo = cat?.verticals.find((x) => x.value === vertical) ?? null;
  const categoryOfVertical = (v: string) => cat?.verticals.find((x) => x.value === v)?.category ?? '';
  const autoLayout = (v: string) => {
    const c = categoryOfVertical(v);
    return cat?.layouts.some((l) => l.layout === c) ? c : cat?.layouts[0]?.layout ?? '';
  };
  const layout = layoutPick || autoLayout(vertical);
  const layoutInfo = cat?.layouts.find((l) => l.layout === layout) ?? null;
  const hasStory = (l: string) => Boolean(cat?.layouts.find((x) => x.layout === l)?.st);
  const langs: Lang[] = bilingual ? ['sr', 'en'] : [lang];
  const langOrder: Lang[] = [lang, ...langs.filter((l) => l !== lang)];
  const currentCopy = copy[editLang] ?? {};
  const hasCopy = fields.length > 0 && Boolean(copy[lang]?.headline);
  const ready = Boolean(cat?.canva && cat.openai && cat.layouts.length > 0);
  const wantStory = kinds.includes('story') && hasStory(layout);

  /** Library photos that fit the audience (by name), falling back to the whole library. */
  const photoPool = useMemo(() => {
    const words = verticalInfo?.photo ?? [];
    const all = cat?.photos ?? [];
    const matching = all.filter((p) => words.some((w) => p.name.toLowerCase().includes(w)));
    return matching.length ? matching : all;
  }, [cat, verticalInfo]);
  const autoPhoto = photoPool[photoSeed % Math.max(1, photoPool.length)]?.url ?? '';
  const photoUrl = photo || autoPhoto;

  /* ---------- pipeline: render steps, one request each, two at a time ---------- */

  const stepsFor = (p: StudioPostView): { format: Format; lang: Lang }[] => {
    const formats: Format[] = hasStory(p.layout) && p.kinds.includes('story') ? ['sq', 'st'] : ['sq'];
    const order = [p.lang, ...(p.langs.length ? p.langs : [p.lang]).filter((l) => l !== p.lang)];
    const out: { format: Format; lang: Lang }[] = [];
    for (const format of formats) for (const l of order) if (!p.renders[format]?.[l]) out.push({ format, lang: l });
    return out;
  };

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

  /* ---------- single post: generate, regenerate a field, apply ---------- */

  /** Copy → draft (with the matched photo) → every render. One click from brief to filled template. */
  const generate = async () => {
    setBusy('generate');
    stopRef.current = false;
    setProgress({ title: 'Generating', done: 0, total: 1, detail: 'Writing copy…' });
    const w = await api('/api/admin/studio/copy', { vertical, tone, layout, brief: brief || undefined, langs });
    if (!w.ok) { setBusy(''); setProgress(null); return notify('Could not write copy', [String(w.data.error ?? 'Unknown error')]); }
    const newCopy = w.data.copy as Partial<Record<Lang, Record<string, string>>>;
    const newCaption = String(w.data.caption ?? '');
    setCopy(newCopy); setCaption(newCaption); setFields(w.data.fields as string[]); setEditLang(lang);
    const body = { vertical, tone, lang, langs, layout, brief: brief || undefined, copy: newCopy, caption: newCaption, photo_url: photoUrl || undefined, kinds };
    const r = await api('/api/admin/studio/posts', body);
    if (!r.ok) { setBusy(''); setProgress(null); return notify('Could not create the post', [String(r.data.error ?? 'Unknown error')]); }
    const created = r.data.post as StudioPostView;
    setPost(created); setPhoto(created.photo_url); setDirty(false);
    const done = await renderSteps(created, 'Generating');
    setProgress(null); setBusy('');
    if (done) setPost(done);
    await load();
  };

  /** New wording for one field (both languages), keeping the rest; marks the design as needing a re-render. */
  const regenerate = async (field: string) => {
    setBusy(`field:${field}`);
    const { ok, data } = await api('/api/admin/studio/copy', { vertical, tone, layout, brief: brief || undefined, langs, only: [field], current: { copy, caption } });
    setBusy('');
    if (!ok) return notify('Could not rewrite', [String(data.error ?? 'Unknown error')]);
    if (field === 'caption') setCaption(String(data.caption ?? ''));
    else setCopy(data.copy as Partial<Record<Lang, Record<string, string>>>);
    if (field !== 'caption') setDirty(true);
  };

  const setField = (name: string, value: string) => { setCopy((c) => ({ ...c, [editLang]: { ...(c[editLang] ?? {}), [name]: value } })); setDirty(true); };
  const choosePhoto = (url: string) => { setPhoto(url); setDirty(true); setPhotoOpen(false); };
  const shufflePhoto = () => { setPhoto(''); setPhotoSeed((s) => s + 1); setDirty(true); };

  const upload = async (file: File) => {
    setBusy('upload');
    const form = new FormData();
    form.append('file', file);
    const res = await fetch('/api/admin/studio/upload', { method: 'POST', body: form });
    const data = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    setBusy('');
    if (!res.ok || !data.url) return notify('Upload failed', [data.error ?? 'Unknown error']);
    choosePhoto(data.url);
    await load();
  };

  /** Push the edited copy / photo into the design: forget the renders and run the steps again. */
  const apply = async () => {
    if (!post) return generate();
    setBusy('render');
    stopRef.current = false;
    const r = await api(`/api/admin/studio/posts/${post.id}`, { action: 'rerender', copy, caption, photo_url: photoUrl, langs, primary: lang }, 'PATCH');
    if (!r.ok) { setBusy(''); return notify('Could not save the post', [String(r.data.error ?? 'Unknown error')]); }
    const saved = r.data.post as StudioPostView;
    setPost(saved); setDirty(false);
    const done = await renderSteps(saved, 'Rendering');
    setProgress(null); setBusy('');
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
        if (post?.id === p.id) reset();
        await load();
      },
    });

  const reset = () => { setPost(null); setCopy({}); setFields([]); setCaption(''); setPhoto(''); setDirty(false); };
  const openPost = (p: StudioPostView) => {
    setPost(p);
    setVertical(p.vertical); setTone(p.tone); setLang(p.lang); setBilingual(p.langs.length > 1); setLayoutPick(p.layout); setBrief(p.brief ?? ''); setPhoto(p.photo_url);
    setCopy(p.copy); setCaption(p.caption ?? ''); setFields(Object.keys(p.copy[p.lang] ?? {})); setEditLang(p.lang); setKinds(p.kinds); setDirty(false);
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

  /* ---------- preview slides: real renders, or the template preview before the first generate ---------- */

  const slidesFor = (format: Format) =>
    langOrder.map((l) => {
      const url = post?.renders[format]?.[l] ?? null;
      const tpl = format === 'sq' ? layoutInfo?.previewSq : layoutInfo?.previewSt;
      return { url: url ?? tpl ?? null, label: `${l === 'sr' ? 'Serbian' : 'English'}${url ? '' : ' · template preview'}`, placeholder: 'No template yet' };
    });
  const postProg = post ? renderProgress(post, hasStory(post.layout)) : null;
  const rendered = Boolean(post?.renders.sq?.[post.lang]);
  const working = busy === 'generate' || busy === 'render';

  return (
    <div className="p-4 md:p-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link href="/dashboard/instagram" className="text-sm text-gray-500 hover:text-gray-700">← Instagram</Link>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Studio</h1>
          <p className="mt-1 text-sm text-gray-500">Pick the audience, generate, then rewrite any line or swap the photo with one click. Feed goes out as an SR→EN carousel, stories one per language.</p>
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
          {cat.canva && cat.layouts.length === 0 ? 'No templates synced yet — publish one in Canva and click Sync. ' : ''}
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

      <div className="grid gap-5 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        {/* ── Left: brief + copy ──────────────────────────────────────── */}
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <h2 className={SECTION_TITLE}>Brief</h2>
              {post && <button type="button" className="text-xs text-gray-500 hover:underline" onClick={reset}>New post</button>}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={LABEL}>Audience</label>
                <select className={`${SELECT} w-full`} value={vertical} onChange={(e) => { setVertical(e.target.value); setPhoto(''); setPhotoSeed(0); if (post) setDirty(true); }}>
                  {cat.categories.map((c) => (
                    <optgroup key={c.key} label={`${c.label}${c.synced ? '' : ' · no template yet'}`}>
                      {cat.verticals.filter((v) => v.category === c.key).map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
              <div>
                <label className={LABEL}>Tone</label>
                <select className={`${SELECT} w-full`} value={tone} onChange={(e) => setTone(e.target.value)} title={cat.tones.find((t) => t.value === tone)?.hint}>
                  {cat.tones.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div>
                <label className={LABEL}>Template</label>
                <select className={`${SELECT} w-full`} value={layoutPick} onChange={(e) => { setLayoutPick(e.target.value); if (post) setDirty(true); }}>
                  <option value="">Auto · {autoLayout(vertical) || 'none synced'}</option>
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
              </div>
              <div>
                <label className={LABEL}>Post</label>
                <div className="flex gap-1">
                  {([['feed', 'story'], ['feed'], ['story']] as Kind[][]).map((k) => (
                    <button key={k.join('+')} type="button" disabled={k.includes('story') && !hasStory(layout)} onClick={() => setKinds(k)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold disabled:opacity-40 ${k.join('+') === kinds.join('+') ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                      {k.length === 2 ? 'Both' : k[0] === 'feed' ? 'Feed' : 'Story'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-3">
              <label className={LABEL}>Brief (optional)</label>
              <textarea className={INPUT} rows={2} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. push the SMS reminder benefit; autumn promo; keep it short" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button type="button" className={BTN_PRIMARY} disabled={!ready || Boolean(busy) || !layout} onClick={generate}>{busy === 'generate' ? 'Generating…' : post ? 'Generate again' : 'Generate'}</button>
              <span className="text-xs text-gray-500">{post ? 'Writes new copy and re-renders everything.' : 'Copy, photo and renders in one go.'}</span>
            </div>
          </section>

          {hasCopy && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className={SECTION_TITLE}>Copy</h2>
                <div className="flex gap-1">
                  {langs.map((l) => (
                    <button key={l} type="button" onClick={() => setEditLang(l)} className={`rounded-full px-3 py-1 text-xs font-semibold ${editLang === l ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{l.toUpperCase()}{l === lang && bilingual ? ' · first' : ''}</button>
                  ))}
                </div>
              </div>
              <div className="mt-3 space-y-3">
                {fields.map((f) => (
                  <div key={f}>
                    <div className="mb-1 flex items-center justify-between">
                      <label className="text-xs font-medium text-gray-500">{FIELD_LABELS[f] ?? f}</label>
                      {!FIXED_FIELDS.has(f) && (
                        <button type="button" className="flex items-center gap-1 text-xs text-brand-600 hover:underline disabled:opacity-40" disabled={Boolean(busy)} onClick={() => regenerate(f)} title="New wording for this line, both languages">
                          <RefreshIcon />{busy === `field:${f}` ? 'Rewriting…' : 'Rewrite'}
                        </button>
                      )}
                    </div>
                    {f === 'headline' || f === 'subline' ? (
                      <textarea className={INPUT} rows={2} value={currentCopy[f] ?? ''} onChange={(e) => setField(f, e.target.value)} readOnly={FIXED_FIELDS.has(f)} />
                    ) : (
                      <input className={`${INPUT} ${FIXED_FIELDS.has(f) ? 'bg-gray-50 text-gray-500' : ''}`} value={currentCopy[f] ?? ''} onChange={(e) => setField(f, e.target.value)} readOnly={FIXED_FIELDS.has(f)} />
                    )}
                  </div>
                ))}
                <div>
                  <div className="mb-1 flex items-center justify-between">
                    <label className="text-xs font-medium text-gray-500">Feed caption (both languages + hashtags)</label>
                    <button type="button" className="flex items-center gap-1 text-xs text-brand-600 hover:underline disabled:opacity-40" disabled={Boolean(busy)} onClick={() => regenerate('caption')}><RefreshIcon />{busy === 'field:caption' ? 'Rewriting…' : 'Rewrite'}</button>
                  </div>
                  <textarea className={INPUT} rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} />
                </div>
              </div>
            </section>
          )}
        </div>

        {/* ── Right: the post as it will look, then schedule ──────────── */}
        <div className="space-y-4">
          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className={SECTION_TITLE}>Preview{postProg ? ` · ${postProg.done}/${postProg.total} rendered` : ''}</h2>
              {dirty && post && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">Changes not in the design yet</span>}
            </div>
            <div className={`mt-3 grid gap-4 ${wantStory ? 'grid-cols-[minmax(0,1fr)_minmax(0,0.5625fr)]' : 'grid-cols-1'}`}>
              <div>
                <div className="mb-1 text-xs font-medium text-gray-500">Feed{bilingual ? ' · carousel' : ''}</div>
                <Carousel aspect="aspect-square" slides={slidesFor('sq')} onOpen={(s) => s.url && setPreview(s.url)} />
              </div>
              {wantStory && (
                <div>
                  <div className="mb-1 text-xs font-medium text-gray-500">Stories{bilingual ? ' · two' : ''}</div>
                  <Carousel aspect="aspect-[9/16]" slides={slidesFor('st')} onOpen={(s) => s.url && setPreview(s.url)} />
                </div>
              )}
            </div>

            {/* Photo + apply */}
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
              {photoUrl && <img src={photoUrl} alt="" className="h-12 w-12 rounded-lg object-cover" />}
              <div className="min-w-0 flex-1 text-xs text-gray-500">
                <div className="font-medium text-gray-700">Photo{photo ? '' : ' · matched to the audience'}</div>
                <div className="truncate">{photoUrl.replace(/^https?:\/\/[^/]+\//, '')}</div>
              </div>
              <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy) || photoPool.length < 2} onClick={shufflePhoto} title="Next photo for this audience"><span className="flex items-center gap-1"><RefreshIcon /> Shuffle</span></button>
              <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={() => { setPhotoUrlDraft(''); setPhotoOpen(true); }}>Change…</button>
              {post && (
                <button type="button" className={dirty ? BTN_PRIMARY : BTN_SECONDARY} disabled={!ready || working || Boolean(busy && !dirty)} onClick={apply}>{busy === 'render' ? 'Rendering…' : dirty ? 'Apply to design' : 'Re-render'}</button>
              )}
            </div>
            {post && Object.values(post.designs).some(Boolean) && (
              <p className="mt-2 text-xs text-gray-400">
                Open in Canva: {(['sq', 'st'] as Format[]).flatMap((f) => langOrder.map((l) => { const id = post.designs[f]?.[l]; return id ? <a key={`${f}-${l}`} href={`https://www.canva.com/design/${id}/edit`} target="_blank" rel="noreferrer" className="mr-2 text-brand-600 hover:underline">{STEP_LABEL[f]} {l.toUpperCase()}</a> : null; }))}
                (edits there are not pulled back; change the copy here and apply).
              </p>
            )}
            {!post && <p className="mt-2 text-xs text-gray-400">Showing the template as published in Canva. Generate fills it with copy for this audience and a matching photo.</p>}
          </section>

          {post && rendered && (
            <section className="rounded-xl border border-gray-200 bg-white p-4">
              <h2 className={SECTION_TITLE}>Schedule or post</h2>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className={LABEL}>Post at (your local time)</label>
                  <input type="datetime-local" className={INPUT} value={when} onChange={(e) => setWhen(e.target.value)} />
                </div>
                <div className="flex items-end">
                  <div className="flex flex-wrap gap-2">
                    <button type="button" className={BTN_PRIMARY} disabled={Boolean(busy) || !when || dirty} onClick={() => schedule(post)}>{post.status === 'scheduled' ? 'Reschedule' : 'Schedule'}</button>
                    <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy) || !cat.instagram || dirty} onClick={() => publishNow(post)}>Post now</button>
                    {post.status === 'scheduled' && <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={() => act(post, { action: 'unschedule' }, 'Unschedule')}>Unschedule</button>}
                    <button type="button" className={BTN_DANGER} disabled={Boolean(busy)} onClick={() => remove(post)}>Delete</button>
                  </div>
                </div>
              </div>
              <p className="mt-2 text-xs text-gray-500">
                {dirty ? 'Apply the changes to the design first. ' : ''}
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
          <select className={SELECT} value={filter} onChange={(e) => setFilter(e.target.value as Filter)}>
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
          <p className="text-sm text-gray-400">{posts.length === 0 ? 'Nothing yet. Generated posts show up here with their status.' : 'Nothing matches this filter.'}</p>
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

      {/* Photo picker */}
      <Modal open={photoOpen} onClose={() => setPhotoOpen(false)} title="Choose a photo" width="max-w-2xl" footer={<button type="button" className={BTN_SECONDARY} onClick={() => setPhotoOpen(false)}>Cancel</button>}>
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {[...photoPool, ...cat.photos.filter((p) => !photoPool.includes(p))].map((p) => (
            <button key={p.url} type="button" onClick={() => choosePhoto(p.url)} className={`overflow-hidden rounded-lg border-2 ${photoUrl === p.url ? 'border-brand-600' : 'border-transparent hover:border-gray-300'}`} title={p.name}>
              <img src={p.url} alt={p.name} className="aspect-square w-full object-cover" loading="lazy" />
            </button>
          ))}
          <button type="button" onClick={() => fileRef.current?.click()} disabled={busy === 'upload'} className="flex aspect-square items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-xs font-medium text-gray-500 hover:border-brand-400 hover:text-brand-600">
            {busy === 'upload' ? 'Uploading…' : '+ Upload'}
          </button>
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ''; }} />
        </div>
        <div className="mt-3 flex gap-2">
          <input className={INPUT} value={photoUrlDraft} onChange={(e) => setPhotoUrlDraft(e.target.value)} placeholder="…or paste a public image URL" />
          <button type="button" className={BTN_SECONDARY} disabled={!/^https?:\/\//.test(photoUrlDraft)} onClick={() => choosePhoto(photoUrlDraft.trim())}>Use</button>
        </div>
        <p className="mt-2 text-xs text-gray-400">The first {photoPool.length} match this audience by name. Wide scene shots work best; JPEG, PNG or WebP up to 8 MB.</p>
      </Modal>

      <StudioBatchModal open={batchOpen} onClose={() => setBatchOpen(false)} onStart={(req) => void startBatch(req)} verticals={cat.verticals} categories={cat.categories} tones={cat.tones} layouts={cat.layouts} cadence={cat.cadence} />
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
