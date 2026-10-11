import type { SupabaseClient } from '@supabase/supabase-js';
import type { GrowthEnrichment, GrowthProspect } from '@balkina/shared';

/**
 * Enricher: visits a prospect's website (and its contact page), extracts
 * emails, phones, social links and booking-widget signals deterministically,
 * then (if OPENAI_API_KEY is set) asks GPT-4o-mini for services, prices,
 * hours and the owner's name. Results land in growth_prospects.enrichment,
 * the first email becomes a growth_contacts row, and the stage moves
 * new → enriched. Never lowers a stage or overwrites hand-entered facts.
 */

const FETCH_TIMEOUT_MS = 8000;
const MAX_HTML_BYTES = 1_500_000;
const MAX_TEXT_CHARS = 20_000;
const LLM_TEXT_CHARS = 12_000;
const USER_AGENT = 'Mozilla/5.0 (compatible; BalkinaBot/1.0; +https://balkina.ai)';

const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 'fb.com', 'tiktok.com', 'linkedin.com', 'youtube.com', 'x.com', 'twitter.com'];
const NON_FETCHABLE_HOSTS = ['instagram.com', 'facebook.com', 'fb.com', 'tiktok.com', 'linktr.ee', 'wa.me', 'api.whatsapp.com'];
const COMPETITOR_WIDGETS: { host: string; name: string }[] = [
  { host: 'fresha.com', name: 'Fresha' },
  { host: 'booksy.com', name: 'Booksy' },
  { host: 'treatwell', name: 'Treatwell' },
  { host: 'simplybook', name: 'SimplyBook' },
  { host: 'calendly.com', name: 'Calendly' },
  { host: 'setmore.com', name: 'Setmore' },
  { host: 'squareup.com', name: 'Square' },
  { host: 'acuityscheduling', name: 'Acuity' },
  { host: 'zakazi', name: 'Zakazi' },
  { host: 'bokun.io', name: 'Bokun' },
  { host: 'resy.com', name: 'Resy' },
  { host: 'opentable', name: 'OpenTable' },
  { host: 'thefork', name: 'TheFork' },
];

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?:\+?\d{1,3}[\s./-]?)?(?:\(?0?\d{2,3}\)?[\s./-]?)\d{3}[\s./-]?\d{3,4}/g;
const BAD_EMAIL_PARTS = ['example.', 'sentry', 'wixpress', 'domain.com', 'email.com', '.png', '.jpg', '.svg', '.webp', 'noreply', 'no-reply', 'schema.org'];

export interface EnricherRunResult {
  processed: number;
  enriched: number;
  skipped: number;
  emails_found: number;
  contacts_created: number;
  llm_used: number;
  errors: { prospect: string; message: string }[];
}

// ─── Fetching ────────────────────────────────────────────────────────────────

async function fetchHtml(url: string): Promise<{ html: string; finalUrl: string } | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml' },
    });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    if (!type.includes('html') && !type.includes('xml')) return null;
    const buf = await res.arrayBuffer();
    const html = new TextDecoder('utf-8', { fatal: false }).decode(buf.slice(0, MAX_HTML_BYTES));
    return { html, finalUrl: res.url || url };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function normaliseUrl(raw: string): string | null {
  try {
    const u = new URL(raw.startsWith('http') ? raw : `https://${raw}`);
    return u.toString();
  } catch {
    return null;
  }
}

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '').toLowerCase(); } catch { return ''; }
}

// ─── Parsing ─────────────────────────────────────────────────────────────────

function decodeEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

export function htmlToText(html: string): string {
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<br\s*\/?>|<\/(p|div|li|tr|h[1-6]|section|article|header|footer)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ');
  return decodeEntities(stripped).replace(/[ \t\u00a0]+/g, ' ').replace(/\s*\n\s*/g, '\n').trim().slice(0, MAX_TEXT_CHARS);
}

function extractLinks(html: string, baseUrl: string): string[] {
  const out = new Set<string>();
  const re = /href\s*=\s*["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const href = m[1];
    if (!href || href.startsWith('#') || href.startsWith('javascript:')) continue;
    try { out.add(new URL(href, baseUrl).toString()); } catch { /* ignore */ }
  }
  return Array.from(out);
}

