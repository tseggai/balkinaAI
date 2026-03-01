import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return tenant?.id ?? null;
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json();
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('coupons')
    .insert({
      tenant_id: tenantId,
      code: body.code,
      discount_type: body.discount_type,
      discount_value: body.discount_value,
      expires_at: body.expires_at || null,
      usage_limit: body.usage_limit || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json();
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('coupons')
    .update(updates)
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
  const { error } = await supabase.from('coupons').delete().eq('id', id).eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}
