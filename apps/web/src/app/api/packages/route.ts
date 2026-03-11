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
    .from('packages')
    .select('*, package_services(*, services(name))')
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
    .from('packages')
    .insert({
      tenant_id: tenantId,
      name: body.name,
      price: body.price ?? 0,
      image_url: body.image_url || null,
      description: body.description || null,
      is_private: body.is_private ?? false,
      is_active: body.is_active ?? true,
      expiration_value: body.expiration_value ?? null,
      expiration_unit: body.expiration_unit || null,
    } as never)
    .select()
    .single();

  const packageData = data as { id: string } | null;
  if (error || !packageData) return NextResponse.json({ data: null, error: { message: error?.message ?? 'Insert failed' } }, { status: 500 });

  // Insert package_services if provided
  const services = body.services as { service_id: string; quantity: number }[] | undefined;
  if (services && Array.isArray(services) && services.length > 0) {
    await supabase.from('package_services').insert(
      services.map((s) => ({
        package_id: packageData.id,
        service_id: s.service_id,
        quantity: s.quantity ?? 1,
      })) as never
    );
  }

  return NextResponse.json({ data: packageData, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const services = body.services as { service_id: string; quantity: number }[] | undefined;
  const supabase = createAdminClient();

  const updateFields: Record<string, unknown> = {};
  const columns = [
    'name', 'price', 'image_url', 'description', 'is_private',
    'is_active', 'expiration_value', 'expiration_unit',
  ];
  for (const col of columns) {
    if (col in body) {
      updateFields[col] = body[col];
    }
  }

  const { data, error } = await supabase
    .from('packages')
    .update(updateFields as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Replace package_services if provided
  if (services && Array.isArray(services)) {
    await supabase.from('package_services').delete().eq('package_id', id);
    if (services.length > 0) {
      await supabase.from('package_services').insert(
        services.map((s) => ({
          package_id: id,
          service_id: s.service_id,
          quantity: s.quantity ?? 1,
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
  const { error } = await supabase.from('packages').delete().eq('id', id).eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}
