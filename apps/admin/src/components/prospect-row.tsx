'use client';

import { useState } from 'react';
import type { GrowthEnrichment, GrowthProspect, GrowthProspectStage } from '@balkina/shared';
import { GROWTH_PROSPECT_STAGES } from '@balkina/shared';

export const STAGE_LABELS: Record<GrowthProspectStage, string> = {
  new: 'New',
  enriched: 'Enriched',
  qualified: 'Qualified',
  disqualified: 'Disqualified',
  preprovisioned: 'Page ready',
  contacted: 'Contacted',
  replied: 'Replied',
  claimed: 'Claimed',
  signed_up: 'Signed up',
  customer: 'Customer',
  lost: 'Lost',
};

export const STAGE_COLORS: Record<string, string> = {
  new: 'bg-gray-100 text-gray-700',
  enriched: 'bg-sky-100 text-sky-800',
  qualified: 'bg-indigo-100 text-indigo-800',
  disqualified: 'bg-gray-100 text-gray-400',
  preprovisioned: 'bg-violet-100 text-violet-800',
  contacted: 'bg-blue-100 text-blue-800',
  replied: 'bg-amber-100 text-amber-800',
  claimed: 'bg-emerald-100 text-emerald-800',
  signed_up: 'bg-green-100 text-green-800',
  customer: 'bg-green-200 text-green-900',
  lost: 'bg-red-100 text-red-700',
};

export function enrichmentOf(row: GrowthProspect): GrowthEnrichment | null {
  return row.enriched_at && row.enrichment && typeof row.enrichment === 'object' && !Array.isArray(row.enrichment)
    ? (row.enrichment as unknown as GrowthEnrichment)
    : null;
}

export function claimUrl(row: GrowthProspect): string | null {
  if (!row.claim_token) return null;
  const base = (process.env.NEXT_PUBLIC_CLAIM_BASE_URL ?? 'https://balkina.ai').replace(/\/$/, '');
  return `${base}/claim/${row.claim_token}`;
}

interface Props {
  row: GrowthProspect;
  selected: boolean;
  expanded: boolean;
  busy: string | null; // 'enrich' | 'build' | null
  onSelect: (on: boolean) => void;
  onToggle: () => void;
  onUpdate: (patch: Partial<Pick<GrowthProspect, 'stage' | 'notes' | 'email' | 'instagram'>>) => void;
  onEnrich: () => void;
  onBuild: () => void;
  onDelete: () => void;
}

