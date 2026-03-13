import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const body = await request.json() as { token: string; email: string; password: string; name?: string };
  const { token, email, password, name } = body;

  if (!token || !email || !password) {
    return NextResponse.json({ data: null, error: { message: 'Missing required fields: token, email, password' } }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Find staff by invite token
  const { data: staffRow, error: findErr } = await supabase
    .from('staff')
    .select('id, tenant_id, name, invite_expires_at, user_id')
    .eq('invite_token', token.toUpperCase())
    .single();

  if (findErr || !staffRow) {
    return NextResponse.json({ data: null, error: { message: 'Invalid invite code' } }, { status: 400 });
  }

  const staff = staffRow as { id: string; tenant_id: string; name: string; invite_expires_at: string | null; user_id: string | null };

  // Check if already accepted
  if (staff.user_id) {
    return NextResponse.json({ data: null, error: { message: 'This invite has already been accepted' } }, { status: 400 });
  }

  // Check expiry
  if (staff.invite_expires_at && new Date(staff.invite_expires_at) < new Date()) {
    return NextResponse.json({ data: null, error: { message: 'Invite code has expired. Ask your manager to send a new one.' } }, { status: 400 });
  }

  // Create Supabase Auth user
  const { data: authData, error: authErr } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      display_name: name || staff.name,
      role: 'staff',
      staff_id: staff.id,
      tenant_id: staff.tenant_id,
    },
  });

  if (authErr || !authData.user) {
    // If user already exists, try to find them
    if (authErr?.message?.includes('already been registered')) {
      const { data: existingUsers } = await supabase.auth.admin.listUsers();
      const existing = existingUsers?.users?.find((u: { email?: string }) => u.email === email);
      if (existing) {
        // Link existing user to staff
        const { error: linkErr } = await supabase
          .from('staff')
          .update({
            user_id: existing.id,
            invite_token: null,
            invite_expires_at: null,
            invite_accepted_at: new Date().toISOString(),
          } as never)
          .eq('id', staff.id);

        if (linkErr) {
          return NextResponse.json({ data: null, error: { message: linkErr.message } }, { status: 500 });
        }

        return NextResponse.json({ data: { staff_id: staff.id, message: 'Account linked successfully. Sign in with your credentials.' }, error: null });
      }
    }
    return NextResponse.json({ data: null, error: { message: authErr?.message ?? 'Failed to create account' } }, { status: 500 });
  }

  // Link auth user to staff row
  const { error: linkErr } = await supabase
    .from('staff')
    .update({
      user_id: authData.user.id,
      email: email,
      invite_token: null,
      invite_expires_at: null,
      invite_accepted_at: new Date().toISOString(),
    } as never)
    .eq('id', staff.id);

  if (linkErr) {
    return NextResponse.json({ data: null, error: { message: linkErr.message } }, { status: 500 });
  }

  return NextResponse.json({
    data: { staff_id: staff.id, user_id: authData.user.id, message: 'Account created. You can now sign in.' },
    error: null,
  });
}
