import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { memberTypeLabel } from '@balkina/shared';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

interface Body {
  slug?: string;
  code?: string;
  unit?: string | null;
}

/**
 * Customer redeems an owner-distributed member code. The code is the proof, so
 * a valid redemption makes the customer an ACTIVE member of the code's type
 * instantly. Auth: the customer's Supabase access token (Bearer).
 */
export async function POST(request: Request) {
  const admin = createAdminClient();

  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return NextResponse.json({ error: 'Sign in to verify your residence.' }, { status: 401, headers: CORS_HEADERS });
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return NextResponse.json({ error: 'Session expired. Please sign in again.' }, { status: 401, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => ({}))) as Body;
  const slug = body.slug?.trim();
  const code = body.code?.trim().toUpperCase();
  if (!slug || !code) return NextResponse.json({ error: 'A code is required.' }, { status: 400, headers: CORS_HEADERS });

  const { data: propRow } = await admin.from('properties').select('id, name').eq('slug', slug).maybeSingle();
  const property = propRow as { id: string; name: string } | null;
  if (!property) return NextResponse.json({ error: 'Property not found.' }, { status: 404, headers: CORS_HEADERS });

  const { data: codeRow } = await admin
    .from('property_member_codes')
    .select('*')
    .eq('property_id', property.id)
    .eq('code', code)
    .maybeSingle();
  const memberCode = codeRow as {
    id: string; member_type: string; unit: string | null; is_active: boolean;
    expires_at: string | null; max_redemptions: number | null; redemption_count: number;
  } | null;

  // Same generic message for every invalid case so codes can't be probed.
  const invalid = () => NextResponse.json({ error: "That code isn't valid. Check it and try again." }, { status: 400, headers: CORS_HEADERS });
  if (!memberCode || !memberCode.is_active) return invalid();
  if (memberCode.expires_at && new Date(memberCode.expires_at) <= new Date()) return invalid();
  if (memberCode.max_redemptions != null && memberCode.redemption_count >= memberCode.max_redemptions) return invalid();

  const unit = (body.unit?.trim() || memberCode.unit) ?? null;
  const nowIso = new Date().toISOString();

  // One membership per customer per property — re-redeeming updates type/unit
  // and re-activates a previously revoked membership.
  const { data: saved, error } = await admin
    .from('property_members')
    .upsert(
      {
        property_id: property.id,
        customer_id: user.id,
        member_type: memberCode.member_type,
        unit,
        status: 'active',
        source: 'code',
        code_id: memberCode.id,
        verified_at: nowIso,
        updated_at: nowIso,
      },
      { onConflict: 'property_id,customer_id' },
    )
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: 'Could not verify right now. Please try again.' }, { status: 500, headers: CORS_HEADERS });

  // Best-effort redemption count bump (not transactional — a soft analytics/cap
  // signal, not a security boundary).
  await admin
    .from('property_member_codes')
    .update({ redemption_count: memberCode.redemption_count + 1 })
    .eq('id', memberCode.id);

  return NextResponse.json(
    {
      data: saved,
      message: `You're verified as a ${memberTypeLabel(memberCode.member_type)} at ${property.name}.`,
    },
    { headers: CORS_HEADERS },
  );
}
