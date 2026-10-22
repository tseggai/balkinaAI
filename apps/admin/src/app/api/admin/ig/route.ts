import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { igConfig, planState } from '@/lib/ig/runner';

// GET /api/admin/ig — settings, overrides, and the 40-row plan with effective schedule + publish-log state.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const cfg = igConfig();
  const state = await planState(auth.supabase, cfg);
  return NextResponse.json({ config: cfg, ...state });
}
