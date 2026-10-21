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
 * CRM panel for one prospect: outreach composer (WhatsApp / Instagram / copy),
 * follow-up date, and the activity timeline fed by both the claim page and
 * manual logs. Every send is logged as a `sent` event, which the DB trigger
 * turns into stage + counters, so the list stays in sync via `onRowChange`.
 */

interface ActivityEvent {
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

const BTN = 'rounded-lg px-3 py-1.5 text-xs font-medium shadow-sm disabled:opacity-50';

export function ProspectCrm({ row, onRowChange, onError }: { row: GrowthProspect; onRowChange: (row: GrowthProspect) => void; onError: (msg: string) => void }) {
  const [events, setEvents] = useState<ActivityEvent[] | null>(null);
  const [step, setStep] = useState<OutreachStep>(nextStep(row));
  const [lang, setLang] = useState<OutreachLang>(defaultLang(row));
  const [channel, setChannel] = useState<OutreachChannel>(whatsappDigits(row.phone, row.country) ? 'whatsapp' : row.instagram ? 'instagram' : 'other');
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState('');
  const [followUp, setFollowUp] = useState(row.next_follow_up_at);

  const loadEvents = useCallback(async () => {
    const res = await fetch(`/api/admin/growth/prospects/${row.id}/activity`);
    if (res.ok) setEvents(((await res.json()).data ?? []) as ActivityEvent[]);
  }, [row.id]);

  useEffect(() => { loadEvents(); }, [loadEvents]);
  useEffect(() => { setFollowUp(row.next_follow_up_at); }, [row.next_follow_up_at]);
  useEffect(() => {
    if (!edited) setText(row.claim_token ? outreachMessage(row, step, lang, channel) : '');
  }, [row, step, lang, channel, edited]);

  const digits = whatsappDigits(row.phone, row.country);
  const link = claimLinkFor(row, null);
  const stepDays = OUTREACH_STEPS.find((s) => s.key === step)?.followUpDays ?? null;

  const run = async (key: string, fn: () => Promise<GrowthProspect | void>) => {
    setBusy(key);
    try {
      const updated = await fn();
      if (updated) onRowChange(updated);
      await loadEvents();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Request failed');
    }
    setBusy('');
  };

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
    setStep(nextStep(updated));
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

  const addNote = () => run('note', async () => {
    const updated = await logActivity(row.id, { type: 'note', text: note });
    setNote('');
    return updated;
  });

  const logReply = (via: 'whatsapp' | 'instagram' | 'email' | 'phone') => run('reply', () => logActivity(row.id, { type: 'replied', channel: via, next_follow_up_at: followUpIn(0) }));
  const logCall = () => run('call', () => logActivity(row.id, { type: 'call', channel: 'phone' }));

  const due = dueState(followUp);
  const dateValue = followUp ? new Date(followUp).toISOString().slice(0, 10) : '';

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      {/* Composer */}
      <div className="lg:col-span-3">
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-900">Message</span>
          <select value={step} onChange={(e) => { setStep(e.target.value as OutreachStep); setEdited(false); }} className="rounded-md border border-gray-300 px-2 py-1">
            {OUTREACH_STEPS.map((s) => <option key={s.key} value={s.key}>{s.label}</option>)}
          </select>
          <div className="flex overflow-hidden rounded-md border border-gray-300">
            {(['sr', 'en'] as OutreachLang[]).map((l) => (
              <button key={l} onClick={() => { setLang(l); setEdited(false); }} className={`px-2 py-1 uppercase ${lang === l ? 'bg-gray-900 text-white' : 'bg-white text-gray-600'}`}>{l === 'sr' ? 'CG' : 'EN'}</button>
            ))}
          </div>
          <select value={channel} onChange={(e) => { setChannel(e.target.value as OutreachChannel); setEdited(false); }} className="rounded-md border border-gray-300 px-2 py-1">
            <option value="whatsapp">link tagged: WhatsApp</option>
            <option value="instagram">link tagged: Instagram</option>
            <option value="email">link tagged: Email</option>
            <option value="other">link tagged: Other</option>
          </select>
          <span className="text-gray-400">{row.touches} sent{row.last_contacted_at ? ` · last ${relativeTime(row.last_contacted_at)}` : ''}</span>
        </div>
        {!link ? (
          <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">Build the booking page first — the message needs a claim link.</p>
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => { setText(e.target.value); setEdited(true); }}
              rows={7}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button onClick={() => send('whatsapp')} disabled={!digits || busy !== ''} title={digits ? `wa.me/${digits}` : 'No usable phone'} className={`${BTN} bg-[#25D366] text-white`}>
                {busy === 'send-whatsapp' ? 'Opening…' : 'Open WhatsApp & log'}
              </button>
              <button onClick={() => send('instagram')} disabled={busy !== ''} className={`${BTN} bg-pink-600 text-white`}>
                {busy === 'send-instagram' ? 'Copying…' : row.instagram ? 'Copy & open Instagram DM' : 'Copy for Instagram'}
              </button>
              <button onClick={() => send('other')} disabled={busy !== ''} className={`${BTN} bg-white text-gray-700`}>Copy & log</button>
              {edited && <button onClick={() => setEdited(false)} className="text-xs text-gray-500 hover:underline">reset text</button>}
              <span className="text-[11px] text-gray-400">{stepDays ? `Logs “sent” and sets follow-up in ${stepDays} days.` : 'Logs “sent”; no automatic follow-up.'}</span>
            </div>
          </>
        )}

