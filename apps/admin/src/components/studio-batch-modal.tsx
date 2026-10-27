'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, SELECT } from '@/components/prospect-crm';

type Lang = 'sr' | 'en';
type Kind = 'feed' | 'story';

export interface BatchRequest {
  count: number;
  verticals: string[];
  tones: string[];
  layouts?: string[];   // omitted = each post uses its audience's category template
  lang: Lang;
  langs: Lang[];
  kinds: Kind[];
  brief?: string;
  cadence: { start_date: string; post_time: string; days: number[]; timezone: string; per_day: number; gap_minutes: number };
}

const WEEKDAYS = [[1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun']] as const;
const TIMEZONES = ['Europe/Podgorica', 'Europe/Belgrade', 'Europe/Sarajevo', 'Europe/Zagreb', 'Europe/Berlin', 'Europe/London', 'UTC', 'America/New_York', 'America/Los_Angeles'];
const LABEL = 'mb-1 block text-xs font-medium text-gray-500';

function Chips<T extends string | number>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void }) {
  const toggle = (v: T) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <div className="flex flex-wrap gap-1">
      {options.map((o) => (
        <button key={String(o.value)} type="button" onClick={() => toggle(o.value)} className={`rounded-full px-2.5 py-1 text-xs font-semibold ${value.includes(o.value) ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>{o.label}</button>
      ))}
    </div>
  );
}

/** "Generate batch": how many posts, what to rotate through, and the cadence they land on. */
export function StudioBatchModal({ open, onClose, onStart, verticals, categories, tones, layouts, cadence }: {
  open: boolean;
  onClose: () => void;
  onStart: (req: BatchRequest) => void;
  verticals: { value: string; label: string; category: string }[];
  categories: { key: string; label: string; synced: boolean }[];
  tones: { value: string; label: string }[];
  layouts: { layout: string; st: boolean }[];
  cadence: { post_time: string; days: number[]; timezone: string };
}) {
  const [count, setCount] = useState(10);
  const [vs, setVs] = useState<string[]>(['salon', 'barber', 'nails', 'spa']);
  const [ts, setTs] = useState<string[]>(['friendly', 'bold']);
  const [ls, setLs] = useState<string[]>([]);   // empty = by category
  const [lang, setLang] = useState<Lang>('sr');
  const [bilingual, setBilingual] = useState(true);
  const [kinds, setKinds] = useState<Kind[]>(['feed', 'story']);
  const [brief, setBrief] = useState('');
  const [start, setStart] = useState(() => new Date(Date.now() + 86_400_000).toISOString().slice(0, 10));
  const [time, setTime] = useState(cadence.post_time);
  const [days, setDays] = useState<number[]>(cadence.days);
  const [tz, setTz] = useState(cadence.timezone);
  const [perDay, setPerDay] = useState(1);
  const [gap, setGap] = useState(180);

  const valid = count > 0 && vs.length > 0 && ts.length > 0 && days.length > 0 && kinds.length > 0 && start && time;
  const minutes = count * (bilingual ? 2 : 1) * (kinds.includes('story') ? 2 : 1) * 0.5 + count * 0.15;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Generate a batch"
      width="max-w-2xl"
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose}>Cancel</button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={!valid}
            onClick={() => onStart({ count, verticals: vs, tones: ts, layouts: ls.length ? ls : undefined, lang, langs: bilingual ? ['sr', 'en'] : [lang], kinds, brief: brief || undefined, cadence: { start_date: start, post_time: time, days, timezone: tz, per_day: perDay, gap_minutes: gap } })}
          >
            Generate {count} post{count === 1 ? '' : 's'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={LABEL}>How many posts</label>
            <input type="number" min={1} max={40} className={INPUT} value={count} onChange={(e) => setCount(Math.max(1, Math.min(40, Number(e.target.value) || 1)))} />
          </div>
          <div>
            <label className={LABEL}>Languages</label>
            <div className="flex gap-1">
              <button type="button" onClick={() => setBilingual(true)} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${bilingual ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>SR + EN carousel</button>
              <button type="button" onClick={() => { setBilingual(false); setLang('sr'); }} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${!bilingual && lang === 'sr' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>SR only</button>
              <button type="button" onClick={() => { setBilingual(false); setLang('en'); }} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${!bilingual && lang === 'en' ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'}`}>EN only</button>
            </div>
          </div>
        </div>
        <div>
          <label className={LABEL}>Audiences (rotated in this order; each uses its category's template)</label>
          <div className="space-y-2">
            {categories.map((c) => (
              <div key={c.key} className="flex flex-wrap items-center gap-1">
                <button
                  type="button"
                  title={c.synced ? 'Toggle every audience in this category' : 'No template synced for this category yet'}
                  onClick={() => { const members = verticals.filter((v) => v.category === c.key).map((v) => v.value); const all = members.every((m) => vs.includes(m)); setVs(all ? vs.filter((v) => !members.includes(v)) : [...vs, ...members.filter((m) => !vs.includes(m))]); }}
                  className={`mr-1 w-32 shrink-0 truncate text-left text-[11px] font-semibold uppercase tracking-wider ${c.synced ? 'text-gray-500 hover:text-gray-800' : 'text-gray-300'}`}
                >
                  {c.label}
                </button>
                <Chips options={verticals.filter((v) => v.category === c.key)} value={vs} onChange={setVs} />
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className={LABEL}>Tones</label>
            <Chips options={tones} value={ts} onChange={setTs} />
          </div>
          <div>
            <label className={LABEL}>Templates <span className="font-normal text-gray-400">(none picked = by category)</span></label>
            <Chips options={layouts.map((l) => ({ value: l.layout, label: `${l.layout}${l.st ? '' : ' (sq only)'}` }))} value={ls} onChange={setLs} />
          </div>
        </div>
        <div>
          <label className={LABEL}>What to post</label>
          <div className="flex gap-1">
            {([['feed', 'story'], ['feed'], ['story']] as Kind[][]).map((k) => (
              <button key={k.join('+')} type="button" onClick={() => setKinds(k)} className={`rounded-full px-3 py-1 text-xs font-semibold ${k.join('+') === kinds.join('+') ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {k.length === 2 ? 'Feed + story' : k[0] === 'feed' ? 'Feed only' : 'Story only'}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className={LABEL}>Brief for every post (optional)</label>
          <input className={INPUT} value={brief} onChange={(e) => setBrief(e.target.value)} placeholder="e.g. autumn promo: first month free, keep it short" />
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-500">Cadence</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={LABEL}>First day</label>
              <input type="date" className={INPUT} value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Time</label>
              <input type="time" className={INPUT} value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div>
              <label className={LABEL}>Timezone</label>
              <select className={`${SELECT} w-full`} value={tz} onChange={(e) => setTz(e.target.value)}>{TIMEZONES.map((z) => <option key={z} value={z}>{z}</option>)}</select>
            </div>
            <div>
              <label className={LABEL}>Posts per day · gap</label>
              <div className="flex gap-2">
                <select className={`${SELECT} w-full`} value={perDay} onChange={(e) => setPerDay(Number(e.target.value))}>{[1, 2, 3, 4].map((n) => <option key={n} value={n}>{n}</option>)}</select>
                <select className={`${SELECT} w-full`} value={gap} disabled={perDay === 1} onChange={(e) => setGap(Number(e.target.value))}>{[60, 120, 180, 240, 360].map((n) => <option key={n} value={n}>{n / 60} h</option>)}</select>
              </div>
            </div>
            <div className="col-span-2">
              <label className={LABEL}>Days</label>
              <Chips options={WEEKDAYS.map(([v, l]) => ({ value: v, label: l }))} value={days} onChange={(v) => setDays([...v].sort((a, b) => a - b))} />
            </div>
          </div>
        </div>
        <p className="text-xs text-gray-500">
          Each post gets copy from the copywriter, a photo from the library matched to its audience, and a slot on this cadence (slots already taken by scheduled posts are skipped). Rendering runs in this tab, about {Math.ceil(minutes)} min for {count} posts; you can stop and resume. Everything stays editable afterwards.
        </p>
      </div>
    </Modal>
  );
}
