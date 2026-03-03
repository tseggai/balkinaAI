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
  if (!tenantId) return NextResponse.json({ data: null, total: 0, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const status = searchParams.get('status');
  const staffId = searchParams.get('staff_id');
  const serviceId = searchParams.get('service_id');
  const customerId = searchParams.get('customer_id');
  const from = searchParams.get('from');
  const to = searchParams.get('to');
  const search = searchParams.get('search');
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') ?? '20', 10)));
  const offset = (page - 1) * limit;

  const supabase = createClient();

  // Build query for count
  let countQuery = supabase
    .from('appointments')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId);

  // Build query for data
  let dataQuery = supabase
    .from('appointments')
    .select('*, services(name, duration_minutes, price), customers(id, display_name, email, phone), staff(id, name), tenant_locations(id, name)')
    .eq('tenant_id', tenantId)
    .order('start_time', { ascending: false })
    .range(offset, offset + limit - 1);

  // Apply filters to both queries
  if (status) {
    countQuery = countQuery.eq('status', status);
    dataQuery = dataQuery.eq('status', status);
  }
  if (staffId) {
    countQuery = countQuery.eq('staff_id', staffId);
    dataQuery = dataQuery.eq('staff_id', staffId);
  }
  if (serviceId) {
    countQuery = countQuery.eq('service_id', serviceId);
    dataQuery = dataQuery.eq('service_id', serviceId);
  }
  if (customerId) {
    countQuery = countQuery.eq('customer_id', customerId);
    dataQuery = dataQuery.eq('customer_id', customerId);
  }
  if (from) {
    countQuery = countQuery.gte('start_time', from);
    dataQuery = dataQuery.gte('start_time', from);
  }
  if (to) {
    countQuery = countQuery.lte('start_time', to);
    dataQuery = dataQuery.lte('start_time', to);
  }

  // For search, we need a different approach - filter after fetch if search is provided
  // Supabase doesn't support joins + text search easily, so we handle it below
  const { count } = await countQuery;
  const { data, error } = await dataQuery;

  if (error) return NextResponse.json({ data: null, total: 0, error: { message: error.message } }, { status: 500 });

  // Apply search filter on customer display_name or email
  let filtered = data ?? [];
  if (search && search.trim()) {
    const term = search.toLowerCase();
    filtered = filtered.filter((appt) => {
      const customer = appt.customers as { display_name: string | null; email: string | null } | null;
      const name = customer?.display_name?.toLowerCase() ?? '';
      const email = customer?.email?.toLowerCase() ?? '';
      return name.includes(term) || email.includes(term);
    });
  }

  return NextResponse.json({
    data: filtered,
    total: search ? filtered.length : (count ?? 0),
    page,
    limit,
    error: null,
  });
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };

  // Validate required fields
  const requiredFields = ['customer_id', 'service_id', 'start_time', 'end_time'];
  for (const field of requiredFields) {
    if (!body[field]) {
      return NextResponse.json({ data: null, error: { message: `Missing required field: ${field}` } }, { status: 400 });
    }
  }

  const supabase = createAdminClient();

  const insertData = {
    tenant_id: tenantId,
    customer_id: body.customer_id,
    service_id: body.service_id,
    staff_id: body.staff_id || null,
    location_id: body.location_id || null,
    start_time: body.start_time,
    end_time: body.end_time,
    status: body.status || 'pending',
    total_price: body.total_price ?? 0,
    notes: body.notes || null,
  };

  const { data, error } = await supabase
    .from('appointments')
    .insert(insertData as never)
    .select('*, services(name), customers(display_name, email, phone), staff(name), tenant_locations(name)')
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Insert custom field values if provided
  const customFieldValues = body.custom_field_values as { custom_field_id: string; value: string }[] | undefined;
  if (customFieldValues && Array.isArray(customFieldValues) && customFieldValues.length > 0) {
    const appointmentData = data as { id: string } | null;
    if (appointmentData) {
      await supabase.from('appointment_custom_field_values').insert(
        customFieldValues.map((cfv) => ({
          appointment_id: appointmentData.id,
          custom_field_id: cfv.custom_field_id,
          value: cfv.value,
        })) as never
      );
    }
  }

  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing appointment id' } }, { status: 400 });

  const updateFields: Record<string, unknown> = {};
  const allowedColumns = [
    'status', 'staff_id', 'start_time', 'end_time', 'notes',
    'location_id', 'service_id', 'total_price', 'customer_id',
  ];

  for (const col of allowedColumns) {
    if (col in body) {
      updateFields[col] = body[col];
    }
  }

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('appointments')
    .update(updateFields as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('*, services(name), customers(display_name, email, phone), staff(name), tenant_locations(name)')
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
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}