        {/* Follow-up */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-900">Follow-up</span>
          {due && <span className={`rounded-full px-2 py-0.5 font-medium ${due.cls}`}>{due.label}</span>}
          <input type="date" value={dateValue} onChange={(e) => setFollowUpDate(e.target.value ? new Date(`${e.target.value}T09:00:00`).toISOString() : null)} className="rounded-md border border-gray-300 px-2 py-1" />
          <button onClick={() => setFollowUpDate(followUpIn(1))} className={`${BTN} bg-white text-gray-700`}>Tomorrow</button>
          <button onClick={() => setFollowUpDate(followUpIn(3))} className={`${BTN} bg-white text-gray-700`}>+3 days</button>
          <button onClick={() => setFollowUpDate(followUpIn(7))} className={`${BTN} bg-white text-gray-700`}>+1 week</button>
          {followUp && <button onClick={() => setFollowUpDate(null)} className="text-gray-500 hover:underline">clear</button>}
        </div>

        {/* Log inbound */}
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-semibold text-gray-900">They replied via</span>
          {(['whatsapp', 'instagram', 'email', 'phone'] as const).map((c) => (
            <button key={c} onClick={() => logReply(c)} disabled={busy !== ''} className={`${BTN} bg-white capitalize text-gray-700`}>{c}</button>
          ))}
          <button onClick={logCall} disabled={busy !== ''} className={`${BTN} bg-white text-gray-700`}>Log a call</button>
        </div>
      </div>

      {/* Timeline */}
      <div className="lg:col-span-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-gray-900">Activity</span>
          <span className="text-gray-400">
            {row.page_views > 0 ? `${row.page_views} view${row.page_views === 1 ? '' : 's'}` : 'no views yet'}
            {row.page_seconds > 0 ? ` · ${formatSeconds(row.page_seconds)} on page` : ''}
          </span>
        </div>
        <div className="mt-2 flex gap-2">
          <input value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && note.trim()) addNote(); }} placeholder="Add a note…" className="min-w-0 flex-1 rounded-lg border border-gray-300 px-2 py-1.5 text-xs text-gray-900" />
          <button onClick={addNote} disabled={!note.trim() || busy !== ''} className={`${BTN} bg-gray-900 text-white`}>Add</button>
        </div>
        <ol className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1 text-xs">
          {events === null && <li className="text-gray-400">Loading…</li>}
          {events?.length === 0 && <li className="text-gray-400">Nothing yet. Send the first message above.</li>}
          {events?.map((e) => {
            const p = e.payload ?? {};
            const mine = !isProspectAction(e.type);
            const detail = typeof p.text === 'string' ? p.text : e.type === 'claim_page_leave' && typeof p.seconds === 'number' ? formatSeconds(p.seconds) : null;
            const meta = [e.channel, typeof p.step === 'string' ? p.step.replace('_', ' ') : null, typeof p.channel === 'string' ? `via ${p.channel}` : null, typeof p.lang === 'string' ? p.lang.toUpperCase() : null].filter(Boolean).join(' · ');
            return (
              <li key={e.id} className="flex gap-2">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${mine ? 'bg-gray-300' : e.type === 'claimed' ? 'bg-emerald-500' : 'bg-brand-500'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className={`font-medium ${mine ? 'text-gray-600' : 'text-gray-900'}`}>{activityLabel(e.type)}{meta ? <span className="font-normal text-gray-400"> · {meta}</span> : null}</span>
                    <span className="shrink-0 text-gray-400" title={new Date(e.created_at).toLocaleString()}>{relativeTime(e.created_at)}</span>
                  </div>
                  {detail && <p className={`mt-0.5 whitespace-pre-line text-gray-600 ${e.type === 'sent' ? 'line-clamp-2' : ''}`}>{detail}</p>}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
