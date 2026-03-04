import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('tenant_categories')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Count services per category
  const { data: services } = await supabase
    .from('services')
    .select('category_name')
    .eq('tenant_id', tenantId);

  const serviceCounts = new Map<string, number>();
  for (const s of (services ?? []) as { category_name: string | null }[]) {
    if (s.category_name) {
      serviceCounts.set(s.category_name, (serviceCounts.get(s.category_name) ?? 0) + 1);
    }
  }

  const enriched = ((data ?? []) as { id: string; name: string; color: string | null; parent_id: string | null; description: string | null }[]).map((cat) => ({
    ...cat,
    services_count: serviceCounts.get(cat.name) ?? 0,
  }));

  return NextResponse.json({ data: enriched, error: null });
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { name: string; color?: string; parent_id?: string; description?: string };
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('tenant_categories')
    .insert({
      tenant_id: tenantId,
      name: body.name,
      color: body.color || null,
      parent_id: body.parent_id || null,
      description: body.description || null,
    } as never)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { id: string; name?: string; color?: string; parent_id?: string; description?: string };
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('tenant_categories')
    .update(updates as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function DELETE(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('tenant_categories')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: null, error: null });
}
