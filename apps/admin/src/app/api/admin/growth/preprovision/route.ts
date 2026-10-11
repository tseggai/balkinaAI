import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { runPreprovisioner } from '@/lib/growth/preprovision';

export const maxDuration = 300;

const bodySchema = z.object({
  prospect_ids: z.array(z.string().uuid()).max(100).optional(),
  limit: z.number().int().min(1).max(100).default(20),
  min_score: z.number().int().optional(),
  segment: z.enum(['tenant', 'property']).optional(),
});

// POST /api/admin/growth/preprovision — build unclaimed booking pages for prospects
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = bodySchema.safeParse((await request.json().catch(() => ({}))) ?? {});
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid body' }, { status: 400 });
  }

  try {
    const result = await runPreprovisioner(auth.supabase, {
      prospectIds: parsed.data.prospect_ids,
      limit: parsed.data.limit,
      minScore: parsed.data.min_score,
      segment: parsed.data.segment,
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Pre-provisioner failed' }, { status: 500 });
  }
}
