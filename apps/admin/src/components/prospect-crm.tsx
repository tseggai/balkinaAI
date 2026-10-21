'use client';

import { useCallback, useEffect, useState } from 'react';
import type { GrowthProspect } from '@balkina/shared';
import {
  OUTREACH_STEPS,
  activityLabel,
  claimLinkFor,
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
 * - ProspectComposer: outreach message, follow-up date, inbound logging
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

export const BTN = 'rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm transition-colors disabled:opacity-50';
export const BTN_WHITE = `${BTN} border border-gray-200 bg-white text-gray-700 hover:bg-gray-50`;
const SECTION = 'text-[11px] font-semibold uppercase tracking-wider text-gray-500';

/* ─── Composer ─────────────────────────────────────────────────────────────── */

export function ProspectComposer({ row, api }: { row: GrowthProspect; api: ActivityApi }) {
  const [step, setStep] = useState<OutreachStep>(nextStep(row));
  const [lang, setLang] = useState<OutreachLang>(defaultLang(row));
  const [channel, setChannel] = useState<OutreachChannel>(whatsappDigits(row.phone, row.country) ? 'whatsapp' : row.instagram ? 'instagram' : 'other');
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);
  const [followUp, setFollowUp] = useState(row.next_follow_up_at);

  useEffect(() => { setFollowUp(row.next_follow_up_at); }, [row.next_follow_up_at]);
  useEffect(() => { setStep(nextStep(row)); setEdited(false); }, [row.id, row.touches]);
  useEffect(() => {
    if (!edited) setText(row.claim_token ? outreachMessage(row, step, lang, channel) : '');
  }, [row, step, lang, channel, edited]);

  const digits = whatsappDigits(row.phone, row.country);
  const link = claimLinkFor(row, null);
  const stepDays = OUTREACH_STEPS.find((s) => s.key === step)?.followUpDays ?? null;
  const { busy, run } = api;

  const send = (via: OutreachChannel) => run(`send-${via}`, async () => {
    if (via === 'whatsapp') {
      if (!digits) throw new Error('No usable phone number for WhatsApp');
      window.open(whatsappHref(digits, text), '_blank', 'noopener');
    } else {
      try { await navigator.clipboard.writeText(text); } catch { throw new Error('Clipboard blocked — select the text and copy it by hand'); }
      if (via === 'instagram' && row.instagram) window.open(`https://ig.me/m/${row.instagram}`, '_blank', 'noopener');
    }
    const updated = await logActivity(row.id, { type: 'sent', channel: via, step, lang, text, next_follow_up_at: stepDays ? followUpIn(stepDays) : null });
    setEdited(false);
    return updated;
  });

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
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className={SECTION}>Message</p>
          <span className="text-xs text-gray-400">{row.touches} sent{row.last_contacted_at ? ` · last ${relativeTime(row.last_contacted_at)}` : ''}</span>
        </div>
        {!link ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">Build the booking page first — the message needs a claim link.</p>
        ) : (
          <>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
              <div className="flex overflow-hidden rounded-lg border border-gray-200">
                {OUTREACH_STEPS.map((s) => (
                  <button key={s.key} onClick={() => { setStep(s.key); setEdited(false); }} className={`px-2.5 py-1.5 ${step === s.key ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{s.label}</button>
                ))}
              </div>
              <div className="flex overflow-hidden rounded-lg border border-gray-200">
                {(['sr', 'en'] as OutreachLang[]).map((l) => (
                  <button key={l} onClick={() => { setLang(l); setEdited(false); }} className={`px-2.5 py-1.5 uppercase ${lang === l ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{l === 'sr' ? 'CG' : 'EN'}</button>
                ))}
              </div>
              <select value={channel} onChange={(e) => { setChannel(e.target.value as OutreachChannel); setEdited(false); }} className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-700">
                <option value="whatsapp">Link tag: WhatsApp</option>
                <option value="instagram">Link tag: Instagram</option>
                <option value="email">Link tag: Email</option>
                <option value="other">Link tag: Other</option>
              </select>
            </div>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setEdited(true); }}
              rows={5}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm leading-relaxed text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={() => send('whatsapp')} disabled={!digits || busy !== ''} title={digits ? `wa.me/${digits}` : 'No usable phone'} className={`${BTN} bg-[#25D366] text-white hover:brightness-95`}>
                {busy === 'send-whatsapp' ? 'Opening…' : 'Open WhatsApp & log'}
              </button>
              <button onClick={() => send('instagram')} disabled={busy !== ''} className={`${BTN} bg-pink-600 text-white hover:bg-pink-700`}>
                {busy === 'send-instagram' ? 'Copying…' : row.instagram ? 'Copy & open Instagram' : 'Copy for Instagram'}
              </button>
              <button onClick={() => send('other')} disabled={busy !== ''} className={BTN_WHITE}>Copy & log</button>
              {edited && <button onClick={() => setEdited(false)} className="text-xs text-gray-500 hover:underline">reset text</button>}
            </div>
            <p className="mt-1.5 text-[11px] text-gray-400">{stepDays ? `Logs “sent” and sets the follow-up ${stepDays} days out.` : 'Logs “sent”; no automatic follow-up.'}</p>
          </>
        )}
      </section>

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <p className={SECTION}>Follow-up</p>
          {due && <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${due.cls}`}>{due.label}</span>}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <input type="date" value={dateValue} onChange={(e) => setFollowUpDate(e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null)} className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700" />
          <button onClick={() => setFollowUpDate(followUpIn(1))} className={BTN_WHITE}>Tomorrow</button>
          <button onClick={() => setFollowUpDate(followUpIn(3))} className={BTN_WHITE}>+3 days</button>
          <button onClick={() => setFollowUpDate(followUpIn(7))} className={BTN_WHITE}>+1 week</button>
          {followUp && <button onClick={() => setFollowUpDate(null)} className="text-xs text-gray-500 hover:underline">clear</button>}
        </div>
      </section>

      <section>
        <p className={SECTION}>They got back to us</p>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
          <span className="text-gray-500">Replied via</span>
          {(['whatsapp', 'instagram', 'email', 'phone'] as const).map((c) => (
            <button key={c} onClick={() => logReply(c)} disabled={busy !== ''} className={`${BTN_WHITE} capitalize`}>{c}</button>
          ))}
          <span className="mx-1 text-gray-300">|</span>
          <button onClick={logCall} disabled={busy !== ''} className={BTN_WHITE}>Log a call</button>
        </div>
        <p className="mt-1.5 text-[11px] text-gray-400">A reply moves the stage to Replied and puts the prospect back in today's queue.</p>
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
        <div className="flex overflow-hidden rounded-lg border border-gray-200 text-xs">
          {([['all', 'All'], ['theirs', 'Their actions'], ['ours', 'Ours']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-2.5 py-1.5 ${filter === k ? 'bg-gray-900 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}>{label}</button>
          ))}
        </div>
        <span className="text-xs text-gray-400">
          {row.page_views > 0 ? `${row.page_views} view${row.page_views === 1 ? '' : 's'}` : 'no views yet'}
          {row.page_seconds > 0 ? ` · ${formatSeconds(row.page_seconds)} on page` : ''}
          {row.touches > 0 ? ` · ${row.touches} sent` : ''}
        </span>
      </div>
      <div className="mt-3 flex gap-2">
        <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) addNote(); }} placeholder="Add a note…" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500" />
        <button onClick={addNote} disabled={!note.trim() || busy !== ''} className={`${BTN} bg-brand-600 text-white hover:bg-brand-700`}>Add</button>
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
