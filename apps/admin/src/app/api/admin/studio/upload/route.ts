import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { RENDER_BUCKET } from '@/lib/canva/client';

export const maxDuration = 60;

const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// POST /api/admin/studio/upload — multipart `file` → public URL in the ig-renders bucket (photos/…), used as the template photo.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Send a multipart form with a `file` field' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Use a JPEG, PNG or WebP image' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image is larger than 8 MB' }, { status: 400 });

  const safe = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase().slice(0, 40) || 'photo';
  const path = `photos/${Date.now()}-${safe}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const { error } = await auth.supabase.storage.from(RENDER_BUCKET).upload(path, bytes, { contentType: file.type, upsert: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: auth.supabase.storage.from(RENDER_BUCKET).getPublicUrl(path).data.publicUrl });
}
