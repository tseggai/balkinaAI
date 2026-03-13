import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

async function getStaffRecord(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;

  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;

  const { data: staff } = await admin
    .from('staff')
    .select('id, tenant_id, name')
    .eq('user_id', user.id)
    .single();

  return staff as { id: string; tenant_id: string; name: string } | null;
}

const VALID_TRANSITIONS: Record<string, string[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['completed', 'no_show', 'cancelled'],
};

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const staff = await getStaffRecord(request);
  if (!staff) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { status: string };
  const newStatus = body.status;

  if (!newStatus) {
    return NextResponse.json({ data: null, error: { message: 'Missing status' } }, { status: 400 });
  }

  const admin = createAdminClient();

  // Verify appointment belongs to this staff
  const { data: appt, error: fetchErr } = await admin
    .from('appointments')
    .select('id, status, customer_id, service_id, tenant_id')
    .eq('id', params.id)
    .eq('staff_id', staff.id)
    .single();

  if (fetchErr || !appt) {
    return NextResponse.json({ data: null, error: { message: 'Appointment not found' } }, { status: 404 });
  }

  const appointment = appt as { id: string; status: string; customer_id: string; service_id: string; tenant_id: string };

  // Validate status transition
  const allowed = VALID_TRANSITIONS[appointment.status];
  if (!allowed || !allowed.includes(newStatus)) {
    return NextResponse.json({
      data: null,
      error: { message: `Cannot transition from ${appointment.status} to ${newStatus}` },
    }, { status: 400 });
  }

  // Update appointment status
  const { data: updated, error: updateErr } = await admin
    .from('appointments')
    .update({ status: newStatus } as never)
    .eq('id', params.id)
    .select()
    .single();

  if (updateErr) {
    return NextResponse.json({ data: null, error: { message: updateErr.message } }, { status: 500 });
  }

  return NextResponse.json({ data: updated, error: null });
}
