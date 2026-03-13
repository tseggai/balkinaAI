import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import {
  notifyBookingConfirmed,
  notifyStaffNewBooking,
  notifyBookingCancelledByTenant,
} from '@/lib/notifications/booking-events';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

export async function GET(request: Request) {
  try {
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

  // Use admin client — auth is already verified by getTenantId() above.
  // The anon-key client goes through RLS which requires get_my_tenant_id()
  // to return a value from the JWT. If the JWT doesn't contain tenant_id
  // in app_metadata (e.g. stale session), the query returns zero rows.
  // The admin client bypasses RLS; security is enforced by the explicit
  // .eq('tenant_id', tenantId) filter.
  const supabase = createAdminClient();

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
  } catch (err) {
    console.error('GET /api/appointments error:', err);
    return NextResponse.json({ data: null, total: 0, error: { message: String(err) } }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
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

  const appointmentData = data as { id: string } | null;

  // Insert custom field values if provided
  const customFieldValues = body.custom_field_values as { custom_field_id: string; value: string }[] | undefined;
  if (customFieldValues && Array.isArray(customFieldValues) && customFieldValues.length > 0) {
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

  // Insert appointment extras if provided
  const extras = body.extras as { extra_id: string; name: string; price: number; duration_minutes: number }[] | undefined;
  if (extras && Array.isArray(extras) && extras.length > 0 && appointmentData) {
    await supabase.from('appointment_extras').insert(
      extras.map((e) => ({
        appointment_id: appointmentData.id,
        extra_id: e.extra_id,
        name: e.name,
        price: e.price,
        duration_minutes: e.duration_minutes,
      })) as never
    );
  }

  // Insert appointment products if provided
  const products = body.products as { product_id: string; name: string; price: number; quantity: number }[] | undefined;
  if (products && Array.isArray(products) && products.length > 0 && appointmentData) {
    await supabase.from('appointment_products').insert(
      products.map((p) => ({
        appointment_id: appointmentData.id,
        product_id: p.product_id,
        name: p.name,
        price: p.price,
        quantity: p.quantity,
      })) as never
    );
  }

  // Insert appointment coupon if provided
  const coupon = body.coupon as { coupon_id: string; code: string; discount_type: string; discount_value: number; discount_amount: number } | undefined;
  if (coupon && appointmentData) {
    await supabase.from('appointment_coupons').insert({
      appointment_id: appointmentData.id,
      coupon_id: coupon.coupon_id,
      code: coupon.code,
      discount_type: coupon.discount_type,
      discount_value: coupon.discount_value,
      discount_amount: coupon.discount_amount,
    } as never);
  }

  // Fire notifications (non-blocking)
  if (appointmentData) {
    void Promise.allSettled([
      notifyBookingConfirmed(appointmentData.id),
      notifyStaffNewBooking(appointmentData.id),
    ]);
  }

  return NextResponse.json({ data, error: null }, { status: 201 });
  } catch (err) {
    console.error('POST /api/appointments error:', err);
    return NextResponse.json({ data: null, error: { message: String(err) } }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
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

  // Check if status is changing to 'completed' so we can decrement inventory
  let shouldDecrementInventory = false;
  if (updateFields.status === 'completed') {
    // Fetch the current appointment to check if status is actually changing
    const { data: current } = await supabase
      .from('appointments')
      .select('status, service_id')
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .single();
    if (current && (current as { status: string }).status !== 'completed') {
      shouldDecrementInventory = true;
    }
  }

  const { data, error } = await supabase
    .from('appointments')
    .update(updateFields as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('*, services(name), customers(display_name, email, phone), staff(name), tenant_locations(name)')
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Update appointment extras if provided (replace all)
  const extras = body.extras as { extra_id: string; name: string; price: number; duration_minutes: number }[] | undefined;
  if (extras !== undefined) {
    await supabase.from('appointment_extras').delete().eq('appointment_id', id);
    if (extras.length > 0) {
      await supabase.from('appointment_extras').insert(
        extras.map((e) => ({
          appointment_id: id,
          extra_id: e.extra_id,
          name: e.name,
          price: e.price,
          duration_minutes: e.duration_minutes,
        })) as never
      );
    }
  }

  // Update appointment products if provided (replace all)
  const products = body.products as { product_id: string; name: string; price: number; quantity: number }[] | undefined;
  if (products !== undefined) {
    await supabase.from('appointment_products').delete().eq('appointment_id', id);
    if (products.length > 0) {
      await supabase.from('appointment_products').insert(
        products.map((p) => ({
          appointment_id: id,
          product_id: p.product_id,
          name: p.name,
          price: p.price,
          quantity: p.quantity,
        })) as never
      );
    }
  }

  // Update appointment coupon if provided (replace)
  const coupon = body.coupon as { coupon_id: string; code: string; discount_type: string; discount_value: number; discount_amount: number } | null | undefined;
  if (coupon !== undefined) {
    await supabase.from('appointment_coupons').delete().eq('appointment_id', id);
    if (coupon) {
      await supabase.from('appointment_coupons').insert({
        appointment_id: id,
        coupon_id: coupon.coupon_id,
        code: coupon.code,
        discount_type: coupon.discount_type,
        discount_value: coupon.discount_value,
        discount_amount: coupon.discount_amount,
      } as never);
    }
  }

  // Auto-decrement inventory when appointment is completed
  if (shouldDecrementInventory && data) {
    const appt = data as { service_id: string };
    if (appt.service_id) {
      // Find all products linked to this service
      const { data: linkedProducts } = await supabase
        .from('product_services')
        .select('product_id, quantity_per_service')
        .eq('service_id', appt.service_id);

      if (linkedProducts && linkedProducts.length > 0) {
        for (const link of linkedProducts as { product_id: string; quantity_per_service: number }[]) {
          // Decrement quantity_on_hand (never below 0)
          await supabase.rpc('decrement_product_quantity', {
            p_product_id: link.product_id,
            p_amount: link.quantity_per_service ?? 1,
          }).then(async (res) => {
            // If RPC doesn't exist, fall back to manual update
            if (res.error) {
              const { data: product } = await supabase
                .from('products')
                .select('quantity_on_hand')
                .eq('id', link.product_id)
                .single();
              if (product) {
                const current = (product as { quantity_on_hand: number }).quantity_on_hand;
                const newQty = Math.max(0, current - (link.quantity_per_service ?? 1));
                await supabase
                  .from('products')
                  .update({ quantity_on_hand: newQty } as never)
                  .eq('id', link.product_id);
              }
            }
          });
        }
      }
    }
  }

  // Fire cancellation notifications (non-blocking)
  if (updateFields.status === 'cancelled' && data) {
    const apptData = data as { id: string };
    void Promise.allSettled([
      notifyBookingCancelledByTenant(apptData.id),
    ]);
  }

  return NextResponse.json({ data, error: null });
  } catch (err) {
    console.error('PATCH /api/appointments error:', err);
    return NextResponse.json({ data: null, error: { message: String(err) } }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const ids = searchParams.get('ids'); // comma-separated for bulk delete

  const supabase = createAdminClient();

  if (ids) {
    const idList = ids.split(',').filter(Boolean);
    if (idList.length === 0) return NextResponse.json({ data: null, error: { message: 'Missing ids' } }, { status: 400 });
    const { error } = await supabase
      .from('appointments')
      .delete()
      .in('id', idList)
      .eq('tenant_id', tenantId);
    if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
    return NextResponse.json({ data: { ids: idList }, error: null });
  }

  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const { error } = await supabase
    .from('appointments')
    .delete()
    .eq('id', id)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}

// Bulk status update
export async function PUT(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { ids?: string[]; status?: string };
  const { ids, status } = body;

  if (!ids || !Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ data: null, error: { message: 'Missing ids array' } }, { status: 400 });
  }
  if (!status) {
    return NextResponse.json({ data: null, error: { message: 'Missing status' } }, { status: 400 });
  }

  const validStatuses = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show', 'rescheduled', 'rejected', 'emergency'];
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ data: null, error: { message: 'Invalid status' } }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('appointments')
    .update({ status })
    .in('id', ids)
    .eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { ids, status }, error: null });
}
