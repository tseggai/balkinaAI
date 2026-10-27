/* Instagram studio: write copy with GPT-4o-mini, render it through Canva brand templates (per format and
   language, one render per request), publish (feed = SR→EN carousel, stories = one per language), batch
   scheduling, and due-post selection for the cron. Rows live in ig_posts (Migrations 074–075). */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RENDER_BUCKET, renderTemplate } from '@/lib/canva/client';
import { categoryOf, eyebrowFor, studioHashtags, verticalByValue, type StudioVertical } from './categories';
import { publishCarousel, publishImage, type IgCredentials } from './publish';
import { zonedToUtc, type Kind } from './schedule';

export type Lang = 'sr' | 'en';
export type Format = 'sq' | 'st';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
export type StudioCopy = Record<string, string>;
export const LANGS: Lang[] = ['sr', 'en'];

export { CATEGORIES, VERTICALS, categoryOf, eyebrowFor } from './categories';
export type { StudioVertical };

export const TONES: { value: string; label: string; hint: string }[] = [
  { value: 'friendly', label: 'Friendly', hint: 'warm, plain words, speaks to the owner directly' },
  { value: 'bold', label: 'Bold', hint: 'short punchy claims, confident, no fluff' },
  { value: 'premium', label: 'Premium', hint: 'calm, elegant, understated, high-end salon feel' },
  { value: 'playful', label: 'Playful', hint: 'light, witty, one smile per post, never silly' },
  { value: 'calm', label: 'Calm', hint: 'soft and reassuring, wellness vocabulary, slow pace' },
];

export interface Photo { name: string; url: string; source: 'stock' | 'upload' }
export const STOCK_PHOTOS: Photo[] = ['barber', 'salon', 'nails', 'yoga'].map((n) => ({ name: n, url: `https://balkina.ai/ig/photos/${n}.jpg`, source: 'stock' }));

/** Stock photos plus everything uploaded through the studio (ig-renders/photos/). */
export async function listPhotos(supabase: SupabaseClient): Promise<Photo[]> {
  const { data } = await supabase.storage.from(RENDER_BUCKET).list('photos', { limit: 200, sortBy: { column: 'created_at', order: 'desc' } });
  const uploads: Photo[] = (data ?? [])
    .filter((f) => f.name && !f.name.startsWith('.'))
    .map((f) => ({ name: f.name.replace(/^\d+-/, '').replace(/\.[a-z0-9]+$/i, ''), url: supabase.storage.from(RENDER_BUCKET).getPublicUrl(`photos/${f.name}`).data.publicUrl, source: 'upload' as const }));
  return [...uploads, ...STOCK_PHOTOS];
}

/** Pick a photo for an audience from the pool: a name that mentions one of its photo words wins, otherwise round-robin by `seed`. */
export function pickPhoto(pool: Photo[], vertical: string, seed: number): Photo | null {
  if (pool.length === 0) return null;
  const words = verticalByValue(vertical)?.photo ?? [];
  const matching = pool.filter((p) => words.some((w) => p.name.toLowerCase().includes(w)));
  const list = matching.length ? matching : pool;
  return list[seed % list.length] ?? null;
}

/** Every text field a template may ask for, with a hint for the copywriter. */
const FIELD_HINTS: Record<string, string> = {
  headline: 'the hook, max 60 characters, two short sentences at most',
  subline: 'one supporting sentence, max 70 characters, says what Balkina gives them',
  url: 'always exactly "balkina.ai"',
  button: 'call-to-action button label with an arrow, max 24 characters (e.g. "Napravite stranicu →")',
  big: 'one big number or very short stat, max 6 characters (e.g. "24/7", "20 s", "0 €")',
  step1_title: 'step 1 title, max 22 characters',
  step1_text: 'step 1 one-liner, max 40 characters',
  step2_title: 'step 2 title, max 22 characters',
  step2_text: 'step 2 one-liner, max 40 characters',
  step3_title: 'step 3 title, max 22 characters',
  step3_text: 'step 3 one-liner, max 40 characters',
};

