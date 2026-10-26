/* Instagram studio: write copy with GPT-4o-mini, render it through Canva brand templates,
   schedule or publish, and pick due posts for the cron. Rows live in ig_posts (Migration 074). */
import type { SupabaseClient } from '@supabase/supabase-js';
import { renderTemplate } from '@/lib/canva/client';
import { hashtagsFor } from './plan';
import { publishImage, type IgCredentials } from './publish';
import type { Kind } from './schedule';

export type Lang = 'sr' | 'en';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
export type StudioCopy = Record<string, string>;

export const VERTICALS: { value: string; label: string; sr: string }[] = [
  { value: 'salon', label: 'Hair salon', sr: 'frizerski salon' },
  { value: 'barber', label: 'Barbershop', sr: 'barbershop' },
  { value: 'nails', label: 'Nail studio', sr: 'nail studio' },
  { value: 'lashes', label: 'Lashes & brows', sr: 'trepavice i obrve' },
  { value: 'makeup', label: 'Makeup artist', sr: 'šminker' },
  { value: 'beauty', label: 'Beauty salon', sr: 'salon lepote' },
  { value: 'spa', label: 'Spa & massage', sr: 'spa i masaža' },
  { value: 'yoga', label: 'Yoga studio', sr: 'joga studio' },
  { value: 'pilates', label: 'Pilates', sr: 'pilates studio' },
  { value: 'fitness', label: 'Personal trainer', sr: 'personalni trener' },
  { value: 'tennis', label: 'Tennis coach', sr: 'teniski trener' },
  { value: 'restaurant', label: 'Restaurant', sr: 'restoran' },
  { value: 'all', label: 'All businesses', sr: 'mali biznisi' },
];

export const TONES: { value: string; label: string; hint: string }[] = [
  { value: 'friendly', label: 'Friendly', hint: 'warm, plain words, speaks to the owner directly' },
  { value: 'bold', label: 'Bold', hint: 'short punchy claims, confident, no fluff' },
  { value: 'premium', label: 'Premium', hint: 'calm, elegant, understated, high-end salon feel' },
  { value: 'playful', label: 'Playful', hint: 'light, witty, one smile per post, never silly' },
  { value: 'calm', label: 'Calm', hint: 'soft and reassuring, wellness vocabulary, slow pace' },
];

export const STOCK_PHOTOS = ['barber', 'salon', 'nails', 'yoga'].map((n) => ({ name: n, url: `https://balkina.ai/ig/photos/${n}.jpg` }));

