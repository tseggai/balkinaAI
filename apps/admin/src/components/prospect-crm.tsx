'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GrowthProspect } from '@balkina/shared';
import {
  OUTREACH_STEPS,
  activityLabel,
  defaultLang,
  dueState,
  followUpIn,
  formatSeconds,
  isProspectAction,
  nextStep,
  outreachMessage,
  relativeTime,
  whatsappDigits,
  whatsappHref,
  type OutreachChannel,
  type OutreachLang,
  type OutreachStep,
} from '@/lib/growth/outreach';

/**
 * CRM building blocks for one prospect, used by the drawer:
 * - useProspectActivity: events + the shared "run an action, refresh" loop
 * - ProspectMessages: channel-first composer (the link tag follows the channel)
 * - ProspectFollowUp: follow-up date + inbound logging
 * - ProspectTimeline: notes + event list
 * Every send is logged as a `sent` event; the DB trigger turns events into
 * stage + counters, and the refreshed row flows back through `onRowChange`.
 */

export interface ActivityEvent {
  id: string;
  type: string;
  channel: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

interface LogBody {
  type: 'sent' | 'replied' | 'note' | 'call';
  channel?: 'whatsapp' | 'instagram' | 'email' | 'phone' | 'other';
  text?: string;
  step?: OutreachStep;
  lang?: OutreachLang;
  next_follow_up_at?: string | null;
}

export async function logActivity(id: string, body: LogBody): Promise<GrowthProspect> {
  const res = await fetch(`/api/admin/growth/prospects/${id}/activity`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? 'Could not log activity');
  return json.prospect as GrowthProspect;
}

/** One-click send from the row: opens WhatsApp (or copies for Instagram), logs it, schedules the follow-up. */
export async function quickSend(row: GrowthProspect, channel: 'whatsapp' | 'instagram'): Promise<GrowthProspect | null> {
  const step = nextStep(row);
  const lang = defaultLang(row);
  const text = outreachMessage(row, step, lang, channel);
  if (channel === 'whatsapp') {
    const digits = whatsappDigits(row.phone, row.country);
    if (!digits) return null;
    window.open(whatsappHref(digits, text), '_blank', 'noopener');
  } else {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked — the composer still shows the text */ }
    if (row.instagram) window.open(`https://ig.me/m/${row.instagram}`, '_blank', 'noopener');
  }
  const days = OUTREACH_STEPS.find((s) => s.key === step)?.followUpDays ?? null;
  return logActivity(row.id, { type: 'sent', channel, step, lang, text, next_follow_up_at: days ? followUpIn(days) : null });
}

export interface ActivityApi {
  events: ActivityEvent[] | null;
  busy: string;
  run: (key: string, fn: () => Promise<GrowthProspect | void>) => Promise<void>;
  reload: () => Promise<void>;
}

export function useProspectActivity(row: GrowthProspect, onRowChange: (row: GrowthProspect) => void, onError: (msg: string) => void): ActivityApi {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [busy, setBusy] = useState('');

  const reload = useCallback(async () => {
    const res = await fetch(`/api/admin/growth/prospects/${row.id}/activity`);
    if (res.ok) setEvents(((await res.json()).data ?? []) as ActivityEvent[]);
  }, [row.id]);

  useEffect(() => { setEvents(null); reload(); }, [reload]);

  const run = useCallback(async (key: string, fn: () => Promise<GrowthProspect | void>) => {
    setBusy(key);
    try {
      const updated = await fn();
      if (updated) onRowChange(updated);
      await reload();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Request failed');
    }
    setBusy('');
  }, [onRowChange, onError, reload]);

  return { events, busy, run, reload };
}

/* ─── Shared styles (match app.balkina.ai) ─────────────────────────────────── */

export const BTN_PRIMARY = 'rounded-lg bg-brand-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-700 disabled:opacity-50';
export const BTN_SECONDARY = 'rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50';
export const BTN_DANGER = 'rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50';
export const SECTION_TITLE = 'text-xs font-semibold uppercase tracking-wider text-gray-500';
export const INPUT = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500';

const CHANNELS: { key: OutreachChannel; label: string; tag: string }[] = [
  { key: 'whatsapp', label: 'WhatsApp', tag: 'wa' },
  { key: 'instagram', label: 'Instagram', tag: 'ig' },
  { key: 'email', label: 'Email', tag: 'em' },
  { key: 'other', label: 'Other', tag: 'ot' },
];

