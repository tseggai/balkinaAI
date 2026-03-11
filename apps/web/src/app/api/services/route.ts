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
    .select('*, service_extras(*), service_staff(staff_id, staff(name)), service_locations(location_id)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Map service_staff and service_locations for easier consumption
  const mapped = (data as Record<string, unknown>[] | null)?.map((service) => {
    const staffArr = service.service_staff as { staff_id: string; staff: { name: string } | null }[] | null;
    const locArr = service.service_locations as { location_id: string }[] | null;
    return {
      ...service,
      service_staff: staffArr?.map((ss) => ({
        staff_id: ss.staff_id,
        staff_name: ss.staff?.name ?? 'Unknown',
      })) ?? [],
      service_locations: locArr?.map((sl) => sl.location_id) ?? [],
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
    .from('services')
    .insert({
      tenant_id: tenantId,
      name: body.name,
      category_id: body.category_id || null,
      category_name: body.category_name || null,
      duration_minutes: body.duration_minutes,
      price: body.price,
      deposit_enabled: body.deposit_enabled ?? false,
      deposit_type: body.deposit_type || null,
      deposit_amount: body.deposit_amount || null,
      image_url: body.image_url || null,
      color: body.color || '#6366f1',
      description: body.description || null,
      buffer_time_before: body.buffer_time_before ?? 0,
      buffer_time_after: body.buffer_time_after ?? 0,
      custom_duration: body.custom_duration ?? false,
      is_recurring: body.is_recurring ?? false,
      capacity: body.capacity ?? 1,
      hide_price: body.hide_price ?? false,
      hide_duration: body.hide_duration ?? false,
      visibility: body.visibility || 'public',
      min_booking_lead_time: body.min_booking_lead_time ?? 0,
      max_booking_days_ahead: body.max_booking_days_ahead ?? 0,
      min_extras: body.min_extras ?? 0,
      max_extras: body.max_extras ?? null,
      booking_limit_per_customer: body.booking_limit_per_customer ?? null,
      booking_limit_per_customer_interval: body.booking_limit_per_customer_interval || null,
      booking_limit_per_slot: body.booking_limit_per_slot ?? null,
      booking_limit_per_slot_interval: body.booking_limit_per_slot_interval || null,
      timesheet: body.timesheet || null,
    } as never)
    .select()
    .single();

  const serviceData = data as { id: string } | null;
  if (error || !serviceData) return NextResponse.json({ data: null, error: { message: error?.message ?? 'Insert failed' } }, { status: 500 });

  // Insert service extras if provided
  if (body.extras && Array.isArray(body.extras) && (body.extras as unknown[]).length > 0) {
    await supabase.from('service_extras').insert(
      (body.extras as { name: string; price: number; duration_minutes: number }[]).map((e) => ({
        service_id: serviceData.id,
        name: e.name,
        price: e.price,
        duration_minutes: e.duration_minutes ?? 0,
      })) as never
    );
  }

  // Insert service_staff if provided
  if (body.staff && Array.isArray(body.staff) && (body.staff as unknown[]).length > 0) {
    await supabase.from('service_staff').insert(
      (body.staff as string[]).map((staffId) => ({
        service_id: serviceData.id,
        staff_id: staffId,
      })) as never
    );
  }

  // Insert service_locations if provided
  if (body.locations && Array.isArray(body.locations) && (body.locations as unknown[]).length > 0) {
    await supabase.from('service_locations').insert(
      (body.locations as string[]).map((locationId) => ({
        service_id: serviceData.id,
        location_id: locationId,
      })) as never
    );
  }

  return NextResponse.json({ data, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing service id' } }, { status: 400 });

  const extras = body.extras as { name: string; price: number; duration_minutes: number }[] | undefined;
  const staff = body.staff as string[] | undefined;

  const supabase = createAdminClient();

  // Build the update object without extras, staff, and id
  const updateFields: Record<string, unknown> = {};
  const serviceColumns = [
    'name', 'category_id', 'category_name', 'duration_minutes', 'price',
    'deposit_enabled', 'deposit_type', 'deposit_amount',
    'image_url', 'color', 'description',
    'buffer_time_before', 'buffer_time_after',
    'custom_duration', 'is_recurring', 'capacity',
    'hide_price', 'hide_duration', 'visibility',
    'min_booking_lead_time', 'max_booking_days_ahead',
    'min_extras', 'max_extras',
    'booking_limit_per_customer', 'booking_limit_per_customer_interval',
    'booking_limit_per_slot', 'booking_limit_per_slot_interval',
    'timesheet',
  ];

  for (const col of serviceColumns) {
    if (col in body) {
      updateFields[col] = body[col];
    }
  }

  const { data, error } = await supabase
    .from('services')
    .update(updateFields as never)
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
        extras.map((e) => ({
          service_id: id,
          name: e.name,
          price: e.price,
          duration_minutes: e.duration_minutes ?? 0,
        })) as never
      );
    }
  }

  // Replace staff if provided
  if (staff && Array.isArray(staff)) {
    await supabase.from('service_staff').delete().eq('service_id', id);
    if (staff.length > 0) {
      await supabase.from('service_staff').insert(
        staff.map((staffId) => ({
          service_id: id,
          staff_id: staffId,
        })) as never
      );
    }
  }

  // Replace locations if provided
  const locations = body.locations as string[] | undefined;
  if (locations && Array.isArray(locations)) {
    await supabase.from('service_locations').delete().eq('service_id', id);
    if (locations.length > 0) {
      await supabase.from('service_locations').insert(
        locations.map((locationId) => ({
          service_id: id,
          location_id: locationId,
        })) as never
      );
    }
  }

  return NextResponse.json({ data, error: null });
}

export async function PUT(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { ids: string[]; visibility?: string };
  const { ids, visibility } = body;
  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ data: null, error: { message: 'Missing ids' } }, { status: 400 });
  }

  const supabase = createAdminClient();
  const updateFields: Record<string, unknown> = {};
  if (visibility) updateFields.visibility = visibility;

  if (Object.keys(updateFields).length === 0) {
    return NextResponse.json({ data: null, error: { message: 'No fields to update' } }, { status: 400 });
  }

  const { error } = await supabase
    .from('services')
    .update(updateFields as never)
    .in('id', ids)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { ids }, error: null });
}

export async function DELETE(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const ids = searchParams.get('ids');

  const supabase = createAdminClient();

  if (ids) {
    // Bulk delete
    const idArr = ids.split(',').filter(Boolean);
    const { error } = await supabase
      .from('services')
      .delete()
      .in('id', idArr)
      .eq('tenant_id', tenantId);
    if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
    return NextResponse.json({ data: { ids: idArr }, error: null });
  }

  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const { error } = await supabase
    .from('services')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}
