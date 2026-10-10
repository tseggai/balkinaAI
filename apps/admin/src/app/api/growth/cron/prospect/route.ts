import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { runProspector } from '@/lib/growth/prospector';

export const maxDuration = 300;

/**
 * POST /api/growth/cron/prospect
 * Unattended entry point for the daily Prospector Routine (Claude Code Routine or Vercel Cron).
 * Auth: `Authorization: Bearer <GROWTH_CRON_SECRET>` (also accepts Vercel's CRON_SECRET).
 * Optional JSON body: { limit?: number, max_pages?: number, segment?: 'tenant' | 'property' }.
 */
export async function POST(request: Request) {
  const secret = process.env.GROWTH_CRON_SECRET ?? process.env.CRON_SECRET;
  const header = request.headers.get('authorization') ?? '';
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    limit?: number;
    max_pages?: number;
    segment?: 'tenant' | 'property';
  };

  try {
    const result = await runProspector(createAdminClient(), {
      limit: typeof body.limit === 'number' ? body.limit : 20,
      maxPages: typeof body.max_pages === 'number' ? body.max_pages : 3,
      segment: body.segment === 'tenant' || body.segment === 'property' ? body.segment : undefined,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Prospector failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Vercel Cron calls with GET.
export const GET = POST;
