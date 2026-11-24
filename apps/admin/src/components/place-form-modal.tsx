'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, SELECT } from '@/components/prospect-crm';
import { PLACE_SIZE_DEFAULTS } from '@balkina/shared';

export interface PlaceFormValues {
  name: string;
  refers_to: string;
  tagline: string;
  photo_url: string;
  lat: number;
  lng: number;
  radius_km: number;
  need_total: number;
  need_dining: number;
  need_care: number;
  need_active: number;
}

export const EMPTY_PLACE: PlaceFormValues = { name: '', refers_to: '', tagline: '', photo_url: '', lat: 0, lng: 0, radius_km: 1, ...PLACE_SIZE_DEFAULTS.medium };

const LABEL = 'mb-1 block text-xs font-medium text-gray-600';
type Size = keyof typeof PLACE_SIZE_DEFAULTS;

/** Create or edit a place: its name, where it is and how many businesses make it worth showing. */
export function PlaceFormModal({ open, title, initial, busy, error, onClose, onSave }: {
  open: boolean;
  title: string;
  initial: PlaceFormValues;
  busy: boolean;
  error: string;
  onClose: () => void;
  onSave: (values: PlaceFormValues) => void;
}) {
  const [v, setV] = useState<PlaceFormValues>(initial);
  useEffect(() => { if (open) setV(initial); }, [open, initial]);

  const set = <K extends keyof PlaceFormValues>(key: K, value: PlaceFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));
  const num = (key: keyof PlaceFormValues, step = 1) => (
    <input type="number" step={step} className={INPUT} value={Number.isFinite(v[key] as number) ? (v[key] as number) : ''} onChange={(e) => set(key, Number(e.target.value) as never)} />
  );
  const valid = v.name.trim().length >= 2 && Number.isFinite(v.lat) && Number.isFinite(v.lng) && (v.lat !== 0 || v.lng !== 0) && v.radius_km > 0 && v.need_total > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      busy={busy}
      width="max-w-lg"
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={BTN_PRIMARY} onClick={() => onSave(v)} disabled={busy || !valid}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className={LABEL}>Name shown to customers</label>
          <input className={INPUT} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Porto" />
          <p className="mt-1 text-xs text-gray-500">Plain text only. This is the one place the name is set, so a rename is a single edit.</p>
        </div>
        <div>
          <label className={LABEL}>What it refers to (internal)</label>
          <input className={INPUT} value={v.refers_to} onChange={(e) => set('refers_to', e.target.value)} placeholder="Porto Montenegro, Tivat" />
        </div>
        <div>
          <label className={LABEL}>Tagline (optional)</label>
          <input className={INPUT} value={v.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Book anything on the waterfront." />
        </div>
        <div>
          <label className={LABEL}>Photo URL (optional)</label>
          <input className={INPUT} value={v.photo_url} onChange={(e) => set('photo_url', e.target.value)} placeholder="https://…" />
          <p className="mt-1 text-xs text-gray-500">Your own or licensed photo of the area. Never the owner&apos;s logo or brand artwork.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div><label className={LABEL}>Latitude</label>{num('lat', 0.0001)}</div>
          <div><label className={LABEL}>Longitude</label>{num('lng', 0.0001)}</div>
          <div><label className={LABEL}>Radius (km)</label>{num('radius_km', 0.1)}</div>
        </div>
        <div>
          <label className={LABEL}>Level 1 thresholds</label>
          <select className={`${SELECT} mb-2 w-full`} value="" onChange={(e) => { const size = e.target.value as Size; if (size) setV((prev) => ({ ...prev, ...PLACE_SIZE_DEFAULTS[size] })); }}>
            <option value="">Fill from a size…</option>
            <option value="small">Small place (8 businesses)</option>
            <option value="medium">Medium place (10 businesses)</option>
            <option value="large">Large place (15 businesses)</option>
          </select>
          <div className="grid grid-cols-4 gap-3">
            <div><label className={LABEL}>Businesses</label>{num('need_total')}</div>
            <div><label className={LABEL}>Dining</label>{num('need_dining')}</div>
            <div><label className={LABEL}>Care</label>{num('need_care')}</div>
            <div><label className={LABEL}>Active</label>{num('need_active')}</div>
          </div>
          <p className="mt-1 text-xs text-gray-500">The row can be published once all four minimums are met. Membership follows the boundary automatically.</p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