/* ─── Messages (channel first) ─────────────────────────────────────────────── */

export function ProspectMessages({ row, api }: { row: GrowthProspect; api: ActivityApi }) {
  const digits = whatsappDigits(row.phone, row.country);
  const [channel, setChannel] = useState<OutreachChannel>('whatsapp');
  const [step, setStep] = useState<OutreachStep>(nextStep(row));
  const [lang, setLang] = useState<OutreachLang>(defaultLang(row));
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);
  const { busy, run } = api;

  useEffect(() => { setStep(nextStep(row)); setEdited(false); }, [row.id, row.touches]);
  // Default to the best channel we have a contact for; re-evaluated when contacts change.
  useEffect(() => {
    setChannel(digits ? 'whatsapp' : row.instagram ? 'instagram' : row.email ? 'email' : 'other');
  }, [row.id, digits, row.instagram, row.email]);
  useEffect(() => {
    if (!edited) setText(row.claim_token ? outreachMessage(row, step, lang, channel) : '');
  }, [row, step, lang, channel, edited]);

  const stepDays = OUTREACH_STEPS.find((s) => s.key === step)?.followUpDays ?? null;
  const tag = CHANNELS.find((c) => c.key === channel)?.tag ?? 'ot';
  const canSend = channel === 'whatsapp' ? !!digits : true;

  const send = () => run(`send-${channel}`, async () => {
    if (channel === 'whatsapp') {
      if (!digits) throw new Error('No usable phone number for WhatsApp — add one with Edit.');
      window.open(whatsappHref(digits, text), '_blank', 'noopener');
    } else {
      try { await navigator.clipboard.writeText(text); } catch { throw new Error('Clipboard blocked — select the text and copy it by hand'); }
      if (channel === 'instagram' && row.instagram) window.open(`https://ig.me/m/${row.instagram}`, '_blank', 'noopener');
      if (channel === 'email' && row.email) window.open(`mailto:${row.email}?body=${encodeURIComponent(text)}`, '_blank', 'noopener');
    }
    const updated = await logActivity(row.id, { type: 'sent', channel, step, lang, text, next_follow_up_at: stepDays ? followUpIn(stepDays) : null });
    setEdited(false);
    return updated;
  });

  const sendLabel = busy === `send-${channel}`
    ? 'Logging…'
    : channel === 'whatsapp' ? 'Send on WhatsApp' : channel === 'instagram' ? (row.instagram ? 'Copy & open Instagram' : 'Copy for Instagram') : channel === 'email' ? (row.email ? 'Copy & open email' : 'Copy for email') : 'Copy & log';

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className={SECTION_TITLE}>Messages</h3>
        <span className="text-xs text-gray-400">{row.touches} sent{row.last_contacted_at ? ` · last ${relativeTime(row.last_contacted_at)}` : ''}</span>
      </div>

      {!row.claim_token ? (
        <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Build the booking page first — every message needs the claim link.</p>
      ) : (
        <>
          {/* 1. Channel — decides where it opens and how the link is tagged */}
          <div className="mt-3 grid grid-cols-4 gap-2">
            {CHANNELS.map((c) => {
              const on = channel === c.key;
              const missing = (c.key === 'whatsapp' && !digits) || (c.key === 'instagram' && !row.instagram) || (c.key === 'email' && !row.email);
              return (
                <button
                  key={c.key}
                  onClick={() => { setChannel(c.key); setEdited(false); }}
                  className={`rounded-lg border px-2 py-2 text-sm font-medium transition-colors ${on ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'} ${missing ? 'opacity-60' : ''}`}
                  title={missing ? `No ${c.label.toLowerCase()} contact on file` : undefined}
                >
                  <span className="flex items-center justify-center gap-1.5"><ChannelIcon channel={c.key} />{c.label}</span>
                </button>
              );
            })}
          </div>

          {/* 2. Which message + language */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm">
              {OUTREACH_STEPS.map((s) => (
                <button key={s.key} onClick={() => { setStep(s.key); setEdited(false); }} className={`px-3 py-1.5 ${step === s.key ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{s.label}</button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm">
              {(['sr', 'en'] as OutreachLang[]).map((l) => (
                <button key={l} onClick={() => { setLang(l); setEdited(false); }} className={`px-3 py-1.5 ${lang === l ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{l === 'sr' ? 'CG' : 'EN'}</button>
              ))}
            </div>
            <span className="ml-auto text-xs text-gray-400">link tagged <code className="rounded bg-gray-100 px-1">?c={tag}</code></span>
          </div>

          {/* 3. Text */}
          <textarea
            value={text}
            onChange={(e) => { setText(e.target.value); setEdited(true); }}
            rows={5}
            className={`mt-3 ${INPUT} leading-relaxed`}
          />

          {/* 4. One action */}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button onClick={send} disabled={!canSend || busy !== ''} className={BTN_PRIMARY}>
              <span className="flex items-center gap-2"><ChannelIcon channel={channel} light />{sendLabel}</span>
            </button>
            {edited && <button onClick={() => setEdited(false)} className="text-sm text-gray-500 hover:underline">Reset text</button>}
            <span className="text-xs text-gray-400">{stepDays ? `Logs it and sets the follow-up ${stepDays} days out.` : 'Logs it; no automatic follow-up.'}</span>
          </div>
        </>
      )}
    </section>
  );
}

/* ─── Follow-up + inbound ──────────────────────────────────────────────────── */

export function ProspectFollowUp({ row, api }: { row: GrowthProspect; api: ActivityApi }) {
  const [followUp, setFollowUp] = useState(row.next_follow_up_at);
  const { busy, run } = api;
  useEffect(() => { setFollowUp(row.next_follow_up_at); }, [row.next_follow_up_at]);

  const setFollowUpDate = (iso: string | null) => run('follow-up', async () => {
    const res = await fetch('/api/admin/growth/prospects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: row.id, next_follow_up_at: iso }),
    });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save follow-up');
    setFollowUp(iso);
    return { ...row, next_follow_up_at: iso };
  });
  const logReply = (via: 'whatsapp' | 'instagram' | 'email' | 'phone') => run('reply', () => logActivity(row.id, { type: 'replied', channel: via, next_follow_up_at: followUpIn(0) }));
  const logCall = () => run('call', () => logActivity(row.id, { type: 'call', channel: 'phone' }));

  const due = dueState(followUp);
  const dateValue = followUp ? new Date(followUp).toISOString().slice(0, 10) : '';

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className={SECTION_TITLE}>Follow-up</h3>
          {due && <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${due.cls}`}>{due.label}</span>}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input type="date" value={dateValue} onChange={(e) => setFollowUpDate(e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null)} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700" />
          <button onClick={() => setFollowUpDate(followUpIn(1))} disabled={busy !== ''} className={BTN_SECONDARY}>Tomorrow</button>
          <button onClick={() => setFollowUpDate(followUpIn(3))} disabled={busy !== ''} className={BTN_SECONDARY}>+3 days</button>
          <button onClick={() => setFollowUpDate(followUpIn(7))} disabled={busy !== ''} className={BTN_SECONDARY}>+1 week</button>
          {followUp && <button onClick={() => setFollowUpDate(null)} className="text-sm text-gray-500 hover:underline">Clear</button>}
        </div>
      </section>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <h3 className={SECTION_TITLE}>They got back to us</h3>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {(['whatsapp', 'instagram', 'email', 'phone'] as const).map((c) => (
            <button key={c} onClick={() => logReply(c)} disabled={busy !== ''} className={BTN_SECONDARY}>
              <span className="flex items-center gap-1.5 capitalize"><ChannelIcon channel={c} />{c}</span>
            </button>
          ))}
          <button onClick={logCall} disabled={busy !== ''} className={BTN_SECONDARY}>Log a call</button>
        </div>
        <p className="mt-2 text-xs text-gray-400">A reply moves the stage to Replied and puts them back in today's queue.</p>
      </section>
    </div>
  );
}

/* ─── Timeline ─────────────────────────────────────────────────────────────── */

export function ProspectTimeline({ row, api }: { row: GrowthProspect; api: ActivityApi }) {
  const [note, setNote] = useState('');
  const [filter, setFilter] = useState<'all' | 'theirs' | 'ours'>('all');
  const { events, busy, run } = api;

  const addNote = () => run('note', async () => {
    const updated = await logActivity(row.id, { type: 'note', text: note });
    setNote('');
    return updated;
  });

  const visible = (events ?? []).filter((e) => filter === 'all' || (filter === 'theirs' ? isProspectAction(e.type) : !isProspectAction(e.type)));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex overflow-hidden rounded-lg border border-gray-300 text-sm">
          {([['all', 'All'], ['theirs', 'Their actions'], ['ours', 'Ours']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1.5 ${filter === k ? 'bg-brand-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{label}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {row.page_views > 0 ? `${row.page_views} view${row.page_views === 1 ? '' : 's'}` : 'no views yet'}
          {row.page_seconds > 0 ? ` · ${formatSeconds(row.page_seconds)} on page` : ''}
          {row.touches > 0 ? ` · ${row.touches} sent` : ''}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) addNote(); }} placeholder="Add a note…" className={INPUT} />
        <button onClick={addNote} disabled={!note.trim() || busy !== ''} className={BTN_PRIMARY}>Add</button>
      </div>
      <ol className="mt-4 space-y-3 text-sm">
        {events === null && <li className="text-gray-400">Loading…</li>}
        {events !== null && visible.length === 0 && <li className="text-gray-400">Nothing here yet.</li>}
        {visible.map((e) => {
          const p = e.payload ?? {};
          const theirs = isProspectAction(e.type);
          const detail = typeof p.text === 'string' ? p.text : e.type === 'claim_page_leave' && typeof p.seconds === 'number' ? formatSeconds(p.seconds) : null;
          const meta = [e.channel, typeof p.step === 'string' ? p.step.replace('_', ' ') : null, typeof p.channel === 'string' ? `via ${p.channel}` : null, typeof p.lang === 'string' ? p.lang.toUpperCase() : null].filter(Boolean).join(' · ');
          return (
            <li key={e.id} className="flex gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${theirs ? (e.type === 'claimed' ? 'bg-emerald-500' : 'bg-brand-500') : 'bg-gray-300'}`} />
              <div className="min-w-0 flex-1 border-b border-gray-100 pb-3">
                <div className="flex items-baseline justify-between gap-2">
                  <span className={`font-medium ${theirs ? 'text-gray-900' : 'text-gray-600'}`}>{activityLabel(e.type)}</span>
                  <span className="shrink-0 text-xs text-gray-400" title={new Date(e.created_at).toLocaleString()}>{relativeTime(e.created_at)}</span>
                </div>
                {meta && <p className="text-xs text-gray-400">{meta}</p>}
                {detail && <p className={`mt-1 whitespace-pre-line text-xs text-gray-600 ${e.type === 'sent' ? 'line-clamp-3' : ''}`}>{detail}</p>}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/* ─── Icons ────────────────────────────────────────────────────────────────── */

export function ChannelIcon({ channel, light = false, className = 'h-4 w-4' }: { channel: OutreachChannel | 'phone'; light?: boolean; className?: string }) {
  const color = light ? 'text-white' : channel === 'whatsapp' ? 'text-[#25D366]' : channel === 'instagram' ? 'text-pink-600' : 'text-gray-500';
  switch (channel) {
    case 'whatsapp':
      return <svg viewBox="0 0 24 24" className={`${className} ${color} fill-current`} aria-hidden><path d="M17.5 14.4c-.3-.1-1.8-.9-2-1-.3-.1-.5-.1-.7.1-.2.3-.8 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.5.1-.6l.5-.6.3-.5c.1-.2 0-.4 0-.5l-.9-2.2c-.2-.6-.5-.5-.7-.5h-.6c-.2 0-.5.1-.8.4-.3.3-1 1-1 2.5s1.1 2.9 1.2 3.1c.1.2 2.1 3.2 5.1 4.5.7.3 1.3.5 1.7.6.7.2 1.4.2 1.9.1.6-.1 1.8-.7 2-1.4.2-.7.2-1.3.2-1.4-.1-.2-.3-.3-.6-.4zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2c-1.5 0-3-.4-4.3-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2z" /></svg>;
    case 'instagram':
      return <svg viewBox="0 0 24 24" className={`${className} ${color}`} fill="none" stroke="currentColor" strokeWidth={2} aria-hidden><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" /></svg>;
    case 'email':
      return <svg viewBox="0 0 24 24" className={`${className} ${color}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" /></svg>;
    case 'phone':
      return <svg viewBox="0 0 24 24" className={`${className} ${color}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" /></svg>;
    default:
      return <svg viewBox="0 0 24 24" className={`${className} ${color}`} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" /></svg>;
  }
}
