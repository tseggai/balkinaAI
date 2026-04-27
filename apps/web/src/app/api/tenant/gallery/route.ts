import { NextResponse } from 'next/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400, headers: CORS_HEADERS });

  const { data, error } = await ctx.admin
    .from('location_gallery')
    .select('id, image_url, caption, sort_order')
    .eq('location_id', locationId)
    .eq('tenant_id', ctx.tenantId)
    .order('sort_order');

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  return NextResponse.json({ photos: data ?? [] }, { headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const locationId = formData.get('locationId') as string | null;

  if (!file || !locationId) return NextResponse.json({ error: 'file and locationId required' }, { status: 400, headers: CORS_HEADERS });

  // Check gallery limit
  const { count } = await ctx.admin
    .from('location_gallery')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId);
  if ((count ?? 0) >= 15) return NextResponse.json({ error: 'Maximum 15 photos per location' }, { status: 400, headers: CORS_HEADERS });

  // Upload to storage
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filename = `gallery/${ctx.tenantId}/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await ctx.admin.storage
    .from('images')
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500, headers: CORS_HEADERS });

  const { data: publicUrl } = ctx.admin.storage.from('images').getPublicUrl(filename);

  const { data: photo, error: insertError } = await ctx.admin
    .from('location_gallery')
    .insert({
      location_id: locationId,
      tenant_id: ctx.tenantId,
      image_url: publicUrl.publicUrl,
      sort_order: (count ?? 0),
    } as never)
    .select('id, image_url, sort_order')
    .single();

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500, headers: CORS_HEADERS });
  return NextResponse.json({ photo }, { status: 201, headers: CORS_HEADERS });
}

export async function DELETE(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS_HEADERS });

  // Get the photo URL to delete from storage
  const { data: photo } = await ctx.admin
    .from('location_gallery')
    .select('image_url')
    .eq('id', id)
    .eq('tenant_id', ctx.tenantId)
    .single();

  if (photo) {
    const url = (photo as { image_url: string }).image_url;
    const storagePath = url.split('/storage/v1/object/public/images/')[1];
    if (storagePath) {
      await ctx.admin.storage.from('images').remove([storagePath]);
    }
  }

  await ctx.admin.from('location_gallery').delete().eq('id', id).eq('tenant_id', ctx.tenantId);
  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}