export type Renders = Partial<Record<Format, Partial<Record<Lang, string>>>>;

export interface StudioPost {
  id: string;
  created_at: string;
  updated_at: string;
  status: PostStatus;
  vertical: string;
  tone: string;
  lang: Lang;             // primary language: first carousel slide, first story
  langs: Lang[];          // languages rendered and posted
  layout: string;
  brief: string | null;
  copy: Partial<Record<Lang, StudioCopy>>;
  caption: string | null;
  photo_url: string;
  template_sq_id: string | null;
  template_st_id: string | null;
  render_sq_url: string | null;   // primary-language renders (thumbnails, back-compat)
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
  attempted_at: string | null;
  canva_asset_id: string | null;      // the photo uploaded to Canva once per post…
  canva_asset_photo: string | null;   // …for this photo_url
}

interface TemplateRow {
  id: string;
  brand_template_id: string;
  title: string;
  layout: string;
  format: Format;
  fields: Record<string, string>;
}

/** Square + story templates for a layout (story optional). */
export async function templatesFor(supabase: SupabaseClient, layout: string): Promise<{ sq: TemplateRow | null; st: TemplateRow | null }> {
  const { data } = await supabase.from('ig_templates').select('id, brand_template_id, title, layout, format, fields').eq('layout', layout);
  const rows = (data ?? []) as TemplateRow[];
  return { sq: rows.find((r) => r.format === 'sq') ?? null, st: rows.find((r) => r.format === 'st') ?? null };
}

/** Text field names the given templates need, in a stable order. */
export function textFieldsOf(...templates: (TemplateRow | null)[]): string[] {
  const names = new Set<string>();
  for (const t of templates) for (const [k, v] of Object.entries(t?.fields ?? {})) if (v === 'text') names.add(k);
  const order = Object.keys(FIELD_HINTS);
  return Array.from(names).sort((a, b) => (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b)));
}

/** Languages in posting order: primary first. */
export function langOrder(post: Pick<StudioPost, 'lang' | 'langs'>): Lang[] {
  const set = post.langs.length ? post.langs : [post.lang];
  return [post.lang, ...set.filter((l) => l !== post.lang)].filter((l, i, a) => set.includes(l) && a.indexOf(l) === i);
}

/* ---------- Copywriting ---------- */

export interface CopyRequest {
  vertical: string;
  tone: string;
  layout: string;
  fields: string[];
  brief?: string;
  langs: Lang[];
}

export interface CopyResult {
  copy: Partial<Record<Lang, StudioCopy>>;
  caption: string;
  model: string;
}

const PRODUCT_FACTS =
  'Balkina AI (balkina.ai) gives small service businesses a free online booking page: customers book in 20 seconds, 24/7, ' +
  'without calling; the owner gets a notification on the phone; SMS confirmation right away and a reminder the day before cut no-shows; ' +
  'one link works in the Instagram bio, on the Google profile and on WhatsApp; activation is free, no card, about 10 seconds. ' +
  'Primary market: Montenegro and Serbia. Never invent prices, numbers or features beyond these.';

