import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, avg_rating, review_count, payments_enabled')
    .eq('user_id', user.id)
    .single();

  if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 404 });

  return NextResponse.json({ data: tenant });
}
