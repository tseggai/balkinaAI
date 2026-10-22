import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { igCredentials } from '@/lib/ig/publish';
import { findRow, igConfig, jobsFor, publishRow } from '@/lib/ig/runner';

export const maxDuration = 300;

const Body = z.object({
  set: z.number().int().min(1).max(2),
  file: z.string().min(1),
  kinds: z.array(z.enum(['feed', 'story'])).min(1).default(['feed', 'story']),
});

// POST /api/admin/ig/publish — publish one plan row now (feed and/or story). Already-published kinds are skipped.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  const { set, file, kinds } = parsed.data;

  const picked = findRow(set, file);
  if (!picked) return NextResponse.json({ error: 'Unknown row' }, { status: 404 });
  const creds = igCredentials();
  if (!creds) return NextResponse.json({ error: 'META_IG_USER_ID / META_IG_ACCESS_TOKEN are not set in this deployment' }, { status: 500 });

  const cfg = igConfig();
  const scheduledFor = new Date().toISOString().slice(0, 10);
  const results = await publishRow(auth.supabase, creds, picked.row, jobsFor(picked.row, picked.index, cfg, kinds), scheduledFor);
  return NextResponse.json({ results });
}
