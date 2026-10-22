'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT } from '@/components/prospect-crm';

type Kind = 'feed' | 'story';

export interface RowEdit {
  key: string;
  label: string;
  scheduledAt: string | null; // ISO UTC
  source: 'plan' | 'override';
  enabled: boolean;
  kinds: Kind[];
}

export interface RowEditResult {
  scheduled_at: string | null;
  enabled: boolean;
  kinds: Kind[];
}

/** ISO UTC → value for <input type="datetime-local"> in the browser's zone. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const KIND_OPTIONS: { value: Kind[]; label: string }[] = [
  { value: ['feed', 'story'], label: 'Feed + story' },
  { value: ['feed'], label: 'Feed only' },
  { value: ['story'], label: 'Story only' },
];

/** Per-row schedule editor: custom date/time, skip, and which kinds to post. */
export function IgRowModal({ row, busy, onClose, onSave, onClear }: {
  row: RowEdit | null;
  busy: boolean;
  onClose: () => void;
  onSave: (key: string, next: RowEditResult) => Promise<void>;
  onClear: (key: string) => Promise<void>;
}) {
  const [when, setWhen] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [kinds, setKinds] = useState<Kind[]>(['feed', 'story']);

  useEffect(() => {
    if (!row) return;
    setWhen(toLocalInput(row.scheduledAt));
    setEnabled(row.enabled);
    setKinds(row.kinds);
  }, [row]);

  if (!row) return null;
  const kindsKey = kinds.join('+');

  return (
    <Modal
      open
      onClose={onClose}
      title={`Schedule · ${row.label}`}
      busy={busy}
      footer={
        <>
          {row.source === 'override' || !row.enabled || row.kinds.length !== 2 ? (
            <button type="button" className={`${BTN_SECONDARY} mr-auto`} disabled={busy} onClick={() => void onClear(row.key)}>Back to plan</button>
          ) : null}
          <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy}>Cancel</button>
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={busy || (enabled && !when)}
            onClick={() => void onSave(row.key, { scheduled_at: when ? new Date(when).toISOString() : null, enabled, kinds })}
          >
            {busy ? 'Saving…' : 'Save'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">Post at (your local time)</label>
          <input type="datetime-local" className={INPUT} value={when} onChange={(e) => setWhen(e.target.value)} />
          <p className="mt-1 text-xs text-gray-400">{row.source === 'override' ? 'This row has a custom time.' : 'Currently follows the plan cadence.'}</p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-500">What to post</label>
          <div className="flex gap-1">
            {KIND_OPTIONS.map((o) => (
              <button
                key={o.label}
                type="button"
                onClick={() => setKinds(o.value)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${o.value.join('+') === kindsKey ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={!enabled} onChange={(e) => setEnabled(!e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-brand-600" />
          Skip this post (keep it in the plan, never publish automatically)
        </label>
      </div>
    </Modal>
  );
}
