import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

// POST /api/admin/canva/disconnect — forget the stored tokens (templates are kept).
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  await auth.supabase.from('canva_connection').delete().eq('id', 1);
  return NextResponse.json({ ok: true });
}
