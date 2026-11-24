import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export const maxDuration = 60;

const BUCKET = 'place-photos';
const MAX_BYTES = 8 * 1024 * 1024;
const TYPES: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

// POST /api/admin/places/upload — multipart `file` → public URL in the place-photos bucket, used as a place's photo.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return NextResponse.json({ error: 'Send a multipart form with a `file` field' }, { status: 400 });
  const ext = TYPES[file.type];
  if (!ext) return NextResponse.json({ error: 'Use a JPEG, PNG or WebP image' }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Image is larger than 8 MB' }, { status: 400 });

  const safe = file.name.replace(/\.[^.]+$/, '').replace(/[^a-z0-9-]+/gi, '-').toLowerCase().slice(0, 40) || 'place';
  const path = `${Date.now()}-${safe}.${ext}`;
  const bytes = Buffer.from(await file.arrayBuffer());
  const storage = auth.supabase.storage;
  const put = () => storage.from(BUCKET).upload(path, bytes, { contentType: file.type, upsert: false, cacheControl: '31536000' });

  let { error } = await put();
  if (error && /bucket not found/i.test(error.message)) {
    // First upload on this project: the bucket is created here, so there is no migration to apply.
    const created = await storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_BYTES, allowedMimeTypes: Object.keys(TYPES) });
    if (created.error && !/already exists/i.test(created.error.message)) return NextResponse.json({ error: created.error.message }, { status: 500 });
    ({ error } = await put());
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ url: storage.from(BUCKET).getPublicUrl(path).data.publicUrl });
}
