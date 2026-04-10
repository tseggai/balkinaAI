import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

/** GET /api/gallery?locationId=<uuid> — public, returns gallery photos for a location */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const locationId = searchParams.get('locationId');
  if (!locationId) {
    return NextResponse.json({ error: 'locationId required' }, { status: 400, headers: CORS_HEADERS });
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('location_gallery')
    .select('id, image_url, caption, sort_order')
    .eq('location_id', locationId)
    .order('sort_order', { ascending: true })
    .limit(15);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });
  }

  return NextResponse.json({ photos: data ?? [] }, { headers: CORS_HEADERS });
}

/** POST /api/gallery — authenticated tenant upload. Accepts multipart/form-data with file, locationId, optional caption */
export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  const locationId = formData.get('locationId') as string | null;
  const caption = (formData.get('caption') as string | null) ?? null;

  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });
  if (!locationId) return NextResponse.json({ error: 'locationId required' }, { status: 400 });

  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP' }, { status: 400 });
  }
  if (file.size > 10 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum 10MB' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Verify location belongs to tenant
  const { data: loc } = await supabase
    .from('tenant_locations')
    .select('id')
    .eq('id', locationId)
    .eq('tenant_id', tenantId)
    .single();
  if (!loc) return NextResponse.json({ error: 'Location not found' }, { status: 404 });

  // Check limit: max 15 photos per location
  const { count } = await supabase
    .from('location_gallery')
    .select('id', { count: 'exact', head: true })
    .eq('location_id', locationId);
  if ((count ?? 0) >= 15) {
    return NextResponse.json({ error: 'Maximum 15 photos per location' }, { status: 400 });
  }

  // Get current max sort_order
  const { data: maxRow } = await supabase
    .from('location_gallery')
    .select('sort_order')
    .eq('location_id', locationId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle();
  const nextOrder = ((maxRow as { sort_order: number } | null)?.sort_order ?? -1) + 1;

  // Upload to storage
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filename = `${tenantId}/gallery/${locationId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(filename, buffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 });
  }

  const { data: publicUrl } = supabase.storage.from('images').getPublicUrl(filename);

  // Insert gallery record
  const { data: photo, error: insertError } = await supabase
    .from('location_gallery')
    .insert({
      location_id: locationId,
      tenant_id: tenantId,
      image_url: publicUrl.publicUrl,
      caption,
      sort_order: nextOrder,
    })
    .select('id, image_url, caption, sort_order')
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  return NextResponse.json({ photo });
}

/** PATCH /api/gallery — authenticated tenant. Batch reorder: { photos: [{ id, sort_order }] } */
export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { photos: { id: string; sort_order: number }[] };
  if (!body.photos?.length) {
    return NextResponse.json({ error: 'No photos to update' }, { status: 400 });
  }

  const supabase = createAdminClient();

  for (const p of body.photos) {
    await supabase
      .from('location_gallery')
      .update({ sort_order: p.sort_order })
      .eq('id', p.id)
      .eq('tenant_id', tenantId);
  }

  return NextResponse.json({ success: true });
}

/** DELETE /api/gallery?id=<uuid> — authenticated tenant delete */
export async function DELETE(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const photoId = searchParams.get('id');
  if (!photoId) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const supabase = createAdminClient();

  // Get the photo to find the storage path
  const { data: photo } = await supabase
    .from('location_gallery')
    .select('image_url')
    .eq('id', photoId)
    .eq('tenant_id', tenantId)
    .single();

  if (!photo) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
  }

  // Delete from storage (extract path from URL)
  const url = (photo as { image_url: string }).image_url;
  const storagePath = url.split('/storage/v1/object/public/images/')[1];
  if (storagePath) {
    await supabase.storage.from('images').remove([storagePath]);
  }

  // Delete DB record
  await supabase.from('location_gallery').delete().eq('id', photoId).eq('tenant_id', tenantId);

  return NextResponse.json({ success: true });
}
