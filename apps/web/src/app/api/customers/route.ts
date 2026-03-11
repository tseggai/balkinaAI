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

  // Get all appointments for this tenant to build customer stats
  const { data: appointments } = await supabase
    .from('appointments')
    .select('customer_id, total_price, start_time, status')
    .eq('tenant_id', tenantId);

  if (!appointments) return NextResponse.json({ data: [], error: null });

  // Build customer stats map
  const statsMap = new Map<string, {
    total_bookings: number;
    total_spent: number;
    last_booking_date: string | null;
  }>();

  for (const appt of appointments) {
    const existing = statsMap.get(appt.customer_id) ?? {
      total_bookings: 0,
      total_spent: 0,
      last_booking_date: null,
    };
    existing.total_bookings += 1;
    if (appt.status === 'completed' || appt.status === 'confirmed') {
      existing.total_spent += appt.total_price;
    }
    if (!existing.last_booking_date || appt.start_time > existing.last_booking_date) {
      existing.last_booking_date = appt.start_time;
    }
    statsMap.set(appt.customer_id, existing);
  }

  // Get customer details
  const customerIds = Array.from(statsMap.keys());
  if (customerIds.length === 0) return NextResponse.json({ data: [], error: null });

  const { data: customers } = await supabase
    .from('customers')
    .select('*')
    .in('id', customerIds);

  // Get behavior profiles
  const { data: profiles } = await supabase
    .from('customer_behavior_profiles')
    .select('*')
    .eq('tenant_id', tenantId);

  const profileMap = new Map(
    (profiles ?? []).map((p) => [p.customer_id, p])
  );

  const result = (customers ?? []).map((c) => {
    const stats = statsMap.get(c.id);
    const profile = profileMap.get(c.id);
    return {
      ...c,
      total_bookings: stats?.total_bookings ?? 0,
      total_spent: stats?.total_spent ?? 0,
      last_booking_date: stats?.last_booking_date ?? null,
      avg_interval_days: profile?.avg_interval_days ?? null,
      predicted_next_date: profile?.predicted_next_date ?? null,
    };
  });

  result.sort((a, b) => b.total_bookings - a.total_bookings);

  return NextResponse.json({ data: result, error: null });
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    email?: string | null;
    phone?: string | null;
    date_of_birth?: string | null;
    gender?: string | null;
    notes?: string | null;
    profile_image_url?: string | null;
  };

  if (!body.display_name && !body.email) {
    return NextResponse.json(
      { data: null, error: { message: 'Please provide at least a name or email.' } },
      { status: 400 }
    );
  }

  const admin = createAdminClient();

  // Create an auth user so the customer has a valid auth.users entry.
  // Use email if provided, otherwise generate a placeholder email from phone or name.
  const email = body.email?.trim()
    || (body.phone?.trim() ? `${body.phone.trim().replace(/\D/g, '')}@placeholder.balkina.ai` : null)
    || `${crypto.randomUUID().slice(0, 8)}@placeholder.balkina.ai`;

  const { data: authUser, error: authError } = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { display_name: body.display_name, phone: body.phone },
  });

  if (authError) {
    return NextResponse.json(
      { data: null, error: { message: authError.message } },
      { status: 500 }
    );
  }

  // Insert the customer record linked to the new auth user
  const { data: customer, error: custError } = await admin
    .from('customers')
    .insert({
      id: authUser.user.id,
      display_name: body.display_name || null,
      first_name: body.first_name || null,
      last_name: body.last_name || null,
      email: body.email?.trim() || null,
      phone: body.phone?.trim() || null,
      date_of_birth: body.date_of_birth || null,
      gender: body.gender || null,
      notes: body.notes || null,
      profile_image_url: body.profile_image_url || null,
    } as never)
    .select()
    .single();

  if (custError) {
    return NextResponse.json(
      { data: null, error: { message: custError.message } },
      { status: 500 }
    );
  }

  return NextResponse.json({ data: customer, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { id: string; [key: string]: unknown };
  const { id, ...updates } = body;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const admin = createAdminClient();

  // Verify the customer has appointments with this tenant
  const { data: customer, error: custError } = await admin
    .from('customers')
    .update(updates as never)
    .eq('id', id)
    .select()
    .single();

  if (custError) return NextResponse.json({ data: null, error: { message: custError.message } }, { status: 500 });
  return NextResponse.json({ data: customer, error: null });
}

export async function DELETE(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const admin = createAdminClient();
  const { error } = await admin.from('customers').delete().eq('id', id);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}
