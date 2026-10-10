import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { runEnricher } from '@/lib/growth/enricher';

export const maxDuration = 300;

const bodySchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  prospect_ids: z.array(z.string().uuid()).max(100).optional(),
  segment: z.enum(['tenant', 'property']).optional(),
});

// POST /api/admin/growth/enricher — enrich the next batch of un-enriched prospects (admin session)
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = bodySchema.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  try {
    const result = await runEnricher(auth.supabase, {
      limit: parsed.data.limit,
      prospectIds: parsed.data.prospect_ids,
      segment: parsed.data.segment,
    });
    return NextResponse.json({ ...result, llm_configured: Boolean(process.env.OPENAI_API_KEY) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Enricher failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