export function ProspectRow({ row, selected, expanded, busy, onSelect, onToggle, onUpdate, onEnrich, onBuild, onDelete }: Props) {
  const [notes, setNotes] = useState(row.notes ?? '');
  const [email, setEmail] = useState(row.email ?? '');
  const [instagram, setInstagram] = useState(row.instagram ?? '');
  const [copied, setCopied] = useState(false);
  const enrichment = enrichmentOf(row);
  const link = claimUrl(row);

  const copyLink = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  const chips: { text: string; cls: string }[] = [];
  if (enrichment?.skipped === 'social_only') chips.push({ text: 'Instagram only', cls: 'bg-pink-50 text-pink-700' });
  else if (enrichment?.skipped === 'no_website') chips.push({ text: 'No website', cls: 'bg-gray-100 text-gray-500' });
  else if (enrichment?.error) chips.push({ text: 'Site unreachable', cls: 'bg-red-50 text-red-600' });
  else if (enrichment) chips.push({ text: `${enrichment.services?.length ?? 0} services · ${enrichment.emails.length} emails`, cls: 'bg-sky-50 text-sky-700' });
  if (enrichment?.booking_widget && enrichment.booking_widget !== 'Balkina') chips.push({ text: `uses ${enrichment.booking_widget}`, cls: 'bg-amber-50 text-amber-700' });
  if (row.tenant_id && !row.claimed_at) chips.push({ text: 'Page ready', cls: 'bg-violet-50 text-violet-700' });
  if (row.claimed_at) chips.push({ text: 'Claimed', cls: 'bg-emerald-50 text-emerald-700' });

  return (
    <>
      <tr className={`hover:bg-gray-50 ${selected ? 'bg-brand-50/40' : ''}`}>
        <td className="w-8 px-3 py-3">
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} />
        </td>
        <td className="px-3 py-3">
          <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${row.icp_score >= 4 ? 'bg-green-100 text-green-800' : row.icp_score >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
            {row.icp_score}
          </span>
        </td>
        <td className="px-3 py-3">
          <button onClick={onToggle} className="text-left font-medium text-gray-900 hover:text-brand-700">{row.name}</button>
          <div className="truncate text-xs text-gray-400" style={{ maxWidth: 280 }}>{row.address}</div>
          {chips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {chips.map((c) => <span key={c.text} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${c.cls}`}>{c.text}</span>)}
            </div>
          )}
        </td>
        <td className="px-3 py-3 text-gray-600">{row.vertical?.replace(/_/g, ' ')}</td>
        <td className="px-3 py-3 text-gray-600">{row.city} <span className="text-gray-400">{row.country?.toUpperCase()}</span></td>
        <td className="px-3 py-3 text-gray-600">
          {row.google_rating != null ? `${row.google_rating}★ (${row.google_review_count ?? 0})` : '—'}
          {row.google_maps_url && <a href={row.google_maps_url} target="_blank" rel="noreferrer" className="ml-1 text-xs text-brand-600 hover:underline">map</a>}
        </td>
        <td className="px-3 py-3 text-xs text-gray-600">
          {row.website && !/instagram\.com|facebook\.com/.test(row.website) && (
            <a href={row.website} target="_blank" rel="noreferrer" className="block truncate text-brand-600 hover:underline" style={{ maxWidth: 170 }}>{row.website.replace(/^https?:\/\/(www\.)?/, '')}</a>
          )}
          {row.instagram && <a href={`https://instagram.com/${row.instagram}`} target="_blank" rel="noreferrer" className="block text-pink-600 hover:underline">@{row.instagram}</a>}
          {row.phone && <span className="block">{row.phone}</span>}
          {row.email && <span className="block truncate" style={{ maxWidth: 170 }}>{row.email}</span>}
        </td>
        <td className="px-3 py-3">
          <select
            value={row.stage}
            onChange={(e) => onUpdate({ stage: e.target.value as GrowthProspectStage })}
            className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${STAGE_COLORS[row.stage] ?? ''}`}
          >
            {GROWTH_PROSPECT_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
          </select>
        </td>
        <td className="whitespace-nowrap px-3 py-3 text-right text-xs">
          {row.tenant_id ? (
            <button onClick={copyLink} className="mr-3 text-violet-700 hover:underline">{copied ? 'copied!' : 'copy claim link'}</button>
          ) : (
            <button onClick={onBuild} disabled={busy !== null} className="mr-3 text-brand-600 hover:underline disabled:opacity-50">
              {busy === 'build' ? 'building…' : 'build page'}
            </button>
          )}
          <button onClick={onEnrich} disabled={busy !== null} className="mr-3 text-gray-600 hover:underline disabled:opacity-50">
            {busy === 'enrich' ? 'enriching…' : row.enriched_at ? 're-enrich' : 'enrich'}
          </button>
          <button onClick={onDelete} className="text-gray-400 hover:text-red-600">delete</button>
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid gap-4 md:grid-cols-3">
              <label className="text-xs text-gray-500">
                Email
                <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => onUpdate({ email: email || null })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
              </label>
              <label className="text-xs text-gray-500">
                Instagram handle
                <input value={instagram} onChange={(e) => setInstagram(e.target.value)} onBlur={() => onUpdate({ instagram: instagram || null })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
              </label>
              <div className="text-xs text-gray-500">
                Google types
                <div className="mt-1 text-gray-700">{(row.google_types ?? []).slice(0, 6).join(', ') || '—'}</div>
                <div className="mt-1 text-gray-400">Status: {row.business_status ?? '—'} · Added {new Date(row.created_at).toLocaleDateString()}</div>
              </div>
            </div>

            {row.tenant_id && (
              <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">Booking page built</span>
                  <span className="text-violet-700">{row.preprovisioned_at ? new Date(row.preprovisioned_at).toLocaleString() : ''}</span>
                  {row.claimed_at ? (
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">claimed {new Date(row.claimed_at).toLocaleDateString()} by {row.claim_email}</span>
                  ) : row.claim_expires_at ? (
                    <span className="text-violet-700">claim link valid until {new Date(row.claim_expires_at).toLocaleDateString()}</span>
                  ) : null}
                </div>
                {link && (
                  <div className="mt-1 flex items-center gap-2">
                    <code className="truncate rounded bg-white px-2 py-1 text-[11px] text-gray-800" style={{ maxWidth: 520 }}>{link}</code>
                    <button onClick={copyLink} className="text-violet-700 hover:underline">{copied ? 'copied!' : 'copy'}</button>
                    <a href={link} target="_blank" rel="noreferrer" className="text-violet-700 hover:underline">open</a>
                  </div>
                )}
                <div className="mt-1 text-violet-700">The page stays hidden from customers until the business claims it. Send the link in outreach.</div>
              </div>
            )}

            {enrichment && (
              <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-gray-900">Enrichment</span>
                  <span className="text-gray-400">{new Date(enrichment.fetched_at).toLocaleString()}</span>
                  {enrichment.fetched_url && !enrichment.skipped && <a href={enrichment.fetched_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">site</a>}
                  {enrichment.contact_url && <a href={enrichment.contact_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">contact page</a>}
                  {enrichment.skipped && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">skipped: {enrichment.skipped === 'social_only' ? 'Instagram/Facebook page instead of a website' : 'no website'}</span>}
                  {enrichment.error && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">website could not be fetched</span>}
                  {enrichment.llm_model && <span className="rounded-full bg-sky-100 px-2 py-0.5 text-sky-800">{enrichment.llm_model}</span>}
                  {enrichment && !enrichment.skipped && !enrichment.error && !enrichment.llm_model && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">services not extracted: OPENAI_API_KEY missing</span>}
                </div>
                {enrichment.summary && <p className="mb-1 text-gray-600">{enrichment.summary}</p>}
                <div className="grid gap-2 md:grid-cols-3">
                  <div>
                    <span className="text-gray-400">Emails:</span> {enrichment.emails.length ? enrichment.emails.join(', ') : '—'}
                    <br /><span className="text-gray-400">Phones:</span> {enrichment.phones.length ? enrichment.phones.join(', ') : '—'}
                    {enrichment.owner_name && <><br /><span className="text-gray-400">Owner:</span> {enrichment.owner_name}</>}
                  </div>
                  <div>
                    <span className="text-gray-400">Socials:</span>{' '}
                    {Object.entries(enrichment.socials ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || '—'}
                    {enrichment.hours && <><br /><span className="text-gray-400">Hours:</span> {Object.entries(enrichment.hours).map(([d, h]) => `${d} ${h}`).join(', ')}</>}
                  </div>
                  <div>
                    <span className="text-gray-400">Services ({enrichment.services?.length ?? 0}):</span>{' '}
                    {(enrichment.services ?? []).slice(0, 8).map((s) => `${s.name}${s.price != null ? ` ${s.price}${s.currency ? ' ' + s.currency : ''}` : ''}`).join(' · ') || '—'}
                  </div>
                </div>
              </div>
            )}

            <label className="mt-3 block text-xs text-gray-500">
              Notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onUpdate({ notes: notes || null })} rows={2} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
            </label>
          </td>
        </tr>
      )}
    </>
  );
}
