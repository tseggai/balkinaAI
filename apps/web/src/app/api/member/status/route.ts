import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * The signed-in customer's membership for a property (for the app's account
 * badge / resident gating). Returns { data: null } when not a member.
 * Auth: Bearer access token preferred; falls back to ?userId= for parity with
 * the existing customer endpoints.
 */
export async function GET(request: Request) {
  const admin = createAdminClient();
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug')?.trim();
  if (!slug) return NextResponse.json({ data: null }, { headers: CORS_HEADERS });

  let userId = searchParams.get('userId')?.trim() || null;
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (token) {
    const { data: { user } } = await admin.auth.getUser(token);
    if (user) userId = user.id;
  }
  if (!userId) return NextResponse.json({ data: null }, { headers: CORS_HEADERS });

  const { data: propRow } = await admin.from('properties').select('id').eq('slug', slug).maybeSingle();
  const property = propRow as { id: string } | null;
  if (!property) return NextResponse.json({ data: null }, { headers: CORS_HEADERS });

  const { data: member } = await admin
    .from('property_members')
    .select('member_type, unit, status')
    .eq('property_id', property.id)
    .eq('customer_id', userId)
    .maybeSingle();

  const m = member as { member_type: string; unit: string | null; status: string } | null;
  return NextResponse.json({ data: m && m.status === 'active' ? m : null }, { headers: CORS_HEADERS });
}
