'use client';

import { useEffect, useState } from 'react';
import type { GrowthProspect, GrowthProspectStage } from '@balkina/shared';
import { GROWTH_PROSPECT_STAGES } from '@balkina/shared';
import { STAGE_COLORS, STAGE_LABELS, claimUrl, enrichmentOf } from '@/components/prospect-row';
import { BTN, BTN_WHITE, ProspectComposer, ProspectTimeline, quickSend, useProspectActivity } from '@/components/prospect-crm';
import { claimLinkFor, dueState, formatSeconds, relativeTime, whatsappDigits } from '@/lib/growth/outreach';

/**
 * Right-side drawer for one prospect: sticky header with stage + primary
 * actions, then Overview / Message / Activity tabs. The list stays visible
 * behind it; prev/next walk the current page of results.
 */

type Tab = 'overview' | 'message' | 'activity';
type Patch = Partial<Pick<GrowthProspect, 'stage' | 'notes' | 'email' | 'instagram' | 'phone'>>;

interface Props {
  row: GrowthProspect;
  busy: string | null;
  initialTab?: Tab;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onUpdate: (patch: Patch) => void;
  onRowChange: (row: GrowthProspect) => void;
  onError: (msg: string) => void;
  onEnrich: () => void;
  onBuild: () => void;
  onDelete: () => void;
}

const SECTION = 'text-[11px] font-semibold uppercase tracking-wider text-gray-500';
const INPUT = 'mt-1 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

