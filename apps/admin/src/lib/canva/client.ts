/* Canva Connect API: OAuth (PKCE), token refresh, brand templates, autofill, export, and render-to-storage. */
import { createHash, randomBytes } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';

const AUTHORIZE = 'https://www.canva.com/api/oauth/authorize';
const TOKEN = 'https://api.canva.com/rest/v1/oauth/token';
const API = 'https://api.canva.com/rest/v1';
export const RENDER_BUCKET = 'ig-renders';

export const CANVA_SCOPES = [
  'design:content:read',
  'design:content:write',
  'design:meta:read',
  'brandtemplate:meta:read',
  'brandtemplate:content:read',
  'asset:read',
  'asset:write',
];

export function canvaConfigured(): boolean {
  return Boolean(process.env.CANVA_CLIENT_ID && process.env.CANVA_CLIENT_SECRET);
}

export function redirectUri(): string {
  return process.env.CANVA_REDIRECT_URI ?? 'https://admin.balkina.ai/api/admin/canva/callback';
}

/* ---------- OAuth ---------- */

export function pkcePair(): { verifier: string; challenge: string } {
  const verifier = randomBytes(64).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function authorizeUrl(state: string, challenge: string): string {
  const q = new URLSearchParams({
    code_challenge: challenge,
    code_challenge_method: 's256',
    scope: CANVA_SCOPES.join(' '),
    response_type: 'code',
    client_id: process.env.CANVA_CLIENT_ID ?? '',
    state,
    redirect_uri: redirectUri(),
  });
  return `${AUTHORIZE}?${q.toString()}`;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  token_type: string;
  scope?: string;
}

async function tokenRequest(params: Record<string, string>): Promise<TokenResponse> {
  const basic = Buffer.from(`${process.env.CANVA_CLIENT_ID}:${process.env.CANVA_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(TOKEN, {
    method: 'POST',
    headers: { Authorization: `Basic ${basic}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });
  const json = (await res.json().catch(() => ({}))) as TokenResponse & { error?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new Error(`Canva token: ${json.error_description ?? json.error ?? res.statusText}`);
  return json;
}

export async function exchangeCode(code: string, verifier: string): Promise<TokenResponse> {
  return tokenRequest({ grant_type: 'authorization_code', code, code_verifier: verifier, redirect_uri: redirectUri() });
}

interface ConnectionRow {
  access_token: string;
  refresh_token: string;
  expires_at: string;
  scope: string | null;
  user_id: string | null;
  team_id: string | null;
  connected_at: string;
}

export async function saveTokens(supabase: SupabaseClient, t: TokenResponse, ids?: { user_id?: string; team_id?: string }): Promise<void> {
  const expires_at = new Date(Date.now() + (t.expires_in - 60) * 1000).toISOString();
  const { error } = await supabase
    .from('canva_connection')
    .upsert({ id: 1, access_token: t.access_token, refresh_token: t.refresh_token, expires_at, scope: t.scope ?? null, ...ids, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw new Error(`Saving Canva tokens: ${error.message}`);
}

export async function loadConnection(supabase: SupabaseClient): Promise<ConnectionRow | null> {
  const { data } = await supabase.from('canva_connection').select('*').eq('id', 1).maybeSingle();
  return (data as ConnectionRow | null) ?? null;
}

/** Valid access token, refreshing (and persisting the rotated refresh token) when needed. */
export async function accessToken(supabase: SupabaseClient): Promise<string> {
  const c = await loadConnection(supabase);
  if (!c) throw new Error('Canva is not connected');
  if (Date.parse(c.expires_at) > Date.now()) return c.access_token;
  const t = await tokenRequest({ grant_type: 'refresh_token', refresh_token: c.refresh_token });
  await saveTokens(supabase, t);
  return t.access_token;
}

/* ---------- REST helpers ---------- */

async function api<T>(token: string, path: string, init?: { method?: string; body?: unknown }): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    method: init?.method ?? 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(init?.body ? { 'Content-Type': 'application/json' } : {}) },
    body: init?.body ? JSON.stringify(init.body) : undefined,
  });
  const json = (await res.json().catch(() => ({}))) as T & { code?: string; message?: string };
  if (!res.ok) throw new Error(`Canva ${path}: ${json.message ?? json.code ?? res.statusText}`);
  return json;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function poll<T extends { job: { status: string; error?: { code?: string; message?: string } } }>(token: string, path: string, timeoutMs = 90_000): Promise<T> {
  const started = Date.now();
  for (;;) {
    const r = await api<T>(token, path);
    if (r.job.status === 'success') return r;
    if (r.job.status === 'failed') throw new Error(`Canva job ${path}: ${r.job.error?.message ?? r.job.error?.code ?? 'failed'}`);
    if (Date.now() - started > timeoutMs) throw new Error(`Canva job ${path} timed out`);
    await sleep(1500);
  }
}

