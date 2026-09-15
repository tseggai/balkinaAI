import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

const BUCKET = 'deck-assets';
const DECKS = new Set(['tenant', 'whitelabel']);
const SLOT_RE = /^[a-z0-9-]{3,64}$/;
const EXT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  mp4: 'video/mp4',
  webm: 'video/webm',
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

function checkKey(request: Request): Response | null {
  const configured = process.env.DECK_UPLOAD_KEY;
  if (!configured) {
    return Response.json(
      { error: 'Uploads not configured. Set DECK_UPLOAD_KEY in the marketing Vercel project.' },
      { status: 503 }
    );
  }
  if (request.headers.get('x-deck-key') !== configured) {
    return Response.json({ error: 'Invalid upload key.' }, { status: 401 });
  }
  return null;
}

// GET /api/deck-assets?deck=tenant — public manifest of uploaded assets for a deck
export async function GET(request: Request) {
  try {
    const deck = new URL(request.url).searchParams.get('deck') ?? '';
    if (!DECKS.has(deck)) {
      return Response.json({ error: 'Unknown deck.' }, { status: 400 });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase.storage.from(BUCKET).list(deck, { limit: 100 });
    if (error) throw error;

    const base = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}`;
    const assets: Record<string, { url: string }> = {};
    for (const obj of data ?? []) {
      const dot = obj.name.lastIndexOf('.');
      if (dot < 1) continue;
      const slot = obj.name.slice(0, dot);
      if (!SLOT_RE.test(slot)) continue;
      const version = encodeURIComponent(obj.updated_at ?? obj.created_at ?? '0');
      assets[slot] = { url: `${base}/${deck}/${obj.name}?v=${version}` };
    }
    return Response.json({ assets });
  } catch (err) {
    console.error('deck-assets GET error:', err);
    return Response.json({ error: 'Failed to load assets.' }, { status: 500 });
  }
}

// POST /api/deck-assets — { deck, slot, ext } → signed upload URL (key-gated).
// The browser then PUTs the file straight to Supabase Storage, so large videos
// never pass through this serverless function's body-size limit.
export async function POST(request: Request) {
  const denied = checkKey(request);
  if (denied) return denied;
  try {
    const { deck, slot, ext } = await request.json();
    const cleanExt = String(ext ?? '').toLowerCase();
    if (!DECKS.has(deck) || !SLOT_RE.test(String(slot ?? '')) || !EXT_TYPES[cleanExt]) {
      return Response.json({ error: 'Invalid deck, slot, or file type.' }, { status: 400 });
    }
    const supabase = getSupabase();

    // One asset per slot: clear any previous file for this slot (may differ in extension).
    const { data: existing } = await supabase.storage.from(BUCKET).list(deck, { limit: 100 });
    const stale = (existing ?? [])
      .filter((o) => o.name.replace(/\.[^.]+$/, '') === slot)
      .map((o) => `${deck}/${o.name}`);
    if (stale.length) await supabase.storage.from(BUCKET).remove(stale);

    const path = `${deck}/${slot}.${cleanExt}`;
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUploadUrl(path);
    if (error) throw error;
    const publicUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${path}?v=${Date.now()}`;
    return Response.json({ signedUrl: data.signedUrl, path, publicUrl });
  } catch (err) {
    console.error('deck-assets POST error:', err);
    return Response.json({ error: 'Failed to prepare upload.' }, { status: 500 });
  }
}

// DELETE /api/deck-assets — { deck, slot } removes the slot's asset (key-gated)
export async function DELETE(request: Request) {
  const denied = checkKey(request);
  if (denied) return denied;
  try {
    const { deck, slot } = await request.json();
    if (!DECKS.has(deck) || !SLOT_RE.test(String(slot ?? ''))) {
      return Response.json({ error: 'Invalid deck or slot.' }, { status: 400 });
    }
    const supabase = getSupabase();
    const { data: existing } = await supabase.storage.from(BUCKET).list(deck, { limit: 100 });
    const targets = (existing ?? [])
      .filter((o) => o.name.replace(/\.[^.]+$/, '') === slot)
      .map((o) => `${deck}/${o.name}`);
    if (targets.length) {
      const { error } = await supabase.storage.from(BUCKET).remove(targets);
      if (error) throw error;
    }
    return Response.json({ removed: targets.length });
  } catch (err) {
    console.error('deck-assets DELETE error:', err);
    return Response.json({ error: 'Failed to remove asset.' }, { status: 500 });
  }
}
