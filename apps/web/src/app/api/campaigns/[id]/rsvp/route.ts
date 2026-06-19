import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { notifyRsvpConfirmation } from '@/lib/notify-campaign';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

/** Public RSVP / sign-up submission for a campaign from the customer app. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json() as { data?: Record<string, unknown>; userId?: string };

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: camp } = await supabase
    .from('property_campaigns')
    .select('id, is_active')
    .eq('id', id)
    .maybeSingle();
  if (!camp || !(camp as { is_active: boolean }).is_active) {
    return NextResponse.json({ error: 'This campaign is no longer accepting entries.' }, { status: 404, headers: CORS_HEADERS });
  }

  let customerId: string | null = null;
  if (body.userId) {
    const { data: cust } = await supabase
      .from('customers')
      .select('id')
      .or(`id.eq.${body.userId},user_id.eq.${body.userId}`)
      .limit(1)
      .maybeSingle();
    customerId = (cust as { id: string } | null)?.id ?? null;
  }

  const { data: inserted, error } = await supabase
    .from('campaign_entries')
    .insert({ campaign_id: id, customer_id: customerId, data: body.data ?? {} } as never)
    .select('id')
    .single();
  if (error || !inserted) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500, headers: CORS_HEADERS });

  const entryId = (inserted as { id: string }).id;
  await notifyRsvpConfirmation(supabase, id, entryId, body.data ?? {}, customerId);

  return NextResponse.json({ status: 'submitted', entryId }, { status: 201, headers: CORS_HEADERS });
}