function meta(html: string, name: string): string | null {
  const re = new RegExp(`<meta[^>]+(?:name|property)=["']${name}["'][^>]*content=["']([^"']*)["']`, 'i');
  const re2 = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:name|property)=["']${name}["']`, 'i');
  const m = html.match(re) ?? html.match(re2);
  return m?.[1] ? decodeEntities(m[1]).trim() : null;
}

function extractEmails(text: string, html: string): string[] {
  const found = new Set<string>();
  for (const src of [text, html]) {
    for (const e of src.match(EMAIL_RE) ?? []) {
      const email = e.toLowerCase();
      if (BAD_EMAIL_PARTS.some((b) => email.includes(b))) continue;
      found.add(email);
    }
  }
  // Prefer info@/kontakt@/office@ style addresses first.
  return Array.from(found).sort((a, b) => rankEmail(a) - rankEmail(b)).slice(0, 5);
}

function rankEmail(e: string): number {
  const local = e.split('@')[0] ?? '';
  if (/^(info|kontakt|contact|office|hello|zdravo|booking|rezervacije|salon)/.test(local)) return 0;
  if (/^(admin|webmaster|support|privacy|legal|gdpr)/.test(local)) return 2;
  return 1;
}

function extractPhones(text: string, html: string): string[] {
  const found = new Set<string>();
  for (const m of html.match(/href=["']tel:([^"']+)["']/gi) ?? []) {
    const n = m.replace(/.*tel:/i, '').replace(/["']/g, '').replace(/[^\d+]/g, '');
    if (n.length >= 8) found.add(n);
  }
  for (const m of text.match(PHONE_RE) ?? []) {
    const n = m.replace(/[^\d+]/g, '');
    if (n.length >= 9 && n.length <= 15) found.add(n);
  }
  return Array.from(found).slice(0, 5);
}

function extractSocials(links: string[]): GrowthEnrichment['socials'] {
  const socials: GrowthEnrichment['socials'] = {};
  for (const l of links) {
    const host = hostOf(l);
    const path = (() => { try { return new URL(l).pathname; } catch { return ''; } })();
    const segments = path.split('/').filter(Boolean);
    // Facebook's legacy /pg/<page>/... URLs put the page name second.
    const handle = segments[0] === 'pg' ? segments[1] : segments[0];
    if (host === 'instagram.com' && handle && !['p', 'reel', 'explore', 'accounts'].includes(handle)) socials.instagram ??= handle;
    else if ((host === 'facebook.com' || host === 'fb.com') && handle && !['sharer', 'share', 'plugins', 'profile.php'].includes(handle)) socials.facebook ??= handle;
    else if (host === 'wa.me' || host === 'api.whatsapp.com') socials.whatsapp ??= l.replace(/[^\d]/g, '') || l;
    else if (host === 'tiktok.com' && handle) socials.tiktok ??= handle.replace(/^@/, '');
    else if (host === 'linkedin.com' && path.includes('/company/')) socials.linkedin ??= l;
  }
  return socials;
}

function detectBookingWidget(links: string[], html: string): string | null {
  const hay = (links.join(' ') + ' ' + html.slice(0, 200_000)).toLowerCase();
  for (const w of COMPETITOR_WIDGETS) if (hay.includes(w.host)) return w.name;
  if (hay.includes('balkina.ai')) return 'Balkina';
  return null;
}

function findContactPage(links: string[], baseUrl: string): string | null {
  const base = hostOf(baseUrl);
  return (
    links.find((l) => hostOf(l) === base && /kontakt|contact|o-nama|about|cenovnik|cjenovnik|usluge|services|price/i.test(l)) ?? null
  );
}

// ─── LLM extraction (optional) ───────────────────────────────────────────────

interface LlmExtraction {
  owner_name?: string | null;
  services?: { name: string; price?: number | null; currency?: string | null; duration_minutes?: number | null }[];
  hours?: Record<string, string> | null;
  languages?: string[];
  summary?: string | null;
}

async function llmExtract(text: string, prospect: Pick<GrowthProspect, 'name' | 'vertical' | 'city' | 'country'>): Promise<{ data: LlmExtraction; model: string } | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || text.length < 200) return null;
  const model = process.env.GROWTH_LLM_MODEL ?? 'gpt-4o-mini';

  const system =
    'You extract structured facts about a local service business from its website text. ' +
    'Return strict JSON with keys: owner_name (string|null), services (array of {name, price (number|null), currency (ISO code|null), duration_minutes (number|null)}, max 25), ' +
    'hours (object day->"HH:MM-HH:MM" or null), languages (array of ISO 639-1 codes the site is written in), summary (one sentence, in English). ' +
    'Only include services and prices that appear in the text. Never invent data.';
  const user = `Business: ${prospect.name} (${prospect.vertical ?? 'unknown vertical'}, ${prospect.city ?? ''} ${prospect.country?.toUpperCase() ?? ''}).\n\nWebsite text:\n${text.slice(0, LLM_TEXT_CHARS)}`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        model,
        temperature: 0,
        response_format: { type: 'json_object' },
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) return null;
    const data = JSON.parse(content) as LlmExtraction;
    if (!Array.isArray(data.services)) data.services = [];
    data.services = data.services.filter((s) => s && typeof s.name === 'string' && s.name.trim()).slice(0, 25);
    return { data, model };
  } catch {
    return null;
  }
}

