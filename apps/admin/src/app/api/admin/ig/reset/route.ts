import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { findRow, rowKey } from '@/lib/ig/runner';

const Body = z.object({
  set: z.number().int().min(1).max(2),
  file: z.string().min(1),
  kinds: z.array(z.enum(['feed', 'story'])).min(1).default(['feed', 'story']),
});

// POST /api/admin/ig/reset — forget the log for a row so the cron (or "Post now") will publish it again.
// Does not delete anything on Instagram.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const picked = findRow(parsed.data.set, parsed.data.file);
  if (!picked) return NextResponse.json({ error: 'Unknown row' }, { status: 404 });

  const keys = parsed.data.kinds.map((k) => rowKey(picked.row, k));
  const { error } = await auth.supabase.from('ig_publish_log').delete().in('key', keys);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, keys });
}
