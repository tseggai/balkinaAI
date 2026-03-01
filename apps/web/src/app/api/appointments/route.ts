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
  const status = searchParams.get('status');
  const staffId = searchParams.get('staff_id');
  const serviceId = searchParams.get('service_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');

  const supabase = createClient();
  let query = supabase
    .from('appointments')
    .select('*, services(name), customers(display_name, email, phone), staff(name), tenant_locations(name)')
    .eq('tenant_id', tenantId)
    .order('start_time', { ascending: false });

  if (status) query = query.eq('status', status);
  if (staffId) query = query.eq('staff_id', staffId);
  if (serviceId) query = query.eq('service_id', serviceId);
  if (from) query = query.gte('start_time', from);
  if (to) query = query.lte('start_time', to);

  const { data, error } = await query.limit(200);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as {
    id: string;
    status?: string;
    staff_id?: string;
    start_time?: string;
    end_time?: string;
    notes?: string;
  };
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const updateData: Record<string, string | undefined> = {};
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.staff_id !== undefined) updateData.staff_id = updates.staff_id;
  if (updates.start_time !== undefined) updateData.start_time = updates.start_time;
  if (updates.end_time !== undefined) updateData.end_time = updates.end_time;
  if (updates.notes !== undefined) updateData.notes = updates.notes;

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('appointments')
    .update(updateData as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null });
}