// ─── Per-prospect enrichment ─────────────────────────────────────────────────

export async function enrichProspect(prospect: GrowthProspect): Promise<GrowthEnrichment> {
  const website = prospect.website ? normaliseUrl(prospect.website) : null;
  const enrichment: GrowthEnrichment = {
    fetched_at: new Date().toISOString(),
    fetched_url: website,
    emails: [],
    phones: [],
    socials: {},
    booking_widget: null,
    services: [],
  };

  if (!website) {
    enrichment.skipped = 'no_website';
    return enrichment;
  }
  const host = hostOf(website);
  if (NON_FETCHABLE_HOSTS.some((h) => host === h || host.endsWith(`.${h}`))) {
    enrichment.skipped = 'social_only';
    if (host.includes('instagram.com')) enrichment.socials.instagram = new URL(website).pathname.split('/').filter(Boolean)[0] ?? undefined;
    if (host.includes('facebook.com')) enrichment.socials.facebook = new URL(website).pathname.split('/').filter(Boolean)[0] ?? undefined;
    return enrichment;
  }

  const home = await fetchHtml(website);
  if (!home) {
    enrichment.error = 'fetch_failed';
    return enrichment;
  }
  enrichment.fetched_url = home.finalUrl;

  let html = home.html;
  const links = extractLinks(home.html, home.finalUrl);
  const contactUrl = findContactPage(links, home.finalUrl);
  if (contactUrl && contactUrl !== home.finalUrl) {
    const contact = await fetchHtml(contactUrl);
    if (contact) {
      html += '\n' + contact.html;
      enrichment.contact_url = contact.finalUrl;
      links.push(...extractLinks(contact.html, contact.finalUrl));
    }
  }

  const text = htmlToText(html);
  enrichment.title = (home.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim().slice(0, 200) || null;
  enrichment.description = meta(home.html, 'description') ?? meta(home.html, 'og:description');
  enrichment.lang = home.html.match(/<html[^>]+lang=["']([a-zA-Z-]+)["']/)?.[1]?.toLowerCase().slice(0, 5) ?? null;
  enrichment.emails = extractEmails(text, html);
  enrichment.phones = extractPhones(text, html);
  enrichment.socials = extractSocials(links.filter((l) => SOCIAL_HOSTS.some((h) => hostOf(l) === h || hostOf(l).endsWith(`.${h}`)) || /wa\.me|whatsapp/.test(l)));
  enrichment.booking_widget = detectBookingWidget(links, html);
  enrichment.text_chars = text.length;

  const llm = await llmExtract(text, prospect);
  if (llm) {
    enrichment.llm_model = llm.model;
    enrichment.owner_name = llm.data.owner_name ?? null;
    enrichment.services = llm.data.services ?? [];
    enrichment.hours = llm.data.hours ?? null;
    enrichment.languages = llm.data.languages ?? [];
    enrichment.summary = llm.data.summary ?? null;
  }

  return enrichment;
}

// ─── Batch runner ────────────────────────────────────────────────────────────

export async function runEnricher(
  supabase: SupabaseClient,
  opts: { limit?: number; prospectIds?: string[]; targetIds?: string[]; concurrency?: number; segment?: 'tenant' | 'property' } = {}
): Promise<EnricherRunResult> {
  const limit = Math.max(1, Math.min(opts.limit ?? 20, 100));
  const concurrency = Math.max(1, Math.min(opts.concurrency ?? 4, 8));
  const result: EnricherRunResult = { processed: 0, enriched: 0, skipped: 0, emails_found: 0, contacts_created: 0, llm_used: 0, errors: [] };

  let query = supabase
    .from('growth_prospects')
    .select('*')
    .is('enriched_at', null)
    .not('stage', 'in', '("disqualified","lost")')
    .order('icp_score', { ascending: false })
    .order('google_review_count', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (opts.prospectIds?.length) query = supabase.from('growth_prospects').select('*').in('id', opts.prospectIds);
  if (opts.targetIds?.length) query = query.in('search_target_id', opts.targetIds);
  if (opts.segment) query = query.eq('segment', opts.segment);

  const { data, error } = await query;
  if (error) throw new Error(`Failed to load prospects: ${error.message}`);
  const prospects = (data ?? []) as GrowthProspect[];

  const queue = [...prospects];
  const worker = async () => {
    while (queue.length) {
      const p = queue.shift();
      if (!p) break;
      try {
        const enrichment = await enrichProspect(p);
        result.processed++;
        if (enrichment.skipped) result.skipped++; else result.enriched++;
        if (enrichment.llm_model) result.llm_used++;
        result.emails_found += enrichment.emails.length;

        const updates: Record<string, unknown> = {
          enrichment,
          enriched_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        if (!p.email && enrichment.emails[0]) updates.email = enrichment.emails[0];
        if (!p.instagram && enrichment.socials.instagram) updates.instagram = enrichment.socials.instagram;
        if (!p.phone && enrichment.phones[0]) updates.phone = enrichment.phones[0];
        if (p.stage === 'new') updates.stage = 'enriched';

        // One-time score adjustments (guarded by enriched_at being null on load).
        let delta = 0;
        if (enrichment.emails.length) delta += 1;
        if ((enrichment.services?.length ?? 0) >= 3) delta += 2;
        if (enrichment.booking_widget && enrichment.booking_widget !== 'Balkina') delta -= 3;
        if (enrichment.error === 'fetch_failed') delta -= 1;
        if (delta) updates.icp_score = p.icp_score + delta;

        const { error: upErr } = await supabase.from('growth_prospects').update(updates).eq('id', p.id);
        if (upErr) { result.errors.push({ prospect: p.name, message: upErr.message }); continue; }

        const email = (updates.email as string | undefined) ?? p.email ?? enrichment.emails[0];
        if (email) {
          const { data: existing } = await supabase.from('growth_contacts').select('id').ilike('email', email).limit(1);
          if (!existing?.length) {
            const { error: cErr } = await supabase.from('growth_contacts').insert({
              prospect_id: p.id,
              name: enrichment.owner_name ?? null,
              title: enrichment.owner_name ? 'Owner' : null,
              email,
              phone: enrichment.phones[0] ?? p.phone ?? null,
              language: enrichment.lang?.slice(0, 2) || (p.country === 'hr' ? 'hr' : 'sr'),
              source: 'website',
            });
            if (!cErr) result.contacts_created++;
          }
        }
      } catch (err) {
        result.errors.push({ prospect: p.name, message: err instanceof Error ? err.message : String(err) });
      }
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length || 1) }, worker));
  return result;
}
