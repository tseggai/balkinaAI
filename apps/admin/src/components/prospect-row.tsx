'use client';

import { useState } from 'react';
import type { GrowthEnrichment, GrowthProspect, GrowthProspectStage } from '@balkina/shared';
import { GROWTH_PROSPECT_STAGES } from '@balkina/shared';
import { quickSend } from '@/components/prospect-crm';
import { activityLabel, dueState, formatSeconds, relativeTime, whatsappDigits } from '@/lib/growth/outreach';

export const STAGE_LABELS: Record<GrowthProspectStage, string> = {
  new: 'New',
  enriched: 'Enriched',
  qualified: 'Qualified',
  disqualified: 'Disqualified',
  preprovisioned: 'Page ready',
  contacted: 'Contacted',
  viewed: 'Viewed page',
  engaged: 'Engaged',
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
  viewed: 'bg-cyan-100 text-cyan-800',
  engaged: 'bg-teal-100 text-teal-800',
  replied: 'bg-amber-100 text-amber-800',
  claimed: 'bg-emerald-100 text-emerald-800',
  signed_up: 'bg-green-100 text-green-800',
  customer: 'bg-green-200 text-green-900',
  lost: 'bg-red-100 text-red-700',
};

export type DrawerTab = 'overview' | 'activity';

export function enrichmentOf(row: GrowthProspect): GrowthEnrichment | null {
  return row.enriched_at && row.enrichment && typeof row.enrichment === 'object' && !Array.isArray(row.enrichment)
    ? (row.enrichment as unknown as GrowthEnrichment)
    : null;
}

/** Full claim link (the short, channel-tagged form lives in lib/growth/outreach). */
export function claimUrl(row: GrowthProspect): string | null {
  if (!row.claim_token) return null;
  const base = (process.env.NEXT_PUBLIC_CLAIM_BASE_URL ?? 'https://balkina.ai').replace(/\/$/, '');
  return `${base}/claim/${row.claim_token}`;
}

function chipsFor(row: GrowthProspect, enrichment: GrowthEnrichment | null): { text: string; cls: string }[] {
  const chips: { text: string; cls: string }[] = [];
  if (enrichment?.skipped === 'social_only') chips.push({ text: 'Instagram only', cls: 'bg-pink-50 text-pink-700' });
  else if (enrichment?.skipped === 'no_website') chips.push({ text: 'No website', cls: 'bg-gray-100 text-gray-500' });
  else if (enrichment?.error) chips.push({ text: 'Site unreachable', cls: 'bg-red-50 text-red-600' });
  else if (enrichment) chips.push({ text: `${enrichment.services?.length ?? 0} services · ${enrichment.emails.length} emails`, cls: 'bg-sky-50 text-sky-700' });
  if (enrichment?.booking_widget && enrichment.booking_widget !== 'Balkina') chips.push({ text: `uses ${enrichment.booking_widget}`, cls: 'bg-amber-50 text-amber-700' });
  if (row.tenant_id && !row.claimed_at) chips.push({ text: 'Page ready', cls: 'bg-violet-50 text-violet-700' });
  if (row.claimed_at) chips.push({ text: 'Claimed', cls: 'bg-emerald-50 text-emerald-700' });
  return chips;
}

type Patch = Partial<Pick<GrowthProspect, 'stage' | 'notes' | 'email' | 'instagram' | 'phone'>>;

interface RowProps {
  row: GrowthProspect;
  selected: boolean;
  /** This row is open in the drawer. */
  active: boolean;
  busy: string | null; // 'enrich' | 'build' | 'send' | null
  onSelect: (on: boolean) => void;
  onOpen: (tab?: DrawerTab) => void;
  onUpdate: (patch: Patch) => void;
  /** Replace the whole row after the server changed it (activity log, trigger-driven stage). */
  onRowChange: (row: GrowthProspect) => void;
  onError: (msg: string) => void;
  onEnrich: () => void;
  onBuild: () => void;
  onDelete: () => void;
}

