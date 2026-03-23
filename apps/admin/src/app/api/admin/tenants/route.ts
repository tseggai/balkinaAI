import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const perPage = Math.min(50, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)));
  const status = searchParams.get('status');
  const search = searchParams.get('search');

  const from = (page - 1) * perPage;
  let query = auth.supabase
    .from('tenants')
    .select('id, name, owner_name, email, phone, status, payments_enabled, avg_rating, review_count, logo_url, created_at, subscription_plans(id, name)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, from + perPage - 1);

  if (status) query = query.eq('status', status);
  if (search) query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%,owner_name.ilike.%${search}%`);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data: data ?? [], total: count ?? 0, page, per_page: perPage });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { id, status, payments_enabled } = body as { id: string; status?: string; payments_enabled?: boolean };

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const updates: Record<string, unknown> = {};
  if (status !== undefined) updates.status = status;
  if (payments_enabled !== undefined) updates.payments_enabled = payments_enabled;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await auth.supabase
    .from('tenants')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
