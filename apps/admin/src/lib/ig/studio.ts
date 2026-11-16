/* Instagram studio: write copy (audience playbook in ./audience, model from STUDIO_LLM_MODEL), render it through Canva brand templates (per format and
   language, one render per request), publish (feed = SR→EN carousel, stories = one per language), batch
   scheduling, and due-post selection for the cron. Rows live in ig_posts (Migrations 074–075). */
import type { SupabaseClient } from '@supabase/supabase-js';
import { RENDER_BUCKET, renderTemplate } from '@/lib/canva/client';
import { EXAMPLES, OPPORTUNITIES, audienceFor, opportunityByKey, pickOpportunity } from './audience';
import { categoryOf, copyLimits, eyebrowFor, matchPhotos, studioHashtags, verticalByValue, type StudioVertical } from './categories';
import { fieldBudget, fitProblems } from './overlay';
import { publishCarousel, publishImage, type IgCredentials } from './publish';
import { zonedToUtc, type Kind } from './schedule';

export type Lang = 'sr' | 'en';
export type Format = 'sq' | 'st';
export type PostStatus = 'draft' | 'scheduled' | 'published' | 'failed' | 'cancelled';
export type StudioCopy = Record<string, string>;
export const LANGS: Lang[] = ['sr', 'en'];

export { CATEGORIES, VERTICALS, categoryOf, eyebrowFor } from './categories';
export { OPPORTUNITIES };
export type { StudioVertical };

export const TONES: { value: string; label: string; hint: string }[] = [
  { value: 'friendly', label: 'Friendly', hint: 'warm, plain words, speaks to the owner directly' },
  { value: 'bold', label: 'Bold', hint: 'short punchy claims, confident, no fluff' },
  { value: 'premium', label: 'Premium', hint: 'calm, elegant, understated, high-end salon feel' },
  { value: 'playful', label: 'Playful', hint: 'light, witty, one smile per post, never silly' },
  { value: 'calm', label: 'Calm', hint: 'soft and reassuring, wellness vocabulary, slow pace' },
];

export interface Photo { name: string; url: string; source: 'stock' | 'upload' }
export const STOCK_PHOTOS: Photo[] = [
  'account-bookkeeper-h', 'account-writing-h', 'barber', 'barber-shave-h1', 'barber-shave-h2', 'bike-rental-phone-h', 'boat-sea-friends-h',
  'boat-yacht-sunset-h', 'brow-treatment-h', 'cafe-barista-coffee-h', 'camera-studio-h', 'car-wash-gun-h', 'cater-buffet-h', 'cater-waiter-canape-h',
  'chef-plating-h', 'chef-restaurant-kitchen-h', 'class-grammar-h', 'clean-home-h', 'clean-kitchen-worktop-h', 'coffee-barista-female-h',
  'counsel-psychologist-couch-h', 'counsel-talking-therapist-h', 'counsel-therapy-office-h', 'customer-cafe-h', 'customer-lounge-h',
  'dance-ballet-instructor-h', 'dance-ballet-posture-h', 'dance-class-women-h', 'diet-nutritionist-consult-h', 'dj-deck-club-h', 'dj-female-bar-h',
  'dog-training-obstacles-h', 'dog-training-park-h', 'driving-instructor-rules-h', 'driving-lesson-dashboard-h', 'electric-basement-h',
  'electric-switchboard-h', 'estate-keys-couple-h', 'estate-showing-house-h', 'event-wedding-planner-h', 'facial-plants-h', 'facial-white-v',
  'groom-black-dog-h', 'groom-dog-salon-h', 'gym-bench-v', 'gym-cable-h', 'gym-coach-h', 'handyman-portrait-h', 'handyman-shelf-drill-h',
  'hotel-checkin-staff-h', 'hotel-reception-key-h', 'language-class-adults-h', 'lash-extension-procedure-h', 'lash-master-couch-h',
  'law-advisor-client-h', 'legal-client-desk-h', 'makeup-eyes-h', 'makeup-ringlight-h', 'martial-boxing-trainer-h', 'martial-coach-girl-h',
  'martial-thai-boxer-h', 'massage-deep-tissue-h', 'massage-therapist-spa-h', 'meal-prep-containers-h', 'meal-prep-vegetarian-h',
  'mechanic-diagnostic-h', 'mechanic-engine-smile-h', 'music-piano-lesson-h', 'nails', 'nails-loft-v', 'nails-swatches-v', 'nails-window-h',
  'nutrition-doctor-vegetables-h', 'owner-terrace-h', 'photo-studio-shoot-h', 'physio-clinic-patient-h', 'physio-therapy-side-h',
  'piano-teacher-boy-h', 'pilates-kneel-h', 'pilates-legs-h', 'pilates-window-h', 'plumb-client-house-h', 'plumb-sink-h', 'reception-card-h',
  'rental-bikes-row-h', 'restaurant-waiter-guests-h', 'restaurant-waitress-dining-h', 'salon', 'salon-client-phone-h', 'salon-loft-v',
  'salon-mirror-gold-v', 'salon-robe-v', 'spa-couple-h', 'spa-facial-window-h', 'swim-coach-pool-h', 'swim-lesson-kid-h', 'tennis-highfive-h',
  'tennis-kid-h', 'tennis-lesson-v', 'tire-change-shop-h', 'tire-mechanic-h', 'tour-guide-sightseeing-h', 'tour-tablet-street-h',
  'tutor-girl-explaining-h', 'tutor-lesson-h', 'vet-dog-check-h', 'vet-shepherd-h', 'wash-car-pro-h', 'wedding-table-h', 'yoga', 'yoga-class-h',
  'yoga-tree-v',
].map((n) => ({ name: n, url: `https://balkina.ai/ig/photos/${n}.jpg`, source: 'stock' as const }));

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
  const list = matchPhotos(pool, vertical);
  return list[seed % list.length] ?? null;
}

