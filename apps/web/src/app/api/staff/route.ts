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

  // Fetch staff with service_staff count and holidays
  const { data, error } = await supabase
    .from('staff')
    .select('*, service_staff(staff_id), staff_holidays(*)')
    .eq('tenant_id', tenantId)
    .order('name');

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Map to include services_count
  const mapped = (data as Record<string, unknown>[] | null)?.map((staff) => {
    const serviceStaffArr = staff.service_staff as { staff_id: string }[] | null;
    const holidays = staff.staff_holidays as { id: string; date: string; note: string | null }[] | null;
    return {
      ...staff,
      services_count: serviceStaffArr?.length ?? 0,
      staff_holidays: holidays ?? [],
      service_staff: undefined,
    };
  }) ?? [];

  return NextResponse.json({ data: mapped, error: null });
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('staff')
    .insert({
      tenant_id: tenantId,
      name: body.name,
      email: body.email,
      phone: body.phone || null,
      profession: body.profession || null,
      notes: body.notes || null,
      is_active: body.is_active ?? true,
      status: body.is_active === false ? 'inactive' : 'active',
      image_url: body.image_url || null,
      availability_schedule: body.availability_schedule ?? {},
      booking_limit_capacity: body.booking_limit_capacity ?? null,
      booking_limit_interval: body.booking_limit_interval || null,
    } as never)
    .select()
    .single();

  const staffData = data as { id: string } | null;
  if (error || !staffData) return NextResponse.json({ data: null, error: { message: error?.message ?? 'Insert failed' } }, { status: 500 });

  // Insert staff_holidays if provided
  if (body.staff_holidays && Array.isArray(body.staff_holidays) && (body.staff_holidays as unknown[]).length > 0) {
    await supabase.from('staff_holidays').insert(
      (body.staff_holidays as { date: string; note?: string }[]).map((h) => ({
        staff_id: staffData.id,
        date: h.date,
        note: h.note || null,
      })) as never
    );
  }

  // Insert service_staff links if location/service IDs provided
  if (body.service_ids && Array.isArray(body.service_ids) && (body.service_ids as unknown[]).length > 0) {
    await supabase.from('service_staff').insert(
      (body.service_ids as string[]).map((serviceId) => ({
        service_id: serviceId,
        staff_id: staffData.id,
      })) as never
    );
  }

  return NextResponse.json({ data: staffData, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { id: string; [key: string]: unknown };
  const { id } = body;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const supabase = createAdminClient();

  // Build the update object with only known staff columns
  const updateFields: Record<string, unknown> = {};
  const staffColumns = [
    'name', 'email', 'phone', 'profession', 'notes',
    'is_active', 'status', 'image_url', 'availability_schedule',
    'booking_limit_capacity', 'booking_limit_interval',
  ];

  for (const col of staffColumns) {
    if (col in body) {
      updateFields[col] = body[col];
    }
  }

  // Sync status with is_active if is_active is provided
  if ('is_active' in body) {
    updateFields.status = body.is_active ? 'active' : 'inactive';
  }

  const { data, error } = await supabase
    .from('staff')
    .update(updateFields as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Replace staff_holidays if provided
  if ('staff_holidays' in body && Array.isArray(body.staff_holidays)) {
    const holidays = body.staff_holidays as { date: string; note?: string }[];
    await supabase.from('staff_holidays').delete().eq('staff_id', id);
    if (holidays.length > 0) {
      await supabase.from('staff_holidays').insert(
        holidays.map((h) => ({
          staff_id: id,
          date: h.date,
          note: h.note || null,
        })) as never
      );
    }
  }

  // Replace service_staff links if provided
  if ('service_ids' in body && Array.isArray(body.service_ids)) {
    const serviceIds = body.service_ids as string[];
    await supabase.from('service_staff').delete().eq('staff_id', id);
    if (serviceIds.length > 0) {
      await supabase.from('service_staff').insert(
        serviceIds.map((serviceId) => ({
          service_id: serviceId,
          staff_id: id,
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
  const { error } = await supabase.from('staff').delete().eq('id', id).eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}
