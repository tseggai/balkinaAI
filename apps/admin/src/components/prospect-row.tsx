'use client';

import { useState } from 'react';
import type { GrowthEnrichment, GrowthProspect, GrowthProspectStage } from '@balkina/shared';
import { GROWTH_PROSPECT_STAGES } from '@balkina/shared';
import { ProspectCrm, quickSend } from '@/components/prospect-crm';
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
  expanded: boolean;
  busy: string | null; // 'enrich' | 'build' | 'send' | null
  onSelect: (on: boolean) => void;
  onToggle: () => void;
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

function useCopy(link: string | null) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (!link) return;
    try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };
  return { copied, copy };
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

function Actions({ row, busy, copied, copy, onEnrich, onBuild, onDelete, onSend, onToggle }: { row: GrowthProspect; busy: string | null; copied: boolean; copy: () => void; onEnrich: () => void; onBuild: () => void; onDelete: () => void; onSend: (channel: 'whatsapp' | 'instagram') => void; onToggle: () => void }) {
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
          <button onClick={onToggle} className="font-medium text-gray-700 hover:underline">message</button>
        )
      )}
      {row.tenant_id ? (
        <button onClick={copy} className="text-violet-700 hover:underline">{copied ? 'copied!' : 'copy claim link'}</button>
      ) : (
        <button onClick={onBuild} disabled={busy !== null} className="text-brand-600 hover:underline disabled:opacity-50">
          {busy === 'build' ? 'building…' : 'build page'}
        </button>
      )}
      <button onClick={onEnrich} disabled={busy !== null} className="text-gray-600 hover:underline disabled:opacity-50">
        {busy === 'enrich' ? 'enriching…' : row.enriched_at ? 're-enrich' : 'enrich'}
      </button>
      <button onClick={onDelete} className="text-gray-400 hover:text-red-600">delete</button>
    </div>
  );
}

/** Expanded details: CRM panel (outreach + timeline), contact fields, claim link, enrichment, notes. Shared by the table row and the mobile card. */
export function ProspectDetails({ row, onUpdate, onRowChange, onError }: { row: GrowthProspect; onUpdate: (patch: Patch) => void; onRowChange: (row: GrowthProspect) => void; onError: (msg: string) => void }) {
  const [notes, setNotes] = useState(row.notes ?? '');
  const [email, setEmail] = useState(row.email ?? '');
  const [instagram, setInstagram] = useState(row.instagram ?? '');
  const [phone, setPhone] = useState(row.phone ?? '');
  const enrichment = enrichmentOf(row);
  const link = claimUrl(row);
  const { copied, copy } = useCopy(link);

  return (
    <div>
      <div className="mb-4 rounded-lg border border-gray-200 bg-white p-3">
        <ProspectCrm row={row} onRowChange={onRowChange} onError={onError} />
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="text-xs text-gray-500">
          Phone (WhatsApp)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => onUpdate({ phone: phone || null })} className="mt-1 w-full rounded-lg border border-gray-300 px-2 py-1.5 text-sm text-gray-900" />
        </label>
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
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded bg-white px-2 py-1 text-[11px] text-gray-800">{link}</code>
              <button onClick={copy} className="text-violet-700 hover:underline">{copied ? 'copied!' : 'copy'}</button>
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
            {!enrichment.skipped && !enrichment.error && !enrichment.llm_model && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">services not extracted: OPENAI_API_KEY missing</span>}
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
      else onError('No usable phone number for WhatsApp — add one in the details.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not log the message');
    }
    setSending(false);
  };
  return { sending, send };
}

/** Desktop table row. */
export function ProspectRow({ row, selected, expanded, busy, onSelect, onToggle, onUpdate, onRowChange, onError, onEnrich, onBuild, onDelete }: RowProps) {
  const enrichment = enrichmentOf(row);
  const { copied, copy } = useCopy(claimUrl(row));
  const chips = chipsFor(row, enrichment);
  const { sending, send } = useQuickSend(row, onRowChange, onError);
  const rowBusy = sending ? 'send' : busy;

  return (
    <>
      <tr className={`hover:bg-gray-50 ${selected ? 'bg-brand-50/40' : ''}`}>
        <td className="w-8 px-3 py-3">
          <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} />
        </td>
        <td className="px-3 py-3"><ScoreBadge score={row.icp_score} /></td>
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
        <td className="px-3 py-3"><ContactLines row={row} /></td>
        <td className="px-3 py-3"><StageSelect row={row} onUpdate={onUpdate} /></td>
        <td className="px-3 py-3"><ActivityCell row={row} /></td>
        <td className="whitespace-nowrap px-3 py-3 text-right">
          <Actions row={row} busy={rowBusy} copied={copied} copy={copy} onEnrich={onEnrich} onBuild={onBuild} onDelete={onDelete} onSend={send} onToggle={onToggle} />
        </td>
      </tr>
      {expanded && (
        <tr className="bg-gray-50">
          <td colSpan={10} className="px-6 py-4">
            <ProspectDetails row={row} onUpdate={onUpdate} onRowChange={onRowChange} onError={onError} />
          </td>
        </tr>
      )}
    </>
  );
}

/** Mobile card (same data and actions as the table row). */
export function ProspectCard({ row, selected, expanded, busy, onSelect, onToggle, onUpdate, onRowChange, onError, onEnrich, onBuild, onDelete }: RowProps) {
  const enrichment = enrichmentOf(row);
  const { copied, copy } = useCopy(claimUrl(row));
  const chips = chipsFor(row, enrichment);
  const { sending, send } = useQuickSend(row, onRowChange, onError);
  const rowBusy = sending ? 'send' : busy;

  return (
    <div className={`rounded-xl border bg-white p-3 ${selected ? 'border-brand-300 bg-brand-50/40' : 'border-gray-200'}`}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={selected} onChange={(e) => onSelect(e.target.checked)} className="mt-1" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <button onClick={onToggle} className="text-left text-sm font-semibold text-gray-900 hover:text-brand-700">{row.name}</button>
            <ScoreBadge score={row.icp_score} />
          </div>
          <div className="mt-0.5 text-xs text-gray-500">
            {row.vertical?.replace(/_/g, ' ')} · {row.city} {row.country?.toUpperCase()}
            {row.google_rating != null && <> · {row.google_rating}★ ({row.google_review_count ?? 0})</>}
            {row.google_maps_url && <a href={row.google_maps_url} target="_blank" rel="noreferrer" className="ml-1 text-brand-600 hover:underline">map</a>}
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
            <Actions row={row} busy={rowBusy} copied={copied} copy={copy} onEnrich={onEnrich} onBuild={onBuild} onDelete={onDelete} onSend={send} onToggle={onToggle} />
          </div>
        </div>
      </div>
      {expanded && (
        <div className="mt-3 border-t border-gray-100 pt-3">
          <ProspectDetails row={row} onUpdate={onUpdate} onRowChange={onRowChange} onError={onError} />
        </div>
      )}
    </div>
  );
}
