import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { checkAccount } from '@/lib/ig/runner';

// POST /api/admin/ig/check — verifies the deployed token against the Instagram account (no publishing).
export async function POST() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  return NextResponse.json(await checkAccount(auth.supabase));
}
