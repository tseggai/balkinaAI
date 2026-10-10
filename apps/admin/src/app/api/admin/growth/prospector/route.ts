import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { runProspector } from '@/lib/growth/prospector';

export const maxDuration = 300; // Vercel: allow a long batch

const bodySchema = z.object({
  limit: z.number().int().min(1).max(100).default(10),
  target_ids: z.array(z.string().uuid()).max(100).optional(),
  max_pages: z.number().int().min(1).max(3).default(3),
  segment: z.enum(['tenant', 'property']).optional(),
});

// POST /api/admin/growth/prospector — run the next batch of search targets (admin session)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = bodySchema.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  try {
    const result = await runProspector(auth.supabase, {
      limit: parsed.data.limit,
      targetIds: parsed.data.target_ids,
      maxPages: parsed.data.max_pages,
      segment: parsed.data.segment,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prospector failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
