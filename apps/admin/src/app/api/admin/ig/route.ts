import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { igConfig, planStatus } from '@/lib/ig/runner';

// GET /api/admin/ig — the 40-row plan with scheduled dates and publish-log state, plus deployment config.
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const cfg = igConfig();
  const rows = await planStatus(auth.supabase, cfg);
  return NextResponse.json({ config: cfg, rows });
}
