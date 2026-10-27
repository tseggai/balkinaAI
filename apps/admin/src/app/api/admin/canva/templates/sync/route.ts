import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { accessToken, getDataset, listBrandTemplates } from '@/lib/canva/client';

export const maxDuration = 120;

// Titles like "IG · 02 beauty · square" / "IG - beauty - story" → { layout: 'beauty', format: 'sq' }.
// The word is a category key (lib/ig/categories.ts) or a legacy shape layout; the number is optional and only orders the list.
const TITLE = /^IG\s*[·\-–]\s*(?:\d{1,2}\s+)?([a-z]+)\s*[·\-–]\s*(square|story)\s*$/i;

// POST /api/admin/canva/templates/sync — pull brand templates named "IG · NN category · square|story" and their datasets.
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  try {
    const token = await accessToken(auth.supabase);
    const all = await listBrandTemplates(token);
    const matched = all.map((t) => ({ t, m: TITLE.exec(t.title.trim()) })).filter((x): x is { t: (typeof all)[number]; m: RegExpExecArray } => Boolean(x.m));
    const rows = [];
    for (const { t, m } of matched) {
      const fields = await getDataset(token, t.id);
      rows.push({
        brand_template_id: t.id,
        title: t.title.trim(),
        layout: (m[1] ?? '').toLowerCase(),
        format: (m[2] ?? '').toLowerCase() === 'story' ? 'st' : 'sq',
        fields,
        thumbnail_url: t.thumbnail?.url ?? null,
        updated_at: new Date().toISOString(),
      });
    }
    if (rows.length) {
      const { error } = await auth.supabase.from('ig_templates').upsert(rows, { onConflict: 'brand_template_id' });
      if (error) throw new Error(error.message);
    }
    return NextResponse.json({ found: all.length, matched: rows.length, ignored: all.filter((t) => !TITLE.test(t.title.trim())).map((t) => t.title) });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