/** Last thing the prospect did, how long they spent, and when the next follow-up is due. */
export function ActivityCell({ row, compact = false }: { row: GrowthProspect; compact?: boolean }) {
  const due = row.claimed_at ? null : dueState(row.next_follow_up_at);
  const last = row.last_activity_type ? `${activityLabel(row.last_activity_type)} · ${relativeTime(row.last_activity_at)}` : row.touches > 0 ? `Sent · ${relativeTime(row.last_contacted_at)}` : null;
  return (
    <div className={`text-xs ${compact ? 'flex flex-wrap items-center gap-x-2 gap-y-1' : 'space-y-1'}`}>
      {last ? <span className="block text-gray-700">{last}</span> : <span className="block text-gray-300">—</span>}
      {(row.page_views > 0 || row.touches > 0) && (
        <span className="block text-[11px] text-gray-400">
          {row.touches > 0 && `${row.touches} sent`}
          {row.touches > 0 && row.page_views > 0 && ' · '}
          {row.page_views > 0 && `${row.page_views} view${row.page_views === 1 ? '' : 's'}${row.page_seconds > 0 ? ` · ${formatSeconds(row.page_seconds)}` : ''}`}
        </span>
      )}
      {due && <span className={`inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${due.cls}`}>{due.label}</span>}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${score >= 4 ? 'bg-green-100 text-green-800' : score >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>
      {score}
    </span>
  );
}

function StageSelect({ row, onUpdate, className = '' }: { row: GrowthProspect; onUpdate: (p: Patch) => void; className?: string }) {
  return (
    <select
      value={row.stage}
      onChange={(e) => onUpdate({ stage: e.target.value as GrowthProspectStage })}
      className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${STAGE_COLORS[row.stage] ?? ''} ${className}`}
    >
      {GROWTH_PROSPECT_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
    </select>
  );
}

function ContactLines({ row, maxWidth = 170 }: { row: GrowthProspect; maxWidth?: number }) {
  return (
    <div className="text-xs text-gray-600">
      {row.website && !/instagram\.com|facebook\.com/.test(row.website) && (
        <a href={row.website} target="_blank" rel="noreferrer" className="block truncate text-brand-600 hover:underline" style={{ maxWidth }}>{row.website.replace(/^https?:\/\/(www\.)?/, '')}</a>
      )}
      {row.instagram && <a href={`https://instagram.com/${row.instagram}`} target="_blank" rel="noreferrer" className="block truncate text-pink-600 hover:underline" style={{ maxWidth }}>@{row.instagram}</a>}
      {row.phone && <a href={`tel:${row.phone}`} className="block">{row.phone}</a>}
      {row.email && <span className="block truncate" style={{ maxWidth }}>{row.email}</span>}
    </div>
  );
}

function useQuickSend(row: GrowthProspect, onRowChange: (row: GrowthProspect) => void, onError: (msg: string) => void) {
  const [sending, setSending] = useState(false);
  const send = async (channel: 'whatsapp' | 'instagram') => {
    setSending(true);
    try {
      const updated = await quickSend(row, channel);
      if (updated) onRowChange(updated);
      else onError('No usable phone number for WhatsApp — add one in the prospect panel.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not log the message');
    }
    setSending(false);
  };
  return { sending, send };
}

function Actions({ row, busy, onEnrich, onBuild, onSend, onOpen }: { row: GrowthProspect; busy: string | null; onEnrich: () => void; onBuild: () => void; onSend: (channel: 'whatsapp' | 'instagram') => void; onOpen: (tab?: DrawerTab) => void }) {
  const canWhatsApp = !!whatsappDigits(row.phone, row.country);
  const ready = !!row.tenant_id && !row.claimed_at;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
      {ready && (
        canWhatsApp ? (
          <button onClick={() => onSend('whatsapp')} disabled={busy !== null} className="font-medium text-[#128C7E] hover:underline disabled:opacity-50">
            {busy === 'send' ? 'logging…' : row.touches > 0 ? 'WhatsApp follow-up' : 'WhatsApp'}
          </button>
        ) : row.instagram ? (
          <button onClick={() => onSend('instagram')} disabled={busy !== null} className="font-medium text-pink-600 hover:underline disabled:opacity-50">
            {busy === 'send' ? 'logging…' : row.touches > 0 ? 'IG follow-up' : 'Instagram'}
          </button>
        ) : (
          <button onClick={() => onOpen('overview')} className="font-medium text-gray-700 hover:underline">message</button>
        )
      )}
      {!row.tenant_id && (
        <button onClick={onBuild} disabled={busy !== null} className="text-brand-600 hover:underline disabled:opacity-50">
          {busy === 'build' ? 'building…' : 'build page'}
        </button>
      )}
      {!row.enriched_at && (
        <button onClick={onEnrich} disabled={busy !== null} className="text-gray-600 hover:underline disabled:opacity-50">
          {busy === 'enrich' ? 'enriching…' : 'enrich'}
        </button>
      )}
      <button onClick={() => onOpen('overview')} className="text-gray-500 hover:underline">open</button>
    </div>
  );
}

