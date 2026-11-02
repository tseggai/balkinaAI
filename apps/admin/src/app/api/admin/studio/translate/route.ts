import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { translateField } from '@/lib/ig/studio';

export const maxDuration = 30;

const Body = z.object({
  field: z.string().min(1),
  from: z.enum(['sr', 'en']),
  to: z.array(z.enum(['sr', 'en'])).min(1),
  text: z.string().min(1).max(400),
  layout: z.string().min(1),
  vertical: z.string().min(1),
  tone: z.string().min(1),
  current: z.record(z.enum(['sr', 'en']), z.record(z.string(), z.string())).optional(),
});

// POST /api/admin/studio/translate — a line edited by hand in one language, written in the other language with the same meaning.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
  try {
    const text = await translateField(parsed.data);
    return NextResponse.json({ text });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