/** Ask GPT-4o-mini for on-brand copy in both languages plus a bilingual feed caption. */
export async function generateCopy(req: CopyRequest): Promise<CopyResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set in this deployment');
  const model = process.env.GROWTH_LLM_MODEL ?? 'gpt-4o-mini';
  const vertical = verticalByValue(req.vertical);
  const tone = TONES.find((t) => t.value === req.tone);
  const category = categoryOf(req.vertical);
  // The eyebrow is the category name (fixed per template family), never written by the model.
  const fields = (req.fields.length ? req.fields : ['headline', 'subline', 'url']).filter((f) => f !== 'eyebrow');
  const wantsEyebrow = req.fields.length === 0 || req.fields.includes('eyebrow');
  const fieldSpec = fields.map((f) => `- ${f}: ${FIELD_HINTS[f] ?? 'short text, max 40 characters'}`).join('\n');
  const langNames: Record<Lang, string> = { sr: 'Serbian (Latin script, natural Montenegrin/Serbian marketing voice)', en: 'English' };
  const langs = LANGS; // always write both so the caption and a later language switch need no second call

  const system =
    `You write Instagram ad copy for Balkina AI. ${PRODUCT_FACTS}\n` +
    `Audience: owners of a ${vertical?.label ?? req.vertical} (${vertical?.sr ?? req.vertical}). Tone: ${tone?.label ?? req.tone} — ${tone?.hint ?? ''}.\n` +
    'Write for a small business owner, in the second person, concrete and specific to their day. The English version must say the same thing as the Serbian one (it is the second slide of the same post), not a different idea. No emojis in the image fields. ' +
    'Respect the character limits strictly; shorter is better. Serbian uses proper diacritics (č ć š ž đ).\n' +
    'Return strict JSON: { "copy": { "<lang>": { <field>: <text>, ... } }, "caption": { "<lang>": <feed caption 1-3 sentences, may use one emoji, no hashtags> } } ' +
    `for these languages: ${langs.map((l) => `"${l}" = ${langNames[l]}`).join('; ')}.\nFields per language:\n${fieldSpec}`;
  const user = `Template: ${req.layout} (category ${category}).${req.brief ? `\nBrief from the marketer: ${req.brief}` : '\nNo extra brief; pick one concrete benefit and build the post around it.'}`;

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, temperature: 0.8, response_format: { type: 'json_object' }, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content');
  const parsed = JSON.parse(content) as { copy?: Partial<Record<Lang, Record<string, unknown>>>; caption?: Partial<Record<Lang, unknown>> };

  const copy: Partial<Record<Lang, StudioCopy>> = {};
  for (const lang of langs) {
    const src = parsed.copy?.[lang] ?? {};
    const out: StudioCopy = {};
    for (const f of fields) out[f] = f === 'url' ? 'balkina.ai' : String(src[f] ?? '').trim();
    if (wantsEyebrow) out.eyebrow = eyebrowFor(category, lang);
    copy[lang] = out;
  }
  const order: Lang[] = req.langs.length ? [...req.langs] : langs;
  const captionParts = order.map((l) => String(parsed.caption?.[l] ?? '').trim()).filter(Boolean);
  const caption = `${captionParts.join('\n—\n')}\n\nLink u biu → balkina.ai\n\n${studioHashtags(req.vertical, Date.now() % 97).join(' ')}`;
  return { copy, caption, model };
}

/* ---------- Rendering (one format × language per call, each ~20–40 s) ---------- */

export interface RenderStep { format: Format; lang: Lang }

/** Steps still missing for a post, given which templates its layout has. */
export function pendingRenders(post: StudioPost, has: { sq: boolean; st: boolean }): RenderStep[] {
  const out: RenderStep[] = [];
  for (const format of ['sq', 'st'] as Format[]) {
    if (!has[format]) continue;
    if (format === 'st' && !post.kinds.includes('story')) continue;
    for (const lang of langOrder(post)) if (!post.renders[format]?.[lang]) out.push({ format, lang });
  }
  return out;
}

/**
 * Render one format in one language and merge it into the row. Renders of the same post run in
 * parallel (one request each), so the merge is an atomic jsonb update (ig_posts_set_render) and the
 * photo's Canva asset is cached on the row after the first upload.
 */