/** Every text field a template may ask for, with a hint for the copywriter. */
const FIELD_HINTS: Record<string, string> = {
  headline: 'the promise to the owner, max {HEADLINE} characters, one short sentence (two very short ones at most)',
  subline: 'one supporting sentence, max {SUBLINE} characters, how it works for this trade',
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

/** Per format: one URL per language, plus `base` = the same template with the photo and no text (editable preview). */
export type RenderKey = Lang | 'base';
export type Renders = Partial<Record<Format, Partial<Record<RenderKey, string>>>>;

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
  angle: string | null;               // the idea the post is about (OPPORTUNITIES key)
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
  // Newest first, so a template published twice under the same name resolves to the latest copy.
  const { data } = await supabase.from('ig_templates').select('id, brand_template_id, title, layout, format, fields').eq('layout', layout).order('updated_at', { ascending: false });
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
  /** Regenerate only these fields (plus the caption when 'caption' is listed); the rest of `current` is kept.
      A headline is never rewritten alone: it brings a new idea, so the subline and the caption are rewritten with it. */
  only?: string[];
  current?: { copy?: Partial<Record<Lang, StudioCopy>>; caption?: string | null; angle?: string | null };
  /** Idea key from OPPORTUNITIES (lib/ig/audience.ts) to write about; otherwise one is picked by rotation. */
  angle?: string;
  /** Ideas of the latest posts, newest first: the next post takes one that has not been used lately. */
  recentAngles?: string[];
  /** Headlines already used for this audience: the new post must not repeat them. */
  avoid?: string[];
}

export interface CopyResult {
  copy: Partial<Record<Lang, StudioCopy>>;
  caption: string;
  model: string;
  /** The idea the post is about (OPPORTUNITIES key). */
  angle: string | null;
}

const PRODUCT_INTRO =
  'Balkina AI (balkina.ai) is an AI booking assistant and a booking system for small service businesses in Montenegro and Serbia. ' +
  'Customers book through the Balkina app (they tell the AI what they need) or through the business\'s own booking page; ' +
  'the owner manages everything from a panel and the phone. Activating the booking page is free, takes about 10 seconds and needs no card.';

const LANG_NAMES: Record<Lang, string> = {
  sr: 'Serbian/Montenegrin, Latin script, ijekavian as spoken in Montenegro (prije, vrijeme, podsjetnik, obavještenje, sjutra), proper diacritics (č ć š ž đ)',
  en: 'English',
};

/** The studio's copy model: STUDIO_LLM_MODEL, else the shared GROWTH_LLM_MODEL, else gpt-4o-mini. */
const copyModel = (): string => process.env.STUDIO_LLM_MODEL ?? process.env.GROWTH_LLM_MODEL ?? 'gpt-4o-mini';

type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/** One JSON-mode chat completion; returns the raw JSON text. */
async function chatJson(messages: ChatMessage[], temperature: number): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not set in this deployment');
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model: copyModel(), temperature, response_format: { type: 'json_object' }, messages }),
  });
  if (!res.ok) throw new Error(`OpenAI: ${res.status} ${await res.text().catch(() => '')}`.slice(0, 300));
  const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  const content = json.choices?.[0]?.message?.content;
  if (!content) throw new Error('OpenAI returned no content');
  return content;
}

