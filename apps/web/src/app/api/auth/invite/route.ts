import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

// Public lookup for a property invite code, used by the registration page to
// show a "You've been invited" banner and prefill the email. No auth required —
// only non-sensitive fields are returned and only for valid, pending invites.
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  if (!code) return NextResponse.json({ valid: false });

  const supabase = createAdminClient();

  const { data: inviteData } = await supabase
    .from('property_invites')
    .select('property_id, email, status, expires_at')
    .eq('invite_code', code)
    .maybeSingle();
  const invite = inviteData as { property_id: string; email: string | null; status: string; expires_at: string } | null;

  if (!invite || invite.status !== 'pending' || new Date(invite.expires_at) <= new Date()) {
    return NextResponse.json({ valid: false });
  }

  const { data: propData } = await supabase
    .from('properties')
    .select('name')
    .eq('id', invite.property_id)
    .single();

  return NextResponse.json({
    valid: true,
    propertyName: (propData as { name: string } | null)?.name ?? null,
    email: invite.email,
  });
}
