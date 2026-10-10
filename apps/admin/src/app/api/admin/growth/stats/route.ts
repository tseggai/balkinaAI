import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

// GET /api/admin/growth/stats — funnel counts for the Growth overview
export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const supabase = auth.supabase;
  const [prospects, targets, enrollments, events] = await Promise.all([
    supabase.from('growth_prospects').select('segment, stage, country, vertical, icp_score, email, instagram, website'),
    supabase.from('growth_search_targets').select('id, enabled, last_run_at, total_found'),
    supabase.from('growth_enrollments').select('status'),
    supabase
      .from('growth_events')
      .select('type')
      .gte('created_at', new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()),
  ]);

  const rows = (prospects.data ?? []) as {
    segment: string; stage: string; country: string | null; vertical: string | null;
    icp_score: number; email: string | null; instagram: string | null; website: string | null;
  }[];

  const count = (key: keyof (typeof rows)[number]) => {
    const out: Record<string, number> = {};
    for (const r of rows) {
      const k = String(r[key] ?? 'unknown');
      out[k] = (out[k] ?? 0) + 1;
    }
    return out;
  };

  const targetRows = (targets.data ?? []) as { enabled: boolean; last_run_at: string | null; total_found: number }[];
  const eventRows = (events.data ?? []) as { type: string }[];
  const eventsByType: Record<string, number> = {};
  for (const e of eventRows) eventsByType[e.type] = (eventsByType[e.type] ?? 0) + 1;

  const enrollmentRows = (enrollments.data ?? []) as { status: string }[];
  const enrollmentsByStatus: Record<string, number> = {};
  for (const e of enrollmentRows) enrollmentsByStatus[e.status] = (enrollmentsByStatus[e.status] ?? 0) + 1;

  return NextResponse.json({
    prospects: {
      total: rows.length,
      bySegment: count('segment'),
      byStage: count('stage'),
      byCountry: count('country'),
      byVertical: count('vertical'),
      withEmail: rows.filter((r) => r.email).length,
      withInstagram: rows.filter((r) => r.instagram).length,
      withWebsite: rows.filter((r) => r.website).length,
      highScore: rows.filter((r) => r.icp_score >= 4).length,
    },
    targets: {
      total: targetRows.length,
      enabled: targetRows.filter((t) => t.enabled).length,
      neverRun: targetRows.filter((t) => t.enabled && !t.last_run_at).length,
      lastRunAt: targetRows.map((t) => t.last_run_at).filter(Boolean).sort().at(-1) ?? null,
    },
    enrollments: { total: enrollmentRows.length, byStatus: enrollmentsByStatus },
    eventsLast7d: eventsByType,
  });
}
