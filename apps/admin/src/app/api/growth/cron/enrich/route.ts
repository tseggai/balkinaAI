import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runEnricher } from '@/lib/growth/enricher';

export const maxDuration = 300;

/**
 * POST /api/growth/cron/enrich
 * Unattended entry point for the daily Enricher Routine (Claude Code Routine or Vercel Cron).
 * Auth: `Authorization: Bearer <GROWTH_CRON_SECRET>` (also accepts Vercel's CRON_SECRET).
 * Optional JSON body: { limit?: number, segment?: 'tenant' | 'property' }.
 */
export async function POST(request: Request) {
  const secret = process.env.GROWTH_CRON_SECRET ?? process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as { limit?: number; segment?: 'tenant' | 'property' };

  try {
    const result = await runEnricher(createAdminClient(), {
      limit: typeof body.limit === 'number' ? body.limit : 40,
      segment: body.segment === 'tenant' || body.segment === 'property' ? body.segment : undefined,
    });
    return NextResponse.json({ ...result, llm_configured: Boolean(process.env.OPENAI_API_KEY) });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Enricher failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel Cron calls with GET.
export const GET = POST;
