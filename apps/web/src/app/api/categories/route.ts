import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('categories')
    .select('id, name, slug')
    .order('display_order');

  if (error) return NextResponse.json({ data: [], error: error.message });
  return NextResponse.json({ data });
}
