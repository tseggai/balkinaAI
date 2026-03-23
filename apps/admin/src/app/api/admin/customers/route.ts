import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)));
  const search = searchParams.get('search');

  const from = (page - 1) * perPage;
  let query = auth.supabase
    .from('customers')
    .select('id, user_id, display_name, first_name, last_name, email, phone, gender, profile_image_url, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1);

  if (search) query = query.or(`display_name.ilike.%${search}%,email.ilike.%${search}%,phone.ilike.%${search}%,first_name.ilike.%${search}%,last_name.ilike.%${search}%`);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, per_page: perPage });
}
