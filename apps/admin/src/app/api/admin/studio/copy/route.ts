import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { generateCopy, recentPosts, templatesFor, textFieldsOf } from '@/lib/ig/studio';

export const maxDuration = 60;

const Body = z.object({
  vertical: z.string().min(1),
  tone: z.string().min(1),
  layout: z.string().min(1),
  brief: z.string().max(1000).optional(),
  langs: z.array(z.enum(['sr', 'en'])).min(1).default(['sr', 'en']),
  only: z.array(z.string()).optional(),
  angle: z.string().max(40).optional(),
  current: z.object({ copy: z.record(z.enum(['sr', 'en']), z.record(z.string(), z.string())).optional(), caption: z.string().nullable().optional(), angle: z.string().max(40).nullable().optional() }).optional(),
});

// POST /api/admin/studio/copy — write the image copy (per language) and a feed caption for a layout.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  try {
    const { sq, st } = await templatesFor(auth.supabase, parsed.data.layout);
    if (!sq) return NextResponse.json({ error: `No square template synced for layout "${parsed.data.layout}"` }, { status: 400 });
    const fields = textFieldsOf(sq, st);
    // What the latest posts said and which ideas they used, so this one covers a different capability in different words.
    const recent = await recentPosts(auth.supabase);
    const mine = Object.values(parsed.data.current?.copy ?? {}).map((c) => c?.headline ?? '').filter(Boolean);
    const result = await generateCopy({ ...parsed.data, angle: parsed.data.angle || undefined, fields, avoid: Array.from(new Set([...mine, ...recent.headlines])), recentAngles: recent.angles });
    return NextResponse.json({ ...result, fields });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