/** What the copywriter is told about the audience: their words and their day, not just the trade's name. */
function audienceBrief(verticalValue: string): string {
  const v = verticalByValue(verticalValue);
  const a = audienceFor(verticalValue);
  return (
    `The reader: the owner of a ${v?.label ?? verticalValue} (${v?.sr ?? verticalValue}).\n` +
    `- They call the people who book with them: ${a.customer.en} (sr: ${a.customer.sr}). Use this word.\n` +
    `- What gets booked: ${a.books.en} (sr: ${a.books.sr}).\n` +
    `- A typical moment of their day: ${a.busy}.\n` +
    `- Trade words that sound native in Serbian: ${a.words}.`
  );
}

// Filler that says nothing.
const GENERIC: RegExp[] = [/\bsave time\b/i, /uštedite vr/i, /quick and easy/i, /brz[oe] i lak[oe]/i, /waste time/i, /gubite vr/i, /made easy/i];
// Lines addressed to the business's customer instead of its owner.
const CUSTOMER_VOICE: RegExp[] = [
  /\b(book|reserve) (now|today)\b/i, /zakaži(te)?\s+(odmah|sada?|danas)\b/i, /rezerviši(te)?\s+(odmah|sada?|danas)\b/i, /^["„“”'«]/, /^(want|need|fancy) an? /i,
  /^(do you have|can i|when can i|is there)\b.*\?$/i, /^(imate li|imaš li|ima li|kad mogu|može li|mogu li)\b.*\?$/i,
];
// Ekavian forms the model slips into; the copy is ijekavian.
const EKAVIAN: [RegExp, string][] = [
  [/\bvreme\b/i, 'vrijeme'], [/\bpre\b/i, 'prije'], [/\bposle\b/i, 'poslije'], [/\bgde\b/i, 'gdje'], [/\buvek\b/i, 'uvijek'], [/\bmesto\b/i, 'mjesto'],
  [/\bpodsetni/i, 'podsjetnik'], [/\bobavešten/i, 'obavještenje'], [/\bnedelj/i, 'nedjelja'], [/\bdete\b/i, 'dijete'], [/\bvežb/i, 'vježbe'], [/\bmenja/i, 'mijenja'],
];
const HEADLINE_WORDS = 7;

/** Everything wrong with a draft that the copywriter can fix: too long, off-voice, does not fit, ekavian. */
export function copyProblems(copy: Partial<Record<Lang, StudioCopy>>, fields: string[], layout: string): string[] {
  const out: string[] = [];
  const lim = copyLimits(layout);
  for (const lang of LANGS) {
    for (const field of fields) {
      if (field !== 'headline' && field !== 'subline') continue;
      const text = (copy[lang]?.[field] ?? '').trim();
      const where = `${lang}.${field} ${JSON.stringify(text)}`;
      if (!text) { out.push(`${lang}.${field} is empty`); continue; }
      const max = field === 'headline' ? lim.headline : lim.subline;
      if (text.length > max) out.push(`${where}: ${text.length} characters, the limit is ${max}`);
      for (const p of fitProblems(layout, field, text)) out.push(`${where}: ${p}`);
      if (field === 'headline') {
        const words = text.split(/\s+/).filter(Boolean).length;
        if (words > HEADLINE_WORDS + 1) out.push(`${where}: ${words} words, a headline has ${HEADLINE_WORDS} at most`);
        if (CUSTOMER_VOICE.some((g) => g.test(text))) out.push(`${where}: this talks to the business's customer; the reader is the owner, so promise the owner what Balkina does for the business`);
      }
      if (GENERIC.some((g) => g.test(text))) out.push(`${where}: filler; say the concrete thing instead`);
      if (field === 'subline' && /^balkina/i.test(text)) out.push(`${where}: do not start with the brand name; say how it works for the owner`);
      if (lang === 'sr') for (const [re, fix] of EKAVIAN) if (re.test(text)) out.push(`${where}: ekavian form, write the ijekavian one ("${fix}")`);
    }
  }
  return out;
}

/**
 * Copy in both languages plus a bilingual feed caption. Each post promises the OWNER one Balkina capability
 * (an idea from OPPORTUNITIES, rotated so the feed covers all of them), worded for the audience's trade.
 */
export async function generateCopy(req: CopyRequest): Promise<CopyResult> {
  const model = copyModel();
  const tone = TONES.find((t) => t.value === req.tone);
  const category = categoryOf(req.vertical);
  // The eyebrow is the category name (fixed per template family), never written by the model.
  const allFields = (req.fields.length ? req.fields : ['headline', 'subline', 'url']).filter((f) => f !== 'eyebrow');
  const partial = Boolean(req.only?.length);
  // A new headline is a new idea, so its subline and the caption are written with it.
  const only = req.only?.includes('headline') ? [...req.only, 'subline', 'caption'] : req.only ?? [];
  const fields = partial ? allFields.filter((f) => only.includes(f)) : allFields;
  const wantsEyebrow = req.fields.length === 0 || req.fields.includes('eyebrow');
  const wantsCaption = !partial || only.includes('caption');
  const lim = copyLimits(req.layout);
  const room = (field: 'headline' | 'subline'): string => {
    const sq = fieldBudget(req.layout, 'sq', field);
    const st = fieldBudget(req.layout, 'st', field);
    return `it must fit both formats when word-wrapped: square = up to ${sq.maxLines} lines of about ${sq.charsPerLine} characters, story = up to ${st.maxLines} lines of about ${st.charsPerLine} characters; no single word longer than ${Math.min(sq.charsPerLine, st.charsPerLine) - 1} characters`;
  };
  const fieldSpec = fields.map((f) => {
    const hint = (FIELD_HINTS[f] ?? 'short text, max 40 characters').replace('{HEADLINE}', String(lim.headline)).replace('{SUBLINE}', String(lim.subline));
    return `- ${f}: ${hint}${f === 'headline' || f === 'subline' ? `; ${room(f)}` : ''}`;
  }).join('\n');
  const langs = LANGS; // always write both so the caption and a later language switch need no second call

  const profile = audienceFor(req.vertical);
  // The idea: forced by the request, else a fresh one when the headline is written, else the one the kept headline is about.
  const idea = opportunityByKey(req.angle)
    ?? (fields.includes('headline') ? pickOpportunity(category, req.recentAngles ?? [], req.current?.angle) : opportunityByKey(req.current?.angle) ?? null);
  const examples = EXAMPLES.filter((e) => e.vertical !== req.vertical && e.idea !== idea?.key).slice(0, 3)
    .map((e) => `- ${verticalByValue(e.vertical)?.label ?? e.vertical}: sr "${e.sr[0]}" / "${e.sr[1]}" · en "${e.en[0]}" / "${e.en[1]}"`).join('\n');

  const system =
    `You write Instagram ads for Balkina AI. ${PRODUCT_INTRO}\n` +
    'The reader of every ad is the OWNER or operator of a small business, never that business\'s customers. The ad wants the owner to activate their Balkina page.\n\n' +
    `${audienceBrief(req.vertical)}\n\n` +
    `Tone: ${tone?.label ?? req.tone} (${tone?.hint ?? ''}).\n\n` +
    'How a post is built:\n' +
    `- Headline: a very short promise to the owner about the ONE thing this post is about. ${HEADLINE_WORDS} words at most, plain and confident, in the spirit of "Let clients find and book you with AI." Start with a verb or with the benefit.\n` +
    '- Subline: one sentence that says how it works, concretely, in this trade\'s own words (their word for the customer, what gets booked, a moment of their day).\n' +
    '- Always talk to the owner ("you", "your clients"; vi / vaš). Never write in the customer\'s voice or to the customer: no "Book now", no "Want a haircut?", no quoted customer questions.\n' +
    '- Make it theirs: the same capability must read differently for a barber, a restaurant and a tyre shop. Use the trade\'s nouns, not "business", "services" or "users".\n' +
    '- One idea only. Claim exactly what is stated for this post; never add other features, prices or numbers. No filler ("save time", "quick and easy").\n' +
    '- Do not name Balkina in the headline (the logo and the URL are already on the image).\n\n' +
    'Write the Serbian FIRST, as a native Montenegrin marketer would say it (natural word order, no calques from English), then the English with the same idea (it is the second slide of the same post), never a word-for-word translation in either direction. ' +
    'Every field is a complete sentence or phrase, never cut mid-thought. No emojis in the image fields. Respect the limits strictly; shorter is better.\n' +
    'Return strict JSON: { "copy": { "<lang>": { <field>: <text>, ... } }, "caption": { "<lang>": <feed caption for the owner, 1-3 sentences that expand the same idea for this trade and invite them to activate their free page, may use one emoji, no hashtags> } } ' +
    `for these languages: ${langs.map((l) => `"${l}" = ${LANG_NAMES[l]}`).join('; ')}.\nFields per language:\n${fieldSpec}\n\n` +
    `Finished posts about OTHER ideas for OTHER trades, as the bar for voice and length (never reuse their wording):\n${examples}`;

  const kept = (l: Lang): string => JSON.stringify(Object.fromEntries(Object.entries(req.current?.copy?.[l] ?? {}).filter(([k]) => !fields.includes(k) && k !== 'eyebrow' && k !== 'url')));
  const replaced = (l: Lang): string => JSON.stringify(Object.fromEntries(Object.entries(req.current?.copy?.[l] ?? {}).filter(([k]) => fields.includes(k) && k !== 'url')));
  const keepsLines = partial && LANGS.some((l) => kept(l) !== '{}');
  const keep = partial && req.current?.copy
    ? `${keepsLines ? `\nKeep these lines as they are and make the new text fit them (do not repeat them):\n${LANGS.map((l) => `${l}: ${kept(l)}`).join('\n')}` : ''}` +
      `\nThe lines being replaced (write something clearly different, not a rephrasing):\n${LANGS.map((l) => `${l}: ${replaced(l)}`).join('\n')}`
    : '';
  const sceneText = idea?.scene ? (idea.scene === 'ask' ? `a question they answer all day: "${profile.ask}" (background only, never quote it)` : idea.scene === 'when' ? `their ${profile.customer.en} decide to book ${profile.when}` : idea.scene === 'noshow' ? `what a forgotten booking costs them: ${profile.noshow}` : `in the middle of work they are ${profile.busy}`) : '';
  const about = idea
    ? `\nThis post is about: ${idea.claim}.\nHow it works (the only facts you may use): ${idea.detail}.${sceneText ? `\nTrade detail for the subline or the caption: ${sceneText}.` : ''}`
    : '';
  const avoid = (req.avoid ?? []).filter(Boolean).slice(0, 30);
  const used = avoid.length && fields.includes('headline') ? `\nHeadlines already posted; do not reuse their wording or their sentence pattern:\n${avoid.map((h) => `- ${h}`).join('\n')}` : '';
  const user =
    `Template: ${req.layout} (category ${category}).${about}` +
    `${req.brief ? `\nBrief from the marketer (it wins where it conflicts with the above): ${req.brief}` : ''}${used}${keep}` +
    `${partial && !wantsCaption ? '\nThe caption is not needed; return an empty caption object.' : ''}`;

  type Parsed = { copy?: Partial<Record<Lang, Record<string, unknown>>>; caption?: Partial<Record<Lang, unknown>> };
  const build = (parsed: Parsed): Partial<Record<Lang, StudioCopy>> => {
    const copy: Partial<Record<Lang, StudioCopy>> = {};
    for (const lang of langs) {
      const src = parsed.copy?.[lang] ?? {};
      const out: StudioCopy = { ...(partial ? req.current?.copy?.[lang] ?? {} : {}) };
      for (const f of fields) out[f] = f === 'url' ? 'balkina.ai' : String(src[f] ?? '').trim();
      if (wantsEyebrow) out.eyebrow = eyebrowFor(category, lang);
      copy[lang] = out;
    }
    return copy;
  };

  const messages: ChatMessage[] = [{ role: 'system', content: system }, { role: 'user', content: user }];
  const first = await chatJson(messages, 0.9);
  let parsed = JSON.parse(first) as Parsed;
  let copy = build(parsed);
  const problems = copyProblems(copy, fields, req.layout);
  if (problems.length) {
    // One repair round: the model gets its own draft back with the exact lines to fix.
    const fix = `Some lines need another pass. Fix only these and return the full JSON again in the same shape, about the same idea:\n${problems.map((p) => `- ${p}`).join('\n')}`;
    try {
      const second = JSON.parse(await chatJson([...messages, { role: 'assistant', content: first }, { role: 'user', content: fix }], 0.6)) as Parsed;
      const repaired = build(second);
      if (copyProblems(repaired, fields, req.layout).length < problems.length) { parsed = second; copy = repaired; }
    } catch { /* keep the first draft */ }
  }

  const order: Lang[] = req.langs.length ? [...req.langs] : langs;
  const captionParts = order.map((l) => String(parsed.caption?.[l] ?? '').trim()).filter(Boolean);
  const caption = wantsCaption || !req.current?.caption
    ? `${captionParts.join('\n—\n')}\n\nLink u biu → balkina.ai\n\n${studioHashtags(req.vertical, Date.now() % 97).join(' ')}`
    : req.current.caption;
  return { copy, caption, model, angle: idea?.key ?? null };
}

/** What the latest posts said, so the next one says something else: every headline (both languages) and the ideas, newest first. */
export async function recentPosts(supabase: SupabaseClient, excludeId?: string): Promise<{ headlines: string[]; angles: string[] }> {
  const { data } = await supabase.from('ig_posts').select('id, copy, angle').neq('status', 'cancelled').order('created_at', { ascending: false }).limit(30);
  const headlines = new Set<string>();
  const angles: string[] = [];
  for (const row of (data ?? []) as { id: string; copy: Partial<Record<Lang, StudioCopy>> | null; angle: string | null }[]) {
    if (row.id === excludeId) continue;
    if (row.angle) angles.push(row.angle);
    for (const lang of LANGS) { const h = row.copy?.[lang]?.headline?.trim(); if (h) headlines.add(h); }
  }
  return { headlines: Array.from(headlines), angles };
}

/** A line the marketer edited in one language, carried over to the other language with the same meaning and limits. */
export async function translateField(req: { field: string; from: Lang; text: string; to: Lang[]; layout: string; vertical: string; tone: string; current?: Partial<Record<Lang, StudioCopy>> }): Promise<Partial<Record<Lang, string>>> {
  const targets = req.to.filter((l) => l !== req.from);
  if (targets.length === 0 || !req.text.trim()) return {};
  const tone = TONES.find((t) => t.value === req.tone);
  const lim = copyLimits(req.layout);
  const limit = req.field === 'headline' ? lim.headline : req.field === 'subline' ? lim.subline : 60;
  const system =
    `You localise Instagram ad copy for Balkina AI. ${PRODUCT_INTRO} The reader is the owner of the business.\n` +
    `${audienceBrief(req.vertical)}\nTone: ${tone?.label ?? req.tone} (${tone?.hint ?? ''}).\n` +
    'The marketer edited one line of the post in one language. Write the same line in the other language(s) so it says the same thing the way a native marketer would say it: ' +
    "the trade's own words, natural word order, no calques, no emojis, a complete sentence or phrase, and at most the character limit (shorter is fine). Keep the other lines of the post in mind so the voice matches. " +
    'Return strict JSON: { "<lang>": "<text>" } for exactly the requested languages.';
  const context = targets.map((l) => `${l}: ${JSON.stringify(Object.fromEntries(Object.entries(req.current?.[l] ?? {}).filter(([k]) => k !== req.field && k !== 'eyebrow' && k !== 'url')))}`).join('\n');
  const user = `Field: ${req.field} (max ${limit} characters).\nSource (${LANG_NAMES[req.from]}): ${JSON.stringify(req.text)}\nWrite it in: ${targets.map((l) => `"${l}" = ${LANG_NAMES[l]}`).join('; ')}.\nOther lines already on the post:\n${context}`;
  const parsed = JSON.parse(await chatJson([{ role: 'system', content: system }, { role: 'user', content: user }], 0.4)) as Record<string, unknown>;
  const out: Partial<Record<Lang, string>> = {};
  for (const l of targets) { const t = String(parsed[l] ?? '').trim(); if (t) out[l] = t; }
  return out;
}

/* ---------- Rendering (one format × language per call, each ~20–40 s) ---------- */

export interface RenderStep { format: Format; lang: RenderKey }

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
  // `base` = the copy fields blank (a single space; Canva rejects empty strings), so only the photo, the design
  // and the fixed URL remain — the editable preview lays the copy over it.
  const text = step.lang === 'base'
    ? Object.fromEntries(Object.entries(tpl.fields).filter(([, t]) => t === 'text').map(([k]) => [k, k === 'url' ? 'balkina.ai' : ' ']))
    : post.copy[step.lang];
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
  // The text-free base render only depends on the photo, so it survives a copy change.
  const keep = (r: Renders): Renders => (photoChanged ? {} : Object.fromEntries((['sq', 'st'] as Format[]).filter((f) => r[f]?.base).map((f) => [f, { base: r[f]?.base }])));
  const { data, error } = await supabase
    .from('ig_posts')
    .update({ ...extra, ...(photoChanged ? { canva_asset_id: null, canva_asset_photo: null } : {}), renders: keep(post.renders), designs: keep(post.designs), render_sq_url: null, render_st_url: null, design_sq_id: null, design_st_id: null, error: null, updated_at: new Date().toISOString() })
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