export function ProspectDrawer({ row, busy, initialTab = 'overview', hasPrev, hasNext, onPrev, onNext, onClose, onUpdate, onRowChange, onError, onEnrich, onBuild, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [shown, setShown] = useState(false);
  const [sending, setSending] = useState(false);
  const api = useProspectActivity(row, onRowChange, onError);

  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  useEffect(() => { setTab(initialTab); }, [row.id, initialTab]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const send = async (channel: 'whatsapp' | 'instagram') => {
    setSending(true);
    try {
      const updated = await quickSend(row, channel);
      if (updated) { onRowChange(updated); await api.reload(); setTab('activity'); }
      else onError('No usable phone number for WhatsApp — add one under Overview.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not log the message');
    }
    setSending(false);
  };

  const canWhatsApp = !!whatsappDigits(row.phone, row.country);
  const ready = !!row.tenant_id && !row.claimed_at;
  const due = row.claimed_at ? null : dueState(row.next_follow_up_at);
  const eventCount = api.events?.length ?? null;
  const anyBusy = busy !== null || sending;

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <div className={`absolute inset-0 bg-gray-900/30 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside className={`absolute inset-y-0 right-0 flex w-full max-w-[660px] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out ${shown ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* Header */}
        <header className="shrink-0 border-b border-gray-200 px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-semibold text-gray-900">{row.name}</h2>
              <p className="truncate text-xs text-gray-500">
                {[row.vertical?.replace(/_/g, ' '), row.city, row.country?.toUpperCase()].filter(Boolean).join(' · ')}
                {row.google_rating != null && <> · {row.google_rating}★ ({row.google_review_count ?? 0})</>}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button onClick={onPrev} disabled={!hasPrev} aria-label="Previous" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </button>
              <button onClick={onNext} disabled={!hasNext} aria-label="Next" className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              </button>
              <button onClick={onClose} aria-label="Close" className="ml-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              value={row.stage}
              onChange={(e) => onUpdate({ stage: e.target.value as GrowthProspectStage })}
              className={`rounded-full border-0 px-2.5 py-1 text-xs font-medium ${STAGE_COLORS[row.stage] ?? ''}`}
            >
              {GROWTH_PROSPECT_STAGES.map((s) => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.icp_score >= 4 ? 'bg-green-100 text-green-800' : row.icp_score >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>score {row.icp_score}</span>
            {due && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${due.cls}`}>{due.label}</span>}
            {row.claimed_at && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">claimed {relativeTime(row.claimed_at)}</span>}
            {row.last_activity_type && <span className="text-xs text-gray-400">Last: {relativeTime(row.last_activity_at)}</span>}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {ready && canWhatsApp && (
              <button onClick={() => send('whatsapp')} disabled={anyBusy} className={`${BTN} bg-[#25D366] text-white hover:brightness-95`}>
                {sending ? 'Logging…' : row.touches > 0 ? 'WhatsApp follow-up' : 'Send on WhatsApp'}
              </button>
            )}
            {ready && row.instagram && (
              <button onClick={() => send('instagram')} disabled={anyBusy} className={`${BTN} bg-pink-600 text-white hover:bg-pink-700`}>
                {row.touches > 0 ? 'Instagram follow-up' : 'Instagram DM'}
              </button>
            )}
            {ready && !canWhatsApp && !row.instagram && (
              <button onClick={() => setTab('message')} className={`${BTN} bg-brand-600 text-white hover:bg-brand-700`}>Write message</button>
            )}
            {!row.tenant_id && (
              <button onClick={onBuild} disabled={anyBusy} className={`${BTN} bg-brand-600 text-white hover:bg-brand-700`}>{busy === 'build' ? 'Building…' : 'Build booking page'}</button>
            )}
            <button onClick={onEnrich} disabled={anyBusy} className={BTN_WHITE}>{busy === 'enrich' ? 'Enriching…' : row.enriched_at ? 'Re-enrich' : 'Enrich'}</button>
            <button onClick={onDelete} className="ml-auto text-xs text-gray-400 hover:text-red-600">delete</button>
          </div>

          <nav className="-mb-3 mt-3 flex gap-5 text-sm">
            {([['overview', 'Overview'], ['message', 'Message'], ['activity', 'Activity']] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`border-b-2 pb-2 font-medium transition-colors ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                {label}
                {k === 'activity' && eventCount !== null && <span className="ml-1 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{eventCount}</span>}
              </button>
            ))}
          </nav>
        </header>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {tab === 'overview' && <OverviewTab row={row} onUpdate={onUpdate} />}
          {tab === 'message' && <ProspectComposer row={row} api={api} />}
          {tab === 'activity' && <ProspectTimeline row={row} api={api} />}
        </div>
      </aside>
    </div>
  );
}

function OverviewTab({ row, onUpdate }: { row: GrowthProspect; onUpdate: (patch: Patch) => void }) {
  const [phone, setPhone] = useState(row.phone ?? '');
  const [email, setEmail] = useState(row.email ?? '');
  const [instagram, setInstagram] = useState(row.instagram ?? '');
  const [notes, setNotes] = useState(row.notes ?? '');
  const [copied, setCopied] = useState<string | null>(null);
  useEffect(() => { setPhone(row.phone ?? ''); setEmail(row.email ?? ''); setInstagram(row.instagram ?? ''); setNotes(row.notes ?? ''); }, [row.id, row.phone, row.email, row.instagram, row.notes]);

  const enrichment = enrichmentOf(row);
  const fullLink = claimUrl(row);
  const shortLink = claimLinkFor(row, null);
  const copy = async (key: string, value: string) => {
    try { await navigator.clipboard.writeText(value); setCopied(key); setTimeout(() => setCopied(null), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-6">
      {/* Engagement at a glance */}
      <section className="grid grid-cols-4 gap-2">
        <Stat label="Sent" value={String(row.touches)} />
        <Stat label="Page views" value={String(row.page_views)} />
        <Stat label="Time on page" value={row.page_seconds ? formatSeconds(row.page_seconds) : '—'} />
        <Stat label="Tested booking" value={row.demo_completed_at ? relativeTime(row.demo_completed_at) : '—'} />
      </section>

      {/* Contact */}
      <section>
        <p className={SECTION}>Contact</p>
        <div className="mt-2 grid gap-3 sm:grid-cols-3">
          <label className="text-xs text-gray-500">
            Phone (WhatsApp)
            <input value={phone} onChange={(e) => setPhone(e.target.value)} onBlur={() => onUpdate({ phone: phone || null })} className={INPUT} />
          </label>
          <label className="text-xs text-gray-500">
            Instagram handle
            <input value={instagram} onChange={(e) => setInstagram(e.target.value)} onBlur={() => onUpdate({ instagram: instagram || null })} className={INPUT} />
          </label>
          <label className="text-xs text-gray-500">
            Email
            <input value={email} onChange={(e) => setEmail(e.target.value)} onBlur={() => onUpdate({ email: email || null })} className={INPUT} />
          </label>
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {row.website && !/instagram\.com|facebook\.com/.test(row.website) && <a href={row.website} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">{row.website.replace(/^https?:\/\/(www\.)?/, '')}</a>}
          {row.instagram && <a href={`https://instagram.com/${row.instagram}`} target="_blank" rel="noreferrer" className="text-pink-600 hover:underline">@{row.instagram}</a>}
          {row.google_maps_url && <a href={row.google_maps_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">Google Maps</a>}
          {row.address && <span className="text-gray-500">{row.address}</span>}
        </div>
      </section>

      {/* Booking page */}
      <section>
        <p className={SECTION}>Booking page</p>
        {row.tenant_id ? (
          <div className="mt-2 rounded-lg border border-violet-200 bg-violet-50 p-3 text-xs text-violet-900">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold">Built {row.preprovisioned_at ? relativeTime(row.preprovisioned_at) : ''}</span>
              {row.claimed_at ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-emerald-800">claimed {new Date(row.claimed_at).toLocaleDateString()} by {row.claim_email}</span>
              ) : row.claim_expires_at ? (
                <span className="text-violet-700">link valid until {new Date(row.claim_expires_at).toLocaleDateString()}</span>
              ) : null}
            </div>
            {shortLink && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <code className="rounded bg-white px-2 py-1 text-[11px] text-gray-800">{shortLink}</code>
                <button onClick={() => copy('short', shortLink)} className="text-violet-700 hover:underline">{copied === 'short' ? 'copied!' : 'copy short link'}</button>
                {fullLink && <button onClick={() => copy('full', fullLink)} className="text-violet-700 hover:underline">{copied === 'full' ? 'copied!' : 'copy full link'}</button>}
                {fullLink && <a href={fullLink} target="_blank" rel="noreferrer" className="text-violet-700 hover:underline">open</a>}
              </div>
            )}
            <p className="mt-1.5 text-violet-700">Hidden from customers until the business claims it. Links in messages are tagged by channel.</p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No page yet. Build one from the header to get a claim link.</p>
        )}
      </section>

      {/* Enrichment */}
      <section>
        <p className={SECTION}>What we know</p>
        {!enrichment ? (
          <p className="mt-2 text-sm text-gray-500">Not enriched yet.</p>
        ) : (
          <div className="mt-2 rounded-lg border border-gray-200 bg-white p-3 text-xs text-gray-700">
            <div className="mb-1 flex flex-wrap items-center gap-2">
              <span className="text-gray-400">{new Date(enrichment.fetched_at).toLocaleString()}</span>
              {enrichment.fetched_url && !enrichment.skipped && <a href={enrichment.fetched_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">site</a>}
              {enrichment.contact_url && <a href={enrichment.contact_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">contact page</a>}
              {enrichment.skipped && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-gray-500">{enrichment.skipped === 'social_only' ? 'Instagram/Facebook page instead of a website' : 'no website'}</span>}
              {enrichment.error && <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">website could not be fetched</span>}
              {enrichment.booking_widget && enrichment.booking_widget !== 'Balkina' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">uses {enrichment.booking_widget}</span>}
            </div>
            {enrichment.summary && <p className="mb-2 text-gray-600">{enrichment.summary}</p>}
            <dl className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
              <Fact k="Owner" v={enrichment.owner_name ?? null} />
              <Fact k="Emails" v={enrichment.emails.length ? enrichment.emails.join(', ') : null} />
              <Fact k="Phones" v={enrichment.phones.length ? enrichment.phones.join(', ') : null} />
              <Fact k="Socials" v={Object.entries(enrichment.socials ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || null} />
              <Fact k="Hours" v={enrichment.hours ? Object.entries(enrichment.hours).map(([d, h]) => `${d} ${h}`).join(', ') : null} />
              <Fact k={`Services (${enrichment.services?.length ?? 0})`} v={(enrichment.services ?? []).slice(0, 8).map((s) => `${s.name}${s.price != null ? ` ${s.price}${s.currency ? ' ' + s.currency : ''}` : ''}`).join(' · ') || null} />
            </dl>
          </div>
        )}
        <p className="mt-2 text-[11px] text-gray-400">
          Google: {(row.google_types ?? []).slice(0, 6).join(', ') || '—'} · {row.business_status ?? '—'} · added {new Date(row.created_at).toLocaleDateString()}
        </p>
      </section>

      {/* Notes */}
      <section>
        <p className={SECTION}>Notes</p>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => onUpdate({ notes: notes || null })} rows={3} className={INPUT} placeholder="Anything worth remembering about this business…" />
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
      <p className="text-[11px] text-gray-500">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{value}</p>
    </div>
  );
}

function Fact({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="min-w-0">
      <span className="text-gray-400">{k}:</span> <span className="break-words">{v ?? '—'}</span>
    </div>
  );
}
