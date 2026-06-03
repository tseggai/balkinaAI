import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

/**
 * GET /api/invite?code=... — resolve a property invite code to its property
 * name + prefilled email so the /join form can show a branded banner.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) return Response.json({ valid: false });

  try {
    const supabase = getSupabase();
    const { data: invite } = await supabase
      .from('property_invites')
      .select('property_id, email, status, expires_at')
      .eq('invite_code', code)
      .maybeSingle();

    if (!invite || invite.status !== 'pending' || new Date(invite.expires_at) <= new Date()) {
      return Response.json({ valid: false });
    }

    const { data: prop } = await supabase
      .from('properties')
      .select('name')
      .eq('id', invite.property_id)
      .single();

    return Response.json({ valid: true, propertyName: prop?.name ?? null, email: invite.email });
  } catch {
    return Response.json({ valid: false });
  }
}
