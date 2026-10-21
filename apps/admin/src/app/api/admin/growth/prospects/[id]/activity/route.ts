import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';

/**
 * Prospect activity (CRM timeline).
 * GET  /api/admin/growth/prospects/:id/activity — events, newest first
 * POST /api/admin/growth/prospects/:id/activity — log a manual touch
 *      { type: 'sent'|'replied'|'note'|'call', channel?, text?, step?, lang?, next_follow_up_at? }
 * The growth_events trigger (Migration 070) moves the stage and updates the
 * engagement counters; the response returns the refreshed prospect row.
 */

const uuid = z.string().uuid();

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  if (!uuid.safeParse(params.id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('growth_events')
    .select('id, type, channel, payload, created_at')
    .eq('prospect_id', params.id)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ data });
}

const bodySchema = z.object({
  type: z.enum(['sent', 'replied', 'note', 'call']),
  channel: z.enum(['whatsapp', 'instagram', 'email', 'phone', 'other']).optional(),
  text: z.string().max(4000).optional(),
  step: z.enum(['first', 'follow_up', 'last_chance']).optional(),
  lang: z.enum(['sr', 'en']).optional(),
  next_follow_up_at: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function POST(request: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  if (!uuid.safeParse(params.id).success) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  const { type, channel, text, step, lang, next_follow_up_at } = parsed.data;
  if (type === 'note' && !text?.trim()) return NextResponse.json({ error: 'Note text is required' }, { status: 400 });

  const { error: insertError } = await auth.supabase.from('growth_events').insert({
    prospect_id: params.id,
    type,
    channel: channel ?? (type === 'call' ? 'phone' : null),
    payload: {
      ...(text ? { text: text.trim() } : {}),
      ...(step ? { step } : {}),
      ...(lang ? { lang } : {}),
      by: auth.user.email ?? auth.user.id,
    },
  });
  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 });

  if (next_follow_up_at !== undefined) {
    const { error } = await auth.supabase
      .from('growth_prospects')
      .update({ next_follow_up_at, updated_at: new Date().toISOString() })
      .eq('id', params.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: prospect, error: readError } = await auth.supabase.from('growth_prospects').select('*').eq('id', params.id).single();
  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 });
  return NextResponse.json({ success: true, prospect });
}
