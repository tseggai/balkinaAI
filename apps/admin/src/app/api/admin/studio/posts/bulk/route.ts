import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';

const Body = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  action: z.enum(['shift_days', 'set_time', 'unschedule', 'cancel', 'delete', 'kinds']),
  days: z.number().int().min(-365).max(365).optional(),
  time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  tz_offset_minutes: z.number().int().min(-840).max(840).optional(),   // browser offset so "set time" means the admin's local time
  kinds: z.array(z.enum(['feed', 'story'])).min(1).optional(),
});

interface Row { id: string; status: string; scheduled_at: string | null; feed_media_id: string | null; story_media_id: string | null }

// POST /api/admin/studio/posts/bulk — adjust many studio posts at once (same verbs as the plan's bulk bar).
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body', issues: parsed.error.issues }, { status: 400 });
  const b = parsed.data;
  const { data } = await auth.supabase.from('ig_posts').select('id, status, scheduled_at, feed_media_id, story_media_id').in('id', b.ids);
  const rows = (data ?? []) as Row[];
  const now = new Date().toISOString();
  let changed = 0;

  for (const r of rows) {
    const published = Boolean(r.feed_media_id || r.story_media_id);
    if (b.action === 'delete') {
      if (published) continue;
      await auth.supabase.from('ig_posts').delete().eq('id', r.id);
      changed++;
      continue;
    }
    if (r.status === 'published' || r.status === 'cancelled') continue;
    const patch: Record<string, unknown> = { updated_at: now };
    if (b.action === 'unschedule') { patch.status = 'draft'; patch.scheduled_at = null; }
    else if (b.action === 'cancel') { patch.status = 'cancelled'; }
    else if (b.action === 'kinds') { patch.kinds = b.kinds ?? ['feed', 'story']; }
    else if (b.action === 'shift_days') {
      if (!r.scheduled_at || b.days === undefined) continue;
      patch.scheduled_at = new Date(Date.parse(r.scheduled_at) + b.days * 86_400_000).toISOString();
    } else if (b.action === 'set_time') {
      if (!r.scheduled_at || !b.time) continue;
      const [hh = 0, mm = 0] = b.time.split(':').map(Number);
      const off = b.tz_offset_minutes ?? 0;                          // minutes to add to local to get UTC (JS getTimezoneOffset convention)
      const local = new Date(Date.parse(r.scheduled_at) - off * 60_000);
      local.setUTCHours(hh, mm, 0, 0);
      patch.scheduled_at = new Date(local.getTime() + off * 60_000).toISOString();
    }
    await auth.supabase.from('ig_posts').update(patch).eq('id', r.id);
    changed++;
  }
  return NextResponse.json({ changed });
}
