import { NextResponse } from 'next/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function POST(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const purpose = formData.get('purpose') as string | null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400, headers: CORS_HEADERS });

  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type' }, { status: 400, headers: CORS_HEADERS });
  }
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large (max 5MB)' }, { status: 400, headers: CORS_HEADERS });
  }

  const ext = file.name.split('.').pop() ?? 'jpg';
  const prefix = purpose ?? 'general';
  const filename = `${ctx.tenantId}/${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await ctx.admin.storage
    .from('images')
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
      await ctx.admin.storage.createBucket('images', { public: true, fileSizeLimit: 5 * 1024 * 1024, allowedMimeTypes: allowed });
      const { error: retryError } = await ctx.admin.storage.from('images').upload(filename, buffer, { contentType: file.type, upsert: false });
      if (retryError) return NextResponse.json({ error: retryError.message }, { status: 500, headers: CORS_HEADERS });
    } else {
      return NextResponse.json({ error: uploadError.message }, { status: 500, headers: CORS_HEADERS });
    }
  }

  const { data: publicUrl } = ctx.admin.storage.from('images').getPublicUrl(filename);
  return NextResponse.json({ url: publicUrl.publicUrl }, { headers: CORS_HEADERS });
}
