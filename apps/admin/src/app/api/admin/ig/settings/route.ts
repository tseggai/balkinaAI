import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';

const Body = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  post_time: z.string().regex(/^\d{2}:\d{2}$/),
  days: z.array(z.number().int().min(1).max(7)).min(1).max(7),
  timezone: z.string().min(1),
  paused: z.boolean(),
});

// PUT /api/admin/ig/settings — cadence, time, timezone, pause. Rows without an override follow this.
export async function PUT(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid settings' }, { status: 400 });
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: parsed.data.timezone });
  } catch {
    return NextResponse.json({ error: 'Unknown timezone' }, { status: 400 });
  }
  const days = Array.from(new Set(parsed.data.days)).sort((a, b) => a - b);
  const { error } = await auth.supabase
    .from('ig_settings')
    .upsert({ id: 1, ...parsed.data, days, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
