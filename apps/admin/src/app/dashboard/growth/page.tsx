'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

interface GrowthStats {
  prospects: {
    total: number;
    bySegment: Record<string, number>;
    byStage: Record<string, number>;
    byCountry: Record<string, number>;
    byVertical: Record<string, number>;
    withEmail: number;
    withInstagram: number;
    withWebsite: number;
    highScore: number;
  };
  targets: { total: number; enabled: number; neverRun: number; lastRunAt: string | null };
  enrollments: { total: number; byStatus: Record<string, number> };
  eventsLast7d: Record<string, number>;
}

interface RunResult {
  targets_run: number;
  places_found: number;
  inserted: number;
  updated: number;
  api_requests: number;
  errors: { target: string; message: string }[];
  stopped_reason: string | null;
}

export default function GrowthOverviewPage() {
  const [stats, setStats] = useState<GrowthStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [batch, setBatch] = useState(10);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const res = await fetch('/api/admin/growth/stats');
    if (res.ok) setStats(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const runProspector = async () => {
    setRunning(true);
    setError('');
    setResult(null);
    try {
      const res = await fetch('/api/admin/growth/prospector', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ limit: batch }),
      });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? 'Prospector failed');
      else setResult(json);
      await load();
    } catch {
      setError('Network error while running the prospector.');
    }
    setRunning(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
      </div>
    );
  }

  const p = stats?.prospects;
  const t = stats?.targets;
  const topVerticals = Object.entries(p?.byVertical ?? {}).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const stages = Object.entries(p?.byStage ?? {}).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Growth</h1>
          <p className="mt-1 text-sm text-gray-500">
            Prospecting, outreach and ad performance. Plan: <code className="rounded bg-gray-100 px-1">docs/GTM_GROWTH_PLAN.md</code>
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/growth/targets" className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            Search targets
          </Link>
          <Link href="/dashboard/growth/prospects" className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700">
            Prospects
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Prospects" value={p?.total ?? 0} sub={`${p?.bySegment.tenant ?? 0} tenant · ${p?.bySegment.property ?? 0} property`} />
        <Kpi label="High ICP score (≥ 4)" value={p?.highScore ?? 0} sub="ready for enrichment" />
        <Kpi label="With email" value={p?.withEmail ?? 0} sub={`${p?.withInstagram ?? 0} with Instagram · ${p?.withWebsite ?? 0} with website`} />
        <Kpi label="Enrollments" value={stats?.enrollments.total ?? 0} sub={Object.entries(stats?.enrollments.byStatus ?? {}).map(([k, v]) => `${v} ${k}`).join(' · ') || 'no sequences yet'} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Prospector */}
        <div className="rounded-xl border border-gray-200 bg-white p-5 lg:col-span-1">
          <h2 className="text-base font-semibold text-gray-900">Prospector</h2>
          <p className="mt-1 text-sm text-gray-500">
            Google Places search over the vertical × city matrix. {t?.enabled ?? 0} of {t?.total ?? 0} targets enabled, {t?.neverRun ?? 0} never run.
          </p>
          <p className="mt-1 text-xs text-gray-400">
            Last run: {t?.lastRunAt ? new Date(t.lastRunAt).toLocaleString() : 'never'}
          </p>
          <div className="mt-4 flex items-center gap-2">
            <label className="text-sm text-gray-600">Targets per run</label>
            <select value={batch} onChange={(e) => setBatch(Number(e.target.value))} className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm">
              {[5, 10, 20, 40].map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
          <button
            onClick={runProspector}
            disabled={running}
            className="mt-3 w-full rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {running ? 'Running…' : 'Run next batch'}
          </button>
          <p className="mt-2 text-xs text-gray-400">
            Each target costs up to 3 Places API requests (~60 businesses). Unattended runs: POST <code>/api/growth/cron/prospect</code> with the <code>GROWTH_CRON_SECRET</code> bearer token.
          </p>

          {error && <div className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
          {result && (
            <div className="mt-3 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">
              Ran {result.targets_run} targets · found {result.places_found} · new {result.inserted} · refreshed {result.updated} · {result.api_requests} API requests
              {result.stopped_reason && <div className="mt-1 text-red-700">Stopped: {result.stopped_reason}</div>}
              {result.errors.length > 0 && !result.stopped_reason && (
                <ul className="mt-1 list-disc pl-4 text-xs text-amber-800">
                  {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e.target}: {e.message}</li>)}
                </ul>
              )}
            </div>
          )}
        </div>

        {/* Funnel */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Pipeline by stage</h2>
          <ul className="mt-3 space-y-2">
            {stages.length === 0 && <li className="text-sm text-gray-400">No prospects yet — run the prospector.</li>}
            {stages.map(([stage, n]) => (
              <li key={stage} className="flex items-center justify-between text-sm">
                <Link href={`/dashboard/growth/prospects?stage=${stage}`} className="text-gray-700 hover:text-brand-700">{stage.replace('_', ' ')}</Link>
                <span className="font-semibold text-gray-900">{n}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-sm font-semibold text-gray-900">By country</h3>
          <ul className="mt-2 space-y-1">
            {Object.entries(p?.byCountry ?? {}).sort((a, b) => b[1] - a[1]).map(([c, n]) => (
              <li key={c} className="flex justify-between text-sm text-gray-600"><span>{c.toUpperCase()}</span><span>{n}</span></li>
            ))}
          </ul>
        </div>

        {/* Verticals + activity */}
        <div className="rounded-xl border border-gray-200 bg-white p-5">
          <h2 className="text-base font-semibold text-gray-900">Top verticals</h2>
          <ul className="mt-3 space-y-2">
            {topVerticals.length === 0 && <li className="text-sm text-gray-400">—</li>}
            {topVerticals.map(([v, n]) => (
              <li key={v} className="flex items-center justify-between text-sm">
                <Link href={`/dashboard/growth/prospects?vertical=${v}`} className="text-gray-700 hover:text-brand-700">{v.replace(/_/g, ' ')}</Link>
                <span className="font-semibold text-gray-900">{n}</span>
              </li>
            ))}
          </ul>
          <h3 className="mt-5 text-sm font-semibold text-gray-900">Outreach events, last 7 days</h3>
          <ul className="mt-2 space-y-1">
            {Object.keys(stats?.eventsLast7d ?? {}).length === 0 && <li className="text-sm text-gray-400">No outreach yet.</li>}
            {Object.entries(stats?.eventsLast7d ?? {}).map(([k, v]) => (
              <li key={k} className="flex justify-between text-sm text-gray-600"><span>{k}</span><span>{v}</span></li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: number; sub: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-1 text-3xl font-bold text-gray-900">{value}</p>
      <p className="mt-1 truncate text-xs text-gray-400">{sub}</p>
    </div>
  );
}
