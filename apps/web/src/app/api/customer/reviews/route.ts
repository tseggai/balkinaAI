/**
 * POST /api/customer/reviews
 * Submit a review for a completed appointment.
 * Body: { appointmentId, userId, rating (1-5), comment? }
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      appointmentId: string;
      userId: string;
      rating: number;
      comment?: string;
    };
    const { appointmentId, userId, rating, comment } = body;

    if (!appointmentId || !userId || !rating) {
      return NextResponse.json(
        { error: 'appointmentId, userId, and rating are required' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return NextResponse.json(
        { error: 'Rating must be an integer from 1 to 5' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    const supabase = createAdminClient();

    // Find customer ID from userId
    let customerId: string | null = null;
    const { data: byUserId } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle();
    if (byUserId) customerId = (byUserId as { id: string }).id;

    if (!customerId) {
      const { data: byId } = await supabase
        .from('customers')
        .select('id')
        .eq('id', userId)
        .limit(1)
        .maybeSingle();
      if (byId) customerId = (byId as { id: string }).id;
    }

    if (!customerId) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404, headers: CORS_HEADERS });
    }

    // Verify appointment belongs to customer and is completed
    const { data: appt, error: apptErr } = await supabase
      .from('appointments')
      .select('id, status, customer_id, tenant_id, staff_id')
      .eq('id', appointmentId)
      .eq('customer_id', customerId)
      .single();

    if (apptErr || !appt) {
      return NextResponse.json({ error: 'Appointment not found' }, { status: 404, headers: CORS_HEADERS });
    }

    const appointment = appt as { id: string; status: string; customer_id: string; tenant_id: string; staff_id: string | null };

    if (appointment.status !== 'completed') {
      return NextResponse.json(
        { error: 'Can only review completed appointments' },
        { status: 400, headers: CORS_HEADERS },
      );
    }

    // Check if review already exists
    const { data: existing } = await supabase
      .from('reviews')
      .select('id')
      .eq('appointment_id', appointmentId)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'You have already reviewed this appointment' },
        { status: 409, headers: CORS_HEADERS },
      );
    }

    // Create the review
    const { data: review, error: insertErr } = await supabase
      .from('reviews')
      .insert({
        appointment_id: appointmentId,
        customer_id: customerId,
        tenant_id: appointment.tenant_id,
        staff_id: appointment.staff_id,
        rating,
        comment: comment?.trim() || null,
      } as never)
      .select()
      .single();

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500, headers: CORS_HEADERS });
    }

    return NextResponse.json({ success: true, review }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[customer/reviews] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
