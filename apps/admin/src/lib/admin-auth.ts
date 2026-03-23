import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

/**
 * Verify the request comes from a platform_admin user.
 * Returns { admin: true, supabase } on success, or a 401/403 NextResponse.
 */
export async function requireAdmin() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { admin: false as const, response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const role = (user.app_metadata?.role as string) ?? '';
  if (role !== 'platform_admin') {
    return { admin: false as const, response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  const adminClient = createAdminClient();
  return { admin: true as const, user, supabase: adminClient };
}