/** Desktop table row. */
export function ProspectRow({ row, selected, active, busy, onSelect, onOpen, onUpdate, onRowChange, onError, onEnrich, onBuild }: RowProps) {
  const enrichment = enrichmentOf(row);
  const chips = chipsFor(row, enrichment);
  const { sending, send } = useQuickSend(row, onRowChange, onError);
  const rowBusy = sending ? 'send' : busy;

  return (
    <tr className={`cursor-pointer hover:bg-gray-50 ${active ? 'bg-brand-50/60' : selected ? 'bg-brand-50/40' : ''}`} onClick={() => onOpen()}>
      <td className="w-8 px-3 py-3" onClick={(e) => e.stopPropagation()}>
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} />
      </td>
      <td className="px-3 py-3"><ScoreBadge score={row.icp_score} /></td>
      <td className="px-3 py-3">
        <span className="font-medium text-gray-900">{row.name}</span>
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
        {row.google_maps_url && <a href={row.google_maps_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="ml-1 text-xs text-brand-600 hover:underline">map</a>}
      </td>
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><ContactLines row={row} /></td>
      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}><StageSelect row={row} onUpdate={onUpdate} /></td>
      <td className="px-3 py-3"><ActivityCell row={row} /></td>
      <td className="whitespace-nowrap px-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
        <Actions row={row} busy={rowBusy} onEnrich={onEnrich} onBuild={onBuild} onSend={send} onOpen={onOpen} />
      </td>
    </tr>
  );
}

/** Mobile card (same data and actions as the table row). */
export function ProspectCard({ row, selected, active, busy, onSelect, onOpen, onUpdate, onRowChange, onError, onEnrich, onBuild }: RowProps) {
  const enrichment = enrichmentOf(row);
  const chips = chipsFor(row, enrichment);
  const { sending, send } = useQuickSend(row, onRowChange, onError);
  const rowBusy = sending ? 'send' : busy;

  return (
    <div className={`rounded-xl border bg-white p-3 ${active ? 'border-brand-400 bg-brand-50/60' : selected ? 'border-brand-300 bg-brand-50/40' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button onClick={() => onOpen()} className="text-left text-sm font-semibold text-gray-900 hover:text-brand-700">{row.name}</button>
            <ScoreBadge score={row.icp_score} />
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {row.vertical?.replace(/_/g, ' ')} · {row.city} {row.country?.toUpperCase()}
            {row.google_rating != null && <> · {row.google_rating}★ ({row.google_review_count ?? 0})</>}
          </div>
          {chips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {chips.map((c) => <span key={c.text} className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${c.cls}`}>{c.text}</span>)}
            </div>
          )}
          <div className="mt-2"><ContactLines row={row} maxWidth={260} /></div>
          <div className="mt-2"><ActivityCell row={row} compact /></div>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <StageSelect row={row} onUpdate={onUpdate} />
            <Actions row={row} busy={rowBusy} onEnrich={onEnrich} onBuild={onBuild} onSend={send} onOpen={onOpen} />
          </div>
        </div>
      </div>
    </div>
  );
}
