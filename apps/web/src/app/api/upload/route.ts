import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const formData = await request.formData();
  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

  // Validate file type
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml'];
  if (!allowed.includes(file.type)) {
    return NextResponse.json({ error: 'Invalid file type. Allowed: JPEG, PNG, WebP, GIF, SVG' }, { status: 400 });
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return NextResponse.json({ error: 'File too large. Maximum size is 5MB' }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Generate unique filename
  const ext = file.name.split('.').pop() ?? 'jpg';
  const filename = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const { error: uploadError } = await supabase.storage
    .from('images')
    .upload(filename, buffer, {
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    // If bucket doesn't exist, try creating it
    if (uploadError.message?.includes('not found') || uploadError.message?.includes('does not exist')) {
      // Create the bucket
      await supabase.storage.createBucket('images', {
        public: true,
        fileSizeLimit: 5 * 1024 * 1024,
        allowedMimeTypes: allowed,
      });

      // Retry upload
      const { error: retryError } = await supabase.storage
        .from('images')
        .upload(filename, buffer, {
          contentType: file.type,
          upsert: false,
        });

      if (retryError) {
        return NextResponse.json({ error: retryError.message }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: uploadError.message }, { status: 500 });
    }
  }

  const { data: publicUrl } = supabase.storage.from('images').getPublicUrl(filename);

  return NextResponse.json({ url: publicUrl.publicUrl });
}
