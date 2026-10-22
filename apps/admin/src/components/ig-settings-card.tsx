'use client';

import { useEffect, useState } from 'react';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, SECTION_TITLE, SELECT } from '@/components/prospect-crm';

export interface IgSettingsValue {
  start_date: string | null;
  post_time: string;
  days: number[];
  timezone: string;
  paused: boolean;
}

const WEEKDAYS = [
  [1, 'Mon'], [2, 'Tue'], [3, 'Wed'], [4, 'Thu'], [5, 'Fri'], [6, 'Sat'], [7, 'Sun'],
] as const;

const TIMEZONES = ['Europe/Podgorica', 'Europe/Belgrade', 'Europe/Sarajevo', 'Europe/Zagreb', 'Europe/Berlin', 'Europe/London', 'UTC', 'America/New_York', 'America/Los_Angeles'];

/** Cadence, time, timezone and pause for the whole plan. Rows without an override follow these. */
export function IgSettingsCard({ value, onSave }: { value: IgSettingsValue; onSave: (next: IgSettingsValue) => Promise<void> }) {
  const [draft, setDraft] = useState<IgSettingsValue>(value);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(value), [value]);

  const dirty = JSON.stringify(draft) !== JSON.stringify(value);
  const toggleDay = (d: number) => setDraft((s) => ({ ...s, days: s.days.includes(d) ? s.days.filter((x) => x !== d) : [...s.days, d].sort((a, b) => a - b) }));

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <span className={SECTION_TITLE}>Schedule</span>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={draft.paused} onChange={(e) => setDraft({ ...draft, paused: e.target.checked })} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
          Pause all posting
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">First posting day</label>
          <input type="date" className={INPUT} value={draft.start_date ?? ''} onChange={(e) => setDraft({ ...draft, start_date: e.target.value || null })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Time</label>
          <input type="time" className={INPUT} value={draft.post_time} onChange={(e) => setDraft({ ...draft, post_time: e.target.value })} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Timezone</label>
          <select className={`${SELECT} w-full`} value={draft.timezone} onChange={(e) => setDraft({ ...draft, timezone: e.target.value })}>
            {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
        <div className="col-span-2 lg:col-span-1">
          <label className="mb-1 block text-xs font-medium text-gray-500">Days</label>
          <div className="flex flex-wrap gap-1">
            {WEEKDAYS.map(([d, label]) => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDay(d)}
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${draft.days.includes(d) ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-500">
          Posts fill the chosen days in plan order from the first day, {draft.days.length || 0} a week at {draft.post_time}. Rows with a custom time keep it.
        </p>
        <div className="flex shrink-0 gap-2">
          {dirty && <button type="button" className={BTN_SECONDARY} onClick={() => setDraft(value)} disabled={saving}>Discard</button>}
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={!dirty || saving || draft.days.length === 0}
            onClick={async () => {
              setSaving(true);
              await onSave(draft);
              setSaving(false);
            }}
          >
            {saving ? 'Saving…' : 'Save schedule'}
          </button>
        </div>
      </div>
    </div>
  );
}