/** Every text field a template may ask for, with a hint for the copywriter. */
const FIELD_HINTS: Record<string, string> = {
  eyebrow: 'tag line above the headline, ALL CAPS, max 24 characters, names the audience (e.g. "ZA FRIZERE I BARBERE")',
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

export interface StudioPost {
  id: string;
  created_at: string;
  updated_at: string;
  status: PostStatus;
  vertical: string;
  tone: string;
  lang: Lang;
  layout: string;
  brief: string | null;
  copy: Partial<Record<Lang, StudioCopy>>;
  caption: string | null;
  photo_url: string;
  template_sq_id: string | null;
  template_st_id: string | null;
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
  attempted_at: string | null;
}

interface TemplateRow {
  id: string;
  brand_template_id: string;
  title: string;
  layout: string;
  format: 'sq' | 'st';
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

/* ---------- Copywriting ---------- */

export interface CopyRequest {
  vertical: string;
  tone: string;
  layout: string;
  fields: string[];        // text fields to produce
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

/** Ask GPT-4o-mini for on-brand copy in the requested languages plus a feed caption. */
export async function generateCopy(req: CopyRequest): Promise<CopyResult> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set in this deployment');
  const model = process.env.GROWTH_LLM_MODEL ?? 'gpt-4o-mini';
  const vertical = VERTICALS.find((v) => v.value === req.vertical);
  const tone = TONES.find((t) => t.value === req.tone);
  const fields = req.fields.length ? req.fields : ['eyebrow', 'headline', 'subline', 'url'];
  const fieldSpec = fields.map((f) => `- ${f}: ${FIELD_HINTS[f] ?? 'short text, max 40 characters'}`).join('\n');
  const langNames: Record<Lang, string> = { sr: 'Serbian (Latin script, ijekavian is fine, natural Montenegrin/Serbian marketing voice)', en: 'English' };

  const system =
    `You write Instagram ad copy for Balkina AI. ${PRODUCT_FACTS}\n` +
    `Audience: owners of a ${vertical?.label ?? req.vertical} (${vertical?.sr ?? req.vertical}). Tone: ${tone?.label ?? req.tone} — ${tone?.hint ?? ''}.\n` +
    'Write for a small business owner, in the second person, concrete and specific to their day. No emojis in the image fields. ' +
    'Respect the character limits strictly; shorter is better. Serbian uses proper diacritics (č ć š ž đ).\n' +
    'Return strict JSON: { "copy": { "<lang>": { <field>: <text>, ... } }, "caption": { "<lang>": <feed caption 1-3 sentences, may use one emoji, no hashtags> } } ' +
    `for these languages: ${req.langs.map((l) => `"${l}" = ${langNames[l]}`).join('; ')}.\nFields per language:\n${fieldSpec}`;
  const user = `Layout: ${req.layout}.${req.brief ? `\nBrief from the marketer: ${req.brief}` : '\nNo extra brief; pick one concrete benefit and build the post around it.'}`;

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
  for (const lang of req.langs) {
    const src = parsed.copy?.[lang] ?? {};
    const out: StudioCopy = {};
    for (const f of fields) out[f] = f === 'url' ? 'balkina.ai' : String(src[f] ?? '').trim();
    copy[lang] = out;
  }
  const captionParts = req.langs.map((l) => String(parsed.caption?.[l] ?? '').trim()).filter(Boolean);
  const caption = `${captionParts.join('\n—\n')}\n\nLink u biu → balkina.ai\n\n${hashtagsFor(req.vertical, Date.now() % 97).join(' ')}`;
  return { copy, caption, model };
}

/* ---------- Rendering ---------- */

/** Render the square (and story, when a template exists) for a post and store the URLs on the row. */
export async function renderPost(supabase: SupabaseClient, post: StudioPost): Promise<StudioPost> {
  const { sq, st } = await templatesFor(supabase, post.layout);
  if (!sq) throw new Error(`No square template synced for layout "${post.layout}"`);
  const text = post.copy[post.lang] ?? {};
  const patch: Partial<StudioPost> = { template_sq_id: sq.id, template_st_id: st?.id ?? null };

  const r1 = await renderTemplate(supabase, { brandTemplateId: sq.brand_template_id, fields: sq.fields, text, photoUrl: post.photo_url, title: `Studio · ${post.layout} · ${post.id.slice(0, 8)}`, storagePath: `posts/${post.id}-sq.jpg` });
  patch.render_sq_url = `${r1.url}?v=${Date.now()}`;
  patch.design_sq_id = r1.designId;
  if (st) {
    const r2 = await renderTemplate(supabase, { brandTemplateId: st.brand_template_id, fields: st.fields, text, photoUrl: post.photo_url, title: `Studio · ${post.layout} story · ${post.id.slice(0, 8)}`, storagePath: `posts/${post.id}-st.jpg` });
    patch.render_st_url = `${r2.url}?v=${Date.now()}`;
    patch.design_st_id = r2.designId;
  } else {
    patch.render_st_url = null;
    patch.design_st_id = null;
  }
  const { data, error } = await supabase.from('ig_posts').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', post.id).select('*').single();
  if (error) throw new Error(error.message);
  return data as StudioPost;
}

/* ---------- Publishing ---------- */

export interface PostOutcome {
  kind: Kind;
  status: 'published' | 'skipped' | 'failed';
  media_id?: string;
  error?: string;
}

/** Publish the requested kinds of a post that are not out yet; updates status, media ids, error and attempts. */
export async function publishPost(supabase: SupabaseClient, creds: IgCredentials, post: StudioPost, kinds: Kind[] = post.kinds): Promise<{ post: StudioPost; results: PostOutcome[] }> {
  const now = new Date().toISOString();
  await supabase.from('ig_posts').update({ attempts: post.attempts + 1, attempted_at: now, error: null, updated_at: now }).eq('id', post.id);
  const results: PostOutcome[] = [];
  const patch: Record<string, unknown> = {};
  for (const kind of kinds) {
    if (!post.kinds.includes(kind)) continue;
    const done = kind === 'feed' ? post.feed_published_at : post.story_published_at;
    if (done) { results.push({ kind, status: 'skipped' }); continue; }
    const imageUrl = kind === 'feed' ? post.render_sq_url : post.render_st_url;
    if (!imageUrl) { results.push({ kind, status: 'failed', error: `No ${kind === 'feed' ? 'square' : 'story'} render` }); continue; }
    try {
      const r = await publishImage(creds, { kind, imageUrl, caption: kind === 'feed' ? post.caption ?? undefined : undefined });
      patch[`${kind}_media_id`] = r.mediaId;
      patch[`${kind}_published_at`] = new Date().toISOString();
      results.push({ kind, status: 'published', media_id: r.mediaId });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      patch.error = message;
      results.push({ kind, status: 'failed', error: message });
    }
  }
  const feedDone = Boolean(post.feed_published_at || patch.feed_published_at) || !post.kinds.includes('feed');
  const storyDone = Boolean(post.story_published_at || patch.story_published_at) || !post.kinds.includes('story');
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
