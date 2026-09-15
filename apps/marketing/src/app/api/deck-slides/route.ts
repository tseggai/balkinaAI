/* eslint-disable @typescript-eslint/no-explicit-any */
import { createClient } from '@supabase/supabase-js';
import { getTemplate, type DeckId } from '@/lib/deck';

export const dynamic = 'force-dynamic';

const DECKS = new Set<DeckId>(['tenant', 'whitelabel']);

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
      { error: 'Editing not configured. Set DECK_UPLOAD_KEY in the marketing Vercel project.' },
      { status: 503 }
    );
  }
  if (request.headers.get('x-deck-key') !== configured) {
    return Response.json({ error: 'Invalid editor key.' }, { status: 401 });
  }
  return null;
}

async function listSlides(deck: DeckId) {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from('deck_slides')
    .select('id, deck, position, template, content')
    .eq('deck', deck)
    .order('position', { ascending: true });
  if (error) throw error;
  return data ?? [];
}

// GET /api/deck-slides?deck=tenant — ordered slides (public marketing copy)
export async function GET(request: Request) {
  try {
    const deck = new URL(request.url).searchParams.get('deck') as DeckId;
    if (!DECKS.has(deck)) return Response.json({ error: 'Unknown deck.' }, { status: 400 });
    return Response.json({ slides: await listSlides(deck) });
  } catch (err) {
    console.error('deck-slides GET error:', err);
    return Response.json({ error: 'Failed to load slides.' }, { status: 500 });
  }
}

// POST /api/deck-slides — { deck, template, afterId?, content? } → new slide (key-gated)
export async function POST(request: Request) {
  const denied = checkKey(request);
  if (denied) return denied;
  try {
    const { deck, template, afterId, content } = await request.json();
    if (!DECKS.has(deck)) return Response.json({ error: 'Unknown deck.' }, { status: 400 });
    const tpl = getTemplate(deck, String(template ?? ''));
    if (!tpl) return Response.json({ error: 'Unknown template.' }, { status: 400 });

    const supabase = getSupabase();
    const slides = await listSlides(deck);
    const afterIdx = afterId ? slides.findIndex((s) => s.id === afterId) : slides.length - 1;
    const position = (afterIdx >= 0 ? afterIdx : slides.length - 1) + 2; // 1-based insert after

    // Shift everything at/after the insertion point down by one.
    for (const s of slides.filter((s) => s.position >= position).sort((a, b) => b.position - a.position)) {
      await supabase.from('deck_slides').update({ position: s.position + 1 }).eq('id', s.id);
    }

    const { data, error } = await supabase
      .from('deck_slides')
      .insert({ deck, position, template: tpl.id, content: content ?? { ...tpl.blank, media: {} } })
      .select('id, deck, position, template, content')
      .single();
    if (error) throw error;
    return Response.json({ slide: data });
  } catch (err) {
    console.error('deck-slides POST error:', err);
    return Response.json({ error: 'Failed to create slide.' }, { status: 500 });
  }
}

// PATCH /api/deck-slides — { id, content } → update slide content (key-gated)
export async function PATCH(request: Request) {
  const denied = checkKey(request);
  if (denied) return denied;
  try {
    const { id, content } = await request.json();
    if (!id || typeof content !== 'object' || content === null) {
      return Response.json({ error: 'id and content are required.' }, { status: 400 });
    }
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('deck_slides')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('id, deck, position, template, content')
      .single();
    if (error) throw error;
    return Response.json({ slide: data });
  } catch (err) {
    console.error('deck-slides PATCH error:', err);
    return Response.json({ error: 'Failed to save slide.' }, { status: 500 });
  }
}

// PUT /api/deck-slides — { deck, ids: [...] } → reorder (key-gated)
export async function PUT(request: Request) {
  const denied = checkKey(request);
  if (denied) return denied;
  try {
    const { deck, ids } = await request.json();
    if (!DECKS.has(deck) || !Array.isArray(ids) || ids.length === 0) {
      return Response.json({ error: 'deck and ids are required.' }, { status: 400 });
    }
    const supabase = getSupabase();
    // Two passes avoid transient unique/ordering collisions.
    for (let i = 0; i < ids.length; i++) {
      await supabase.from('deck_slides').update({ position: 1000 + i }).eq('id', ids[i]).eq('deck', deck);
    }
    for (let i = 0; i < ids.length; i++) {
      await supabase.from('deck_slides').update({ position: i + 1 }).eq('id', ids[i]).eq('deck', deck);
    }
    return Response.json({ slides: await listSlides(deck) });
  } catch (err) {
    console.error('deck-slides PUT error:', err);
    return Response.json({ error: 'Failed to reorder slides.' }, { status: 500 });
  }
}

// DELETE /api/deck-slides — { id } (key-gated)
export async function DELETE(request: Request) {
  const denied = checkKey(request);
  if (denied) return denied;
  try {
    const { id } = await request.json();
    if (!id) return Response.json({ error: 'id is required.' }, { status: 400 });
    const supabase = getSupabase();
    const { error } = await supabase.from('deck_slides').delete().eq('id', id);
    if (error) throw error;
    return Response.json({ ok: true });
  } catch (err) {
    console.error('deck-slides DELETE error:', err);
    return Response.json({ error: 'Failed to delete slide.' }, { status: 500 });
  }
}
