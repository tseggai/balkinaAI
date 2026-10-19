import { createClient } from '@supabase/supabase-js';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

// Funnel events written to growth_events (one row per hit; page views are
// de-duplicated per prospect per hour so reloads don't inflate the funnel).
const EVENT_TYPES = [
  'claim_page_view',
  'claim_demo_opened',
  'claim_demo_completed',
  'claim_clicked',
  'claim_whatsapp_support',
  'claim_share_copy',
  'claim_share_whatsapp',
  'claim_share_native',
  'claim_dashboard_opened',
] as const;

const DEDUPE_MS = 60 * 60 * 1000;

const bodySchema = z.object({
  token: z.string().regex(/^[a-f0-9]{48}$/),
  type: z.enum(EVENT_TYPES),
  payload: z.record(z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
});

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ ok: false }, { status: 400 });
  const { token, type, payload } = parsed.data;

  try {
    const supabase = getSupabase();
    const { data: prospect } = await supabase.from('growth_prospects').select('id').eq('claim_token', token).maybeSingle();
    if (!prospect) return Response.json({ ok: false }, { status: 404 });

    if (type === 'claim_page_view') {
      const since = new Date(Date.now() - DEDUPE_MS).toISOString();
      const { data: recent } = await supabase
        .from('growth_events')
        .select('id')
        .eq('prospect_id', prospect.id)
        .eq('type', type)
        .gte('created_at', since)
        .limit(1);
      if (recent?.length) return Response.json({ ok: true, deduped: true });
    }

    await supabase.from('growth_events').insert({
      prospect_id: prospect.id,
      type,
      channel: 'web',
      payload: { ...(payload ?? {}), ua: (request.headers.get('user-agent') ?? '').slice(0, 160) },
    });
    return Response.json({ ok: true });
  } catch (err) {
    console.error('[claim-event]', err);
    return Response.json({ ok: false }, { status: 500 });
  }
}
