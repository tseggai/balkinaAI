import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { data, error } = await auth.supabase
    .from('categories')
    .select('id, parent_id, name, slug, icon_url, display_order, created_at')
    .order('display_order', { ascending: true })
    .order('name', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { name, slug, parent_id, icon_url, display_order } = body as {
    name: string;
    slug: string;
    parent_id?: string | null;
    icon_url?: string | null;
    display_order?: number;
  };

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('categories')
    .insert({
      name,
      slug,
      parent_id: parent_id ?? null,
      icon_url: icon_url ?? null,
      display_order: display_order ?? 0,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { id, ...fields } = body as { id: string; name?: string; slug?: string; parent_id?: string | null; icon_url?: string | null; display_order?: number };

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('categories')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { error } = await auth.supabase
    .from('categories')
    .delete()
    .eq('id', id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
