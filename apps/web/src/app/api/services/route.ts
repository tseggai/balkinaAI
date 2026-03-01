import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('user_id', user.id)
    .single();
  return (tenant as { id: string } | null)?.id ?? null;
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('services')
    .select('*, categories(name), service_extras(*)')
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
    .from('services')
    .insert({
      tenant_id: tenantId,
      name: body.name,
      category_id: body.category_id || null,
      duration_minutes: body.duration_minutes,
      price: body.price,
      deposit_enabled: body.deposit_enabled ?? false,
      deposit_type: body.deposit_type || null,
      deposit_amount: body.deposit_amount || null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Insert service extras if provided
  if (body.extras && Array.isArray(body.extras) && body.extras.length > 0) {
    await supabase.from('service_extras').insert(
      body.extras.map((e: { name: string; price: number; duration_minutes: number }) => ({
        service_id: data.id,
        name: e.name,
        price: e.price,
        duration_minutes: e.duration_minutes ?? 0,
      }))
    );
  }

  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json();
  const { id, extras, ...updates } = body;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing service id' } }, { status: 400 });

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('services')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Replace extras if provided
  if (extras && Array.isArray(extras)) {
    await supabase.from('service_extras').delete().eq('service_id', id);
    if (extras.length > 0) {
      await supabase.from('service_extras').insert(
        extras.map((e: { name: string; price: number; duration_minutes: number }) => ({
          service_id: id,
          name: e.name,
          price: e.price,
          duration_minutes: e.duration_minutes ?? 0,
        }))
      );
    }
  }

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
    .from('services')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}