export async function me(token: string): Promise<{ user_id?: string; team_id?: string }> {
  const r = await api<{ team_user?: { user_id?: string; team_id?: string } }>(token, '/users/me');
  return r.team_user ?? {};
}

export interface BrandTemplate {
  id: string;
  title: string;
  thumbnail?: { url: string; width: number; height: number };
  updated_at?: number;
}

export async function listBrandTemplates(token: string): Promise<BrandTemplate[]> {
  const out: BrandTemplate[] = [];
  let continuation: string | undefined;
  do {
    const q = new URLSearchParams({ dataset: 'non_empty', limit: '100', ...(continuation ? { continuation } : {}) });
    const r = await api<{ items: BrandTemplate[]; continuation?: string }>(token, `/brand-templates?${q.toString()}`);
    out.push(...r.items);
    continuation = r.continuation;
  } while (continuation);
  return out;
}

export async function getDataset(token: string, brandTemplateId: string): Promise<Record<string, string>> {
  const r = await api<{ dataset?: Record<string, { type: string }> }>(token, `/brand-templates/${brandTemplateId}/dataset`);
  return Object.fromEntries(Object.entries(r.dataset ?? {}).map(([k, v]) => [k, v.type]));
}

export async function uploadAssetFromUrl(token: string, url: string, name: string): Promise<string> {
  const start = await api<{ job: { id: string; status: string } }>(token, '/url-asset-uploads', { method: 'POST', body: { name: name.slice(0, 255), url } });
  const done = await poll<{ job: { status: string; asset?: { id: string }; error?: { message?: string } } }>(token, `/url-asset-uploads/${start.job.id}`);
  if (!done.job.asset?.id) throw new Error('Canva asset upload returned no asset id');
  return done.job.asset.id;
}

export type AutofillValue = { type: 'text'; text: string } | { type: 'image'; asset_id: string };

export async function autofill(token: string, brandTemplateId: string, data: Record<string, AutofillValue>, title?: string): Promise<string> {
  const start = await api<{ job: { id: string } }>(token, '/autofills', { method: 'POST', body: { brand_template_id: brandTemplateId, data, ...(title ? { title } : {}) } });
  const done = await poll<{ job: { status: string; result?: { design?: { id: string } }; error?: { message?: string } } }>(token, `/autofills/${start.job.id}`);
  const id = done.job.result?.design?.id;
  if (!id) throw new Error('Canva autofill returned no design id');
  return id;
}

export async function exportJpg(token: string, designId: string, quality = 90): Promise<string> {
  const start = await api<{ job: { id: string } }>(token, '/exports', { method: 'POST', body: { design_id: designId, format: { type: 'jpg', quality } } });
  const done = await poll<{ job: { status: string; urls?: string[]; error?: { message?: string } } }>(token, `/exports/${start.job.id}`);
  const url = done.job.urls?.[0];
  if (!url) throw new Error('Canva export returned no URL');
  return url;
}

/** Download a temporary Canva export and store it in the public ig-renders bucket. Returns the public URL. */
export async function storeRender(supabase: SupabaseClient, exportUrl: string, path: string): Promise<string> {
  const res = await fetch(exportUrl);
  if (!res.ok) throw new Error(`Downloading export: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const { error } = await supabase.storage.from(RENDER_BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
  if (error) throw new Error(`Storing render: ${error.message}`);
  return supabase.storage.from(RENDER_BUCKET).getPublicUrl(path).data.publicUrl;
}

export interface RenderInput {
  brandTemplateId: string;
  fields: Record<string, string>;      // dataset types by field name
  text: Record<string, string>;        // text field values
  photoUrl?: string;                   // public URL for the `photo` image field
  title?: string;
  storagePath: string;                 // e.g. renders/2026/10/abc-sq.jpg
}

/** Fill a brand template, export it as JPEG, store it, and return the public URL + design id. */
export async function renderTemplate(supabase: SupabaseClient, input: RenderInput): Promise<{ url: string; designId: string }> {
  const token = await accessToken(supabase);
  const data: Record<string, AutofillValue> = {};
  for (const [name, type] of Object.entries(input.fields)) {
    if (type === 'text' && input.text[name] !== undefined) data[name] = { type: 'text', text: input.text[name] ?? '' };
    if (type === 'image' && name === 'photo' && input.photoUrl) {
      data[name] = { type: 'image', asset_id: await uploadAssetFromUrl(token, input.photoUrl, `balkina-${Date.now()}`) };
    }
  }
  const designId = await autofill(token, input.brandTemplateId, data, input.title);
  const exportUrl = await exportJpg(token, designId);
  const url = await storeRender(supabase, exportUrl, input.storagePath);
  return { url, designId };
}
