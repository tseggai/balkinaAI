'use client';

import { useEffect, useState } from 'react';
import type { GrowthProspect } from '@balkina/shared';
import { GROWTH_PROSPECT_STAGES } from '@balkina/shared';
import { STAGE_LABELS, enrichmentOf } from '@/components/prospect-row';
import {
  BTN_DANGER,
  BTN_PRIMARY,
  BTN_SECONDARY,
  ChannelIcon,
  INPUT,
  ProspectFollowUp,
  ProspectMessages,
  ProspectTimeline,
  SECTION_TITLE,
  useProspectActivity,
} from '@/components/prospect-crm';
import { claimLinkFor, dueState, formatSeconds, relativeTime, whatsappDigits } from '@/lib/growth/outreach';

/**
 * Right-side drawer for one prospect. Header = business profile (name,
 * place, contacts, booking page, what we know) with an Edit mode; tabs =
 * Overview (stats, notes, messages, follow-up) and Activity (timeline).
 */

type Tab = 'overview' | 'activity';
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

export function ProspectDrawer({ row, busy, initialTab = 'overview', hasPrev, hasNext, onPrev, onNext, onClose, onUpdate, onRowChange, onError, onEnrich, onBuild, onDelete }: Props) {
  const [tab, setTab] = useState<Tab>(initialTab === 'activity' ? 'activity' : 'overview');
  const [shown, setShown] = useState(false);
  const [editing, setEditing] = useState(false);
  const [copied, setCopied] = useState(false);
  const api = useProspectActivity(row, onRowChange, onError);

  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  useEffect(() => { setTab(initialTab === 'activity' ? 'activity' : 'overview'); setEditing(false); }, [row.id, initialTab]);
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

  const digits = whatsappDigits(row.phone, row.country);
  const due = row.claimed_at ? null : dueState(row.next_follow_up_at);
  const shortLink = claimLinkFor(row, null);
  const enrichment = enrichmentOf(row);
  const eventCount = api.events?.length ?? null;
  const stageOptions = GROWTH_PROSPECT_STAGES.map((s) => ({ value: s, label: STAGE_LABELS[s] }));
  const copyLink = async () => {
    if (!shortLink) return;
    try { await navigator.clipboard.writeText(shortLink); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true">
      <div className={`absolute inset-0 bg-gray-900/30 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside className={`absolute inset-y-0 right-0 flex w-full max-w-[680px] flex-col bg-gray-50 shadow-2xl transition-transform duration-200 ease-out ${shown ? 'translate-x-0' : 'translate-x-full'}`}>
        {/* ── Business profile ─────────────────────────────────────────── */}
        <header className="shrink-0 border-b border-gray-200 bg-white px-6 pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold text-gray-900">{row.name}</h2>
                <button onClick={onEnrich} disabled={busy !== null} title={enrichment ? `Enriched ${relativeTime(row.enriched_at)}` : 'Fetch website, services, contacts'} className="rounded-md border border-gray-300 bg-white px-2 py-0.5 text-xs font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50">
                  {busy === 'enrich' ? 'Enriching…' : row.enriched_at ? 'Re-enrich' : 'Enrich'}
                </button>
              </div>
              <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm text-gray-500">
                <span>
                  {[row.city, row.country?.toUpperCase()].filter(Boolean).join(', ')}
                  {row.google_rating != null && <> · {row.google_rating}★ ({row.google_review_count ?? 0} reviews)</>}
                  {row.vertical && <> · {row.vertical.replace(/_/g, ' ')}</>}
                  {row.google_maps_url && <> · <a href={row.google_maps_url} target="_blank" rel="noreferrer" className="text-brand-600 hover:underline">map</a></>}
                </span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${row.icp_score >= 4 ? 'bg-green-100 text-green-800' : row.icp_score >= 2 ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'}`}>score {row.icp_score}</span>
                {due && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${due.cls}`}>{due.label}</span>}
                {row.claimed_at && <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">claimed {relativeTime(row.claimed_at)}</span>}
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

          {editing ? (
            <EditForm row={row} onCancel={() => setEditing(false)} onSave={(patch) => { onUpdate(patch); setEditing(false); }} onDelete={onDelete} />
          ) : (
            <>
              {/* Contact */}
              <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
                {row.phone && (
                  <a href={digits ? `https://wa.me/${digits}` : `tel:${row.phone}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900" title={digits ? 'Open WhatsApp chat' : 'Call'}>
                    <ChannelIcon channel="whatsapp" />{row.phone}
                  </a>
                )}
                {row.instagram && (
                  <a href={`https://ig.me/m/${row.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900" title="Open Instagram DM">
                    <ChannelIcon channel="instagram" />@{row.instagram}
                  </a>
                )}
                {row.email && (
                  <a href={`mailto:${row.email}`} className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900" title="Send email">
                    <ChannelIcon channel="email" />{row.email}
                  </a>
                )}
                {row.website && !/instagram\.com|facebook\.com/.test(row.website) && (
                  <a href={row.website} target="_blank" rel="noreferrer" className="flex items-center gap-1.5 text-gray-700 hover:text-gray-900">
                    <ChannelIcon channel="other" />{row.website.replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '')}
                  </a>
                )}
                {!row.phone && !row.instagram && !row.email && <span className="text-gray-400">No contact details yet.</span>}
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125" /></svg>
                  Edit
                </button>
              </div>

              {/* Booking page */}
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                {shortLink ? (
                  <>
                    <a href={shortLink} target="_blank" rel="noreferrer" className="font-mono text-brand-600 hover:underline">{shortLink.replace(/^https?:\/\//, '')}</a>
                    <button onClick={copyLink} className="flex items-center gap-1 text-gray-500 hover:text-gray-800" title="Copy link">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>
                      {copied ? 'Copied' : ''}
                    </button>
                    {row.claimed_at ? (
                      <span className="text-xs text-emerald-700">claimed by {row.claim_email}</span>
                    ) : row.claim_expires_at ? (
                      <span className="text-xs text-gray-500">valid until {new Date(row.claim_expires_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}</span>
                    ) : null}
                  </>
                ) : (
                  <>
                    <span className="text-gray-400">No booking page yet.</span>
                    <button onClick={onBuild} disabled={busy !== null} className={BTN_PRIMARY}>{busy === 'build' ? 'Building…' : 'Build booking page'}</button>
                  </>
                )}
              </div>

            </>
          )}

          {/* Tabs */}
          <nav className="mt-4 flex gap-6 text-sm">
            {([['overview', 'Overview'], ['activity', 'Activity']] as [Tab, string][]).map(([k, label]) => (
              <button
                key={k}
                onClick={() => setTab(k)}
                className={`border-b-2 pb-2.5 font-medium transition-colors ${tab === k ? 'border-brand-600 text-brand-700' : 'border-transparent text-gray-500 hover:text-gray-800'}`}
              >
                {label}
                {k === 'activity' && eventCount !== null && <span className="ml-1.5 rounded-full bg-gray-100 px-1.5 py-0.5 text-[11px] text-gray-600">{eventCount}</span>}
              </button>
            ))}
          </nav>
        </header>

        {/* ── Body ─────────────────────────────────────────────────────── */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {tab === 'overview' ? (
            <div className="space-y-4">
              <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                <Stat label="Sent" value={String(row.touches)} />
                <Stat label="Page views" value={String(row.page_views)} />
                <Stat label="Time on page" value={row.page_seconds ? formatSeconds(row.page_seconds) : '—'} />
                <Stat label="Tested booking" value={row.demo_completed_at ? relativeTime(row.demo_completed_at) : '—'} />
              </section>
              <NotesCard row={row} onUpdate={onUpdate} />
              <ProspectMessages row={row} api={api} stageOptions={stageOptions} onStageChange={(stage) => onUpdate({ stage })} />
              <ProspectFollowUp row={row} api={api} />
              {enrichment && <KnownCard row={row} enrichment={enrichment} />}
            </div>
          ) : (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <ProspectTimeline row={row} api={api} />
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

function EditForm({ row, onCancel, onSave, onDelete }: { row: GrowthProspect; onCancel: () => void; onSave: (patch: Patch) => void; onDelete: () => void }) {
  const [phone, setPhone] = useState(row.phone ?? '');
  const [instagram, setInstagram] = useState(row.instagram ?? '');
  const [email, setEmail] = useState(row.email ?? '');
  return (
    <div className="mt-4 rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-xs font-medium text-gray-600">
          Phone (WhatsApp)
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className={`mt-1 ${INPUT}`} placeholder="+382 67 …" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Instagram handle
          <input value={instagram} onChange={(e) => setInstagram(e.target.value.replace(/^@/, ''))} className={`mt-1 ${INPUT}`} placeholder="handle" />
        </label>
        <label className="text-xs font-medium text-gray-600">
          Email
          <input value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${INPUT}`} placeholder="owner@…" />
        </label>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button onClick={onDelete} className={BTN_DANGER}>Delete business</button>
        <div className="flex gap-2">
          <button onClick={onCancel} className={BTN_SECONDARY}>Cancel</button>
          <button onClick={() => onSave({ phone: phone.trim() || null, instagram: instagram.trim() || null, email: email.trim() || null })} className={BTN_PRIMARY}>Save</button>
        </div>
      </div>
    </div>
  );
}

function NotesCard({ row, onUpdate }: { row: GrowthProspect; onUpdate: (patch: Patch) => void }) {
  const [notes, setNotes] = useState(row.notes ?? '');
  useEffect(() => { setNotes(row.notes ?? ''); }, [row.id, row.notes]);
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className={SECTION_TITLE}>Notes</h3>
      <textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={() => { if (notes !== (row.notes ?? '')) onUpdate({ notes: notes || null }); }} rows={2} className={`mt-2 ${INPUT}`} placeholder="Anything worth remembering about this business…" />
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">{label}</p>
      <p className="mt-1 truncate text-xl font-bold text-gray-900">{value}</p>
    </div>
  );
}

/** Enrichment facts, shown at the bottom of Overview once a site has been fetched. */
function KnownCard({ row, enrichment }: { row: GrowthProspect; enrichment: NonNullable<ReturnType<typeof enrichmentOf>> }) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className={SECTION_TITLE}>What we know</h3>
        <span className="text-xs text-gray-400">{new Date(enrichment.fetched_at).toLocaleString()}</span>
        {enrichment.fetched_url && !enrichment.skipped && <a href={enrichment.fetched_url} target="_blank" rel="noreferrer" className="text-xs text-brand-600 hover:underline">site</a>}
        {enrichment.skipped && <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">{enrichment.skipped === 'social_only' ? 'Instagram/Facebook page instead of a website' : 'no website'}</span>}
        {enrichment.error && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">website could not be fetched</span>}
        {enrichment.booking_widget && enrichment.booking_widget !== 'Balkina' && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700">uses {enrichment.booking_widget}</span>}
      </div>
      {enrichment.summary && <p className="mt-2 text-sm text-gray-600">{enrichment.summary}</p>}
      <dl className="mt-2 grid gap-x-4 gap-y-1 text-xs text-gray-700 sm:grid-cols-2">
        <Fact k="Owner" v={enrichment.owner_name ?? null} />
        <Fact k="Emails" v={enrichment.emails.length ? enrichment.emails.join(', ') : null} />
        <Fact k="Phones" v={enrichment.phones.length ? enrichment.phones.join(', ') : null} />
        <Fact k="Socials" v={Object.entries(enrichment.socials ?? {}).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join(' · ') || null} />
        <Fact k="Hours" v={enrichment.hours ? Object.entries(enrichment.hours).map(([d, h]) => `${d} ${h}`).join(', ') : null} />
        <Fact k="Services" v={(enrichment.services ?? []).slice(0, 10).map((s) => `${s.name}${s.price != null ? ` ${s.price}${s.currency ? ' ' + s.currency : ''}` : ''}`).join(' · ') || null} />
        <Fact k="Google" v={`${(row.google_types ?? []).slice(0, 5).join(', ') || '—'} · ${row.business_status ?? '—'} · added ${new Date(row.created_at).toLocaleDateString()}`} />
      </dl>
    </section>
  );
}

function Fact({ k, v }: { k: string; v: string | null }) {
  return (
    <div className="min-w-0">
      <span className="text-gray-400">{k}:</span> <span className="break-words">{v ?? '—'}</span>
    </div>
  );
}
