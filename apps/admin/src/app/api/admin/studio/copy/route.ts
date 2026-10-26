import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { generateCopy, templatesFor, textFieldsOf } from '@/lib/ig/studio';

export const maxDuration = 60;

const Body = z.object({
  vertical: z.string().min(1),
  tone: z.string().min(1),
  layout: z.string().min(1),
  brief: z.string().max(1000).optional(),
  langs: z.array(z.enum(['sr', 'en'])).min(1).default(['sr', 'en']),
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
    const result = await generateCopy({ ...parsed.data, fields });
    return NextResponse.json({ ...result, fields });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
