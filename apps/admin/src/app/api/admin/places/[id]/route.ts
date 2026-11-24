import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { refreshPlaces } from '@/lib/places';
import type { PlaceRow } from '@balkina/shared';

export const maxDuration = 60;

const Patch = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('update'),
    name: z.string().trim().min(2).max(60).optional(),
    refers_to: z.string().trim().max(120).nullable().optional(),
    tagline: z.string().trim().max(140).nullable().optional(),
    photo_url: z.string().url().max(500).nullable().optional().or(z.literal('')),
    lat: z.number().min(-90).max(90).optional(),
    lng: z.number().min(-180).max(180).optional(),
    radius_km: z.number().positive().max(25).optional(),
    need_total: z.number().int().min(1).max(500).optional(),
    need_dining: z.number().int().min(0).max(200).optional(),
    need_care: z.number().int().min(0).max(200).optional(),
    need_active: z.number().int().min(0).max(200).optional(),
  }),
  // Publishing below Level 1 needs `force`: the row would promise more than the place holds.
  z.object({ action: z.literal('publish'), force: z.boolean().optional() }),
  z.object({ action: z.literal('unpublish') }),
  z.object({ action: z.literal('watch') }),     // draft → watching
  z.object({ action: z.literal('official') }),  // the owner signed: the place is their official one
]);

// PATCH /api/admin/places/:id — edit a place or move it between draft, watching, live and official.
export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Patch.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid request', issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  const db = () => auth.supabase.from('places');
  const { data: row } = await db().select('*').eq('id', params.id).maybeSingle();
  const place = row as PlaceRow | null;
  if (!place) return NextResponse.json({ error: 'Place not found' }, { status: 404 });
  const now = new Date().toISOString();

  let update: Record<string, unknown>;
  switch (b.action) {
    case 'update': {
      const { action: _action, ...fields } = b;
      update = { ...fields, ...(fields.photo_url === '' ? { photo_url: null } : {}) };
      break;
    }
    case 'publish': {
      // Measure now, so the decision rests on today's businesses and not on stored numbers.
      const report = await refreshPlaces(auth.supabase);
      const fresh = report.places.find((p) => p.id === place.id)?.fresh;
      if (!fresh?.level1 && !b.force) return NextResponse.json({ error: `${place.name} has not reached Level 1 yet`, needsForce: true, stats: fresh ?? null }, { status: 409 });
      update = { status: 'live', hidden: false, published_at: place.published_at ?? now };
      break;
    }
    case 'unpublish': update = { status: 'watching', hidden: false }; break;
    case 'watch': update = { status: 'watching' }; break;
    case 'official': update = { status: 'official', hidden: false, published_at: place.published_at ?? now }; break;
  }
  const { error } = await db().update({ ...update, updated_at: now }).eq('id', place.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

// DELETE /api/admin/places/:id — remove a place that customers cannot see.
export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const { data: row } = await auth.supabase.from('places').select('status').eq('id', params.id).maybeSingle();
  const status = (row as { status: string } | null)?.status;
  if (!status) return NextResponse.json({ error: 'Place not found' }, { status: 404 });
  if (status === 'live' || status === 'official') return NextResponse.json({ error: 'Unpublish the place before deleting it' }, { status: 409 });
  const { error } = await auth.supabase.from('places').delete().eq('id', params.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