export async function renderOne(supabase: SupabaseClient, post: StudioPost, step: RenderStep): Promise<StudioPost> {
  const { sq, st } = await templatesFor(supabase, post.layout);
  const tpl = step.format === 'sq' ? sq : st;
  if (!tpl) throw new Error(`No ${step.format === 'sq' ? 'square' : 'story'} template synced for layout "${post.layout}"`);
  const text = post.copy[step.lang];
  if (!text) throw new Error(`No ${step.lang.toUpperCase()} copy on this post`);
  const cachedAsset = post.canva_asset_id && post.canva_asset_photo === post.photo_url ? post.canva_asset_id : undefined;
  const r = await renderTemplate(supabase, {
    brandTemplateId: tpl.brand_template_id,
    fields: tpl.fields,
    text,
    photoUrl: post.photo_url,
    photoAssetId: cachedAsset,
    title: `Studio · ${post.layout} ${step.format} ${step.lang} · ${post.id.slice(0, 8)}`,
    storagePath: `posts/${post.id}-${step.format}-${step.lang}.jpg`,
  });
  if (r.photoAssetId && !cachedAsset) {
    await supabase.from('ig_posts').update({ canva_asset_id: r.photoAssetId, canva_asset_photo: post.photo_url }).eq('id', post.id);
  }
  const url = `${r.url}?v=${Date.now()}`;
  const { data, error } = await supabase.rpc('ig_posts_set_render', { p_id: post.id, p_format: step.format, p_lang: step.lang, p_url: url, p_design: r.designId, p_template: tpl.id });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as StudioPost | undefined;
  if (!row) throw new Error('Post disappeared while rendering');
  return row;
}

