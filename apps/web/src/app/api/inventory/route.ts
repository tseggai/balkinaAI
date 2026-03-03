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

  const supabase = createClient();
  const { data, error } = await supabase
    .from('products')
    .select('*, product_services(*, services(name))')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('products')
    .insert({
      tenant_id: tenantId,
      name: body.name,
      image_url: body.image_url || null,
      description: body.description || null,
      quantity_on_hand: body.quantity_on_hand ?? 0,
      min_order_quantity: body.min_order_quantity ?? 0,
      max_order_quantity: body.max_order_quantity ?? null,
      purchase_price: body.purchase_price ?? 0,
      sell_price: body.sell_price ?? 0,
      display_in_booking: body.display_in_booking ?? false,
      is_active: body.is_active ?? true,
    } as never)
    .select()
    .single();

  const productData = data as { id: string } | null;
  if (error || !productData) return NextResponse.json({ data: null, error: { message: error?.message ?? 'Insert failed' } }, { status: 500 });

  // Insert product_services if provided
  const services = body.services as { service_id: string; quantity_per_service: number }[] | undefined;
  if (services && Array.isArray(services) && services.length > 0) {
    await supabase.from('product_services').insert(
      services.map((s) => ({
        product_id: productData.id,
        service_id: s.service_id,
        quantity_per_service: s.quantity_per_service ?? 1,
      })) as never
    );
  }

  return NextResponse.json({ data: productData, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const services = body.services as { service_id: string; quantity_per_service: number }[] | undefined;
  const supabase = createAdminClient();

  const updateFields: Record<string, unknown> = {};
  const columns = [
    'name', 'image_url', 'description', 'quantity_on_hand',
    'min_order_quantity', 'max_order_quantity', 'purchase_price',
    'sell_price', 'display_in_booking', 'is_active',
  ];
  for (const col of columns) {
    if (col in body) {
      updateFields[col] = body[col];
    }
  }

  const { data, error } = await supabase
    .from('products')
    .update(updateFields as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Replace product_services if provided
  if (services && Array.isArray(services)) {
    await supabase.from('product_services').delete().eq('product_id', id);
    if (services.length > 0) {
      await supabase.from('product_services').insert(
        services.map((s) => ({
          product_id: id,
          service_id: s.service_id,
          quantity_per_service: s.quantity_per_service ?? 1,
        })) as never
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
  const { error } = await supabase.from('products').delete().eq('id', id).eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}
