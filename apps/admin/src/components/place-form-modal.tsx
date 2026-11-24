'use client';

import { useEffect, useState } from 'react';
import { Modal } from '@/components/modal';
import { PlaceMap } from '@/components/place-map';
import { PlacePhotoField } from '@/components/place-photo-field';
import { PlaceSearch } from '@/components/place-search';
import { BTN_PRIMARY, BTN_SECONDARY, INPUT, SELECT } from '@/components/prospect-crm';
import type { GeoResult } from '@/lib/geo-search';
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
const HINT = 'mt-1 text-xs text-gray-500';
type Size = keyof typeof PLACE_SIZE_DEFAULTS;
type Threshold = 'need_total' | 'need_dining' | 'need_care' | 'need_active';

const THRESHOLDS: { key: Threshold; label: string }[] = [
  { key: 'need_total', label: 'Businesses' },
  { key: 'need_dining', label: 'Dining' },
  { key: 'need_care', label: 'Care' },
  { key: 'need_active', label: 'Active' },
];

const hasCentre = (v: PlaceFormValues): boolean => Number.isFinite(v.lat) && Number.isFinite(v.lng) && (v.lat !== 0 || v.lng !== 0);

/** Create or edit a place: its name and photo, where it is and how many businesses make it worth showing. */
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
  const [uploading, setUploading] = useState(false);
  useEffect(() => { if (open) { setV(initial); setUploading(false); } }, [open, initial]);

  const set = <K extends keyof PlaceFormValues>(key: K, value: PlaceFormValues[K]) => setV((prev) => ({ ...prev, [key]: value }));
  const located = hasCentre(v);
  const valid = v.name.trim().length >= 2 && located && v.radius_km > 0 && v.need_total > 0;

  const pickLocation = (r: GeoResult) => {
    const label = r.address && !r.address.toLowerCase().startsWith(r.name.toLowerCase()) ? `${r.name}, ${r.address}` : r.address ?? r.name;
    setV((prev) => ({
      ...prev,
      lat: Number(r.lat.toFixed(5)),
      lng: Number(r.lng.toFixed(5)),
      // Google's size is only a first guess, so it never replaces a radius someone already set.
      radius_km: hasCentre(prev) || r.radius_km === null ? prev.radius_km : r.radius_km,
      refers_to: prev.refers_to.trim() ? prev.refers_to : label.slice(0, 120),
    }));
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      busy={busy || uploading}
      width="max-w-xl"
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy || uploading}>Cancel</button>
          <button type="button" className={BTN_PRIMARY} onClick={() => onSave(v)} disabled={busy || uploading || !valid}>{busy ? 'Saving…' : 'Save'}</button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className={LABEL}>Name shown to customers</label>
          <input className={INPUT} value={v.name} onChange={(e) => set('name', e.target.value)} placeholder="Porto" />
          <p className={HINT}>Plain text only. This is the one place the name is set, so a rename is a single edit.</p>
        </div>
        <div>
          <label className={LABEL}>Tagline (optional)</label>
          <input className={INPUT} value={v.tagline} onChange={(e) => set('tagline', e.target.value)} placeholder="Book anything on the waterfront." />
        </div>
        <div>
          <label className={LABEL}>Photo (optional)</label>
          <PlacePhotoField value={v.photo_url} onChange={(url) => set('photo_url', url)} onBusy={setUploading} />
          <p className={HINT}>Your own or licensed photo of the area. Never the owner&apos;s logo or brand artwork.</p>
        </div>

        <div>
          <label className={LABEL}>Where it is</label>
          <PlaceSearch onPick={pickLocation} placeholder={located ? 'Search again to move the centre' : 'Search a name or an address'} />
          {located ? (
            <div className="mt-2 space-y-2">
              <PlaceMap lat={v.lat} lng={v.lng} radiusKm={v.radius_km} onPick={(lat, lng) => setV((prev) => ({ ...prev, lat, lng }))} />
              <div className="flex items-center gap-3">
                <span className="w-12 flex-shrink-0 text-xs font-medium text-gray-600">Radius</span>
                <input
                  type="range" min={0.2} max={5} step={0.1}
                  value={Math.min(5, Math.max(0.2, v.radius_km))}
                  onChange={(e) => set('radius_km', Number(e.target.value))}
                  className="min-w-0 flex-1 accent-brand-600"
                  aria-label="Radius in kilometres"
                />
                <div className="flex w-24 flex-shrink-0 items-center gap-1.5">
                  <input
                    type="number" min={0.1} max={25} step={0.1}
                    className={`${INPUT} px-2 py-1.5 text-right`}
                    value={Number.isFinite(v.radius_km) ? v.radius_km : ''}
                    onChange={(e) => set('radius_km', Number(e.target.value))}
                    aria-label="Radius"
                  />
                  <span className="text-xs text-gray-500">km</span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Click the map to move the centre. Every claimed business inside the circle belongs to the place.{' '}
                <a className="text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${v.lat},${v.lng}`}>
                  {v.lat.toFixed(4)}, {v.lng.toFixed(4)}
                </a>
              </p>
            </div>
          ) : (
            <p className={HINT}>Search for the area, the main street or a landmark. You can then move the centre on the map and set the radius.</p>
          )}
        </div>

        <div>
          <label className={LABEL}>What it refers to (internal)</label>
          <input className={INPUT} value={v.refers_to} onChange={(e) => set('refers_to', e.target.value)} placeholder="Porto Montenegro, Tivat" />
        </div>

        <div>
          <label className={LABEL}>Level 1 thresholds</label>
          <select className={`${SELECT} mb-2 w-full`} value="" onChange={(e) => { const size = e.target.value as Size | ''; if (size) setV((prev) => ({ ...prev, ...PLACE_SIZE_DEFAULTS[size] })); }}>
            <option value="">Fill from a size…</option>
            <option value="small">Small place (8 businesses)</option>
            <option value="medium">Medium place (10 businesses)</option>
            <option value="large">Large place (15 businesses)</option>
          </select>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {THRESHOLDS.map((t) => (
              <div key={t.key}>
                <label className={LABEL}>{t.label}</label>
                <input type="number" min={0} step={1} className={INPUT} value={Number.isFinite(v[t.key]) ? v[t.key] : ''} onChange={(e) => set(t.key, Number(e.target.value))} />
              </div>
            ))}
          </div>
          <p className={HINT}>The row can be published once all four minimums are met. Membership follows the boundary automatically.</p>
        </div>
        {error ? <p className="text-sm text-red-600">{error}</p> : null}
      </div>
    </Modal>
  );
}