/** Forget every render (after copy or photo changed) so the steps run again. A new photo also drops the cached asset. */
export async function clearRenders(supabase: SupabaseClient, post: StudioPost, extra: Record<string, unknown> = {}): Promise<StudioPost> {
  const photoChanged = typeof extra.photo_url === 'string' && extra.photo_url !== post.photo_url;
  const { data, error } = await supabase
    .from('ig_posts')
    .update({ ...extra, ...(photoChanged ? { canva_asset_id: null, canva_asset_photo: null } : {}), renders: {}, designs: {}, render_sq_url: null, render_st_url: null, design_sq_id: null, design_st_id: null, error: null, updated_at: new Date().toISOString() })
    .eq('id', post.id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return data as StudioPost;
}

/* ---------- Publishing ---------- */

export interface PostOutcome {
  kind: Kind;
  lang?: Lang;
  status: 'published' | 'skipped' | 'failed';
  media_id?: string;
  error?: string;
}

/** Image URLs in posting order for a format: primary language first. */
function imagesFor(post: StudioPost, format: Format): { lang: Lang; url: string }[] {
  return langOrder(post).map((lang) => ({ lang, url: post.renders[format]?.[lang] ?? '' })).filter((x) => x.url);
}

/**
 * Publish what is still pending: the feed as a carousel when two languages are rendered (single image
 * otherwise), then one story per language. Updates media ids, status, error and attempts.
 */
export async function publishPost(supabase: SupabaseClient, creds: IgCredentials, post: StudioPost, kinds: Kind[] = post.kinds): Promise<{ post: StudioPost; results: PostOutcome[] }> {
  const now = new Date().toISOString();
  await supabase.from('ig_posts').update({ attempts: post.attempts + 1, attempted_at: now, error: null, updated_at: now }).eq('id', post.id);
  const results: PostOutcome[] = [];
  const patch: Record<string, unknown> = {};

  if (kinds.includes('feed') && post.kinds.includes('feed')) {
    if (post.feed_published_at) results.push({ kind: 'feed', status: 'skipped' });
    else {
      const images = imagesFor(post, 'sq');
      if (images.length === 0) results.push({ kind: 'feed', status: 'failed', error: 'No square render' });
      else {
        try {
          const r = images.length >= 2
            ? await publishCarousel(creds, { imageUrls: images.map((i) => i.url), caption: post.caption ?? undefined })
            : await publishImage(creds, { kind: 'feed', imageUrl: images[0]?.url ?? '', caption: post.caption ?? undefined });
          patch.feed_media_id = r.mediaId;
          patch.feed_published_at = new Date().toISOString();
          results.push({ kind: 'feed', status: 'published', media_id: r.mediaId });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          patch.error = message;
          results.push({ kind: 'feed', status: 'failed', error: message });
        }
      }
    }
  }

  if (kinds.includes('story') && post.kinds.includes('story')) {
    const images = imagesFor(post, 'st');
    if (images.length === 0) results.push({ kind: 'story', status: 'failed', error: 'No story render' });
    for (const [i, img] of images.entries()) {
      const col = i === 0 ? 'story' : 'story2';
      const done = i === 0 ? post.story_published_at : post.story2_published_at;
      if (done) { results.push({ kind: 'story', lang: img.lang, status: 'skipped' }); continue; }
      try {
        const r = await publishImage(creds, { kind: 'story', imageUrl: img.url });
        patch[`${col}_media_id`] = r.mediaId;
        patch[`${col}_published_at`] = new Date().toISOString();
        results.push({ kind: 'story', lang: img.lang, status: 'published', media_id: r.mediaId });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        patch.error = message;
        results.push({ kind: 'story', lang: img.lang, status: 'failed', error: message });
      }
    }
  }

  const storyCount = imagesFor(post, 'st').length;
  const feedDone = !post.kinds.includes('feed') || Boolean(post.feed_published_at || patch.feed_published_at);
  const storyDone = !post.kinds.includes('story') || (Boolean(post.story_published_at || patch.story_published_at) && (storyCount < 2 || Boolean(post.story2_published_at || patch.story2_published_at)));
  const failed = results.some((r) => r.status === 'failed');
  patch.status = feedDone && storyDone ? 'published' : failed && post.attempts + 1 >= MAX_ATTEMPTS ? 'failed' : post.status === 'draft' ? 'draft' : 'scheduled';
  const { data } = await supabase.from('ig_posts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', post.id).select('*').single();
  return { post: (data as StudioPost | null) ?? post, results };
}

const GRACE_MS = 36 * 3600 * 1000;
const RETRY_MS = 2 * 3600 * 1000;
const MAX_ATTEMPTS = 3;
const MAX_PER_RUN = 3;

/** Scheduled studio posts whose time has passed (within the grace window) and which can still be attempted. */
export async function duePosts(supabase: SupabaseClient, now = new Date()): Promise<StudioPost[]> {
  const t = now.getTime();
  const { data } = await supabase
    .from('ig_posts')
    .select('*')
    .eq('status', 'scheduled')
    .lte('scheduled_at', now.toISOString())
    .gte('scheduled_at', new Date(t - GRACE_MS).toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(20);
  return ((data ?? []) as StudioPost[])
    .filter((p) => p.attempts < MAX_ATTEMPTS && (!p.attempted_at || t - Date.parse(p.attempted_at) > RETRY_MS))
    .slice(0, MAX_PER_RUN);
}

/* ---------- Batches ---------- */

export interface BatchCadence {
  start_date: string;   // YYYY-MM-DD (local)
  post_time: string;    // HH:MM (local)
  days: number[];       // ISO weekdays 1–7
  timezone: string;
  per_day?: number;     // posts per posting day (default 1); extra posts go out `gap_minutes` apart
  gap_minutes?: number;
}

/** Posting instants (ISO UTC) for `count` posts on the cadence, skipping instants already taken. */
export function batchSlots(c: BatchCadence, count: number, taken: Set<string> = new Set()): string[] {
  const allowed = new Set(c.days.length ? c.days : [1, 2, 3, 4, 5, 6, 7]);
  const perDay = Math.max(1, Math.min(6, c.per_day ?? 1));
  const gap = Math.max(15, c.gap_minutes ?? 180);
  const out: string[] = [];
  const d = new Date(`${c.start_date}T00:00:00Z`);
  let guard = 0;
  while (out.length < count && guard++ < 1000) {
    const iso = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
    if (allowed.has(iso)) {
      const base = zonedToUtc(d.toISOString().slice(0, 10), c.post_time, c.timezone).getTime();
      for (let i = 0; i < perDay && out.length < count; i++) {
        const at = new Date(base + i * gap * 60_000).toISOString();
        if (!taken.has(at)) out.push(at);
      }
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}
