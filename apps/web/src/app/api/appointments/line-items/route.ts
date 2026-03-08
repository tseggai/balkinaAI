import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

export async function GET(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const appointmentId = searchParams.get('appointment_id');
  if (!appointmentId) return NextResponse.json({ data: null, error: { message: 'Missing appointment_id' } }, { status: 400 });

  const supabase = createClient();

  // Verify the appointment belongs to this tenant
  const { data: appt } = await supabase
    .from('appointments')
    .select('id')
    .eq('id', appointmentId)
    .eq('tenant_id', tenantId)
    .single();

  if (!appt) return NextResponse.json({ data: null, error: { message: 'Appointment not found' } }, { status: 404 });

  // Use admin client to bypass RLS for line item reads (tenant ownership already verified above)
  const admin = createAdminClient();
  const [extrasRes, productsRes, couponsRes] = await Promise.all([
    admin.from('appointment_extras').select('*').eq('appointment_id', appointmentId),
    admin.from('appointment_products').select('*').eq('appointment_id', appointmentId),
    admin.from('appointment_coupons').select('*').eq('appointment_id', appointmentId),
  ]);

  return NextResponse.json({
    data: {
      extras: extrasRes.data ?? [],
      products: productsRes.data ?? [],
      coupons: couponsRes.data ?? [],
    },
    error: null,
  });
}
