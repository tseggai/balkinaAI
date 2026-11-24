'use client';

import { useState } from 'react';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/components/prospect-crm';
import type { PlaceView } from '@/lib/places';

const STATUS: Record<string, { label: string; className: string }> = {
  draft: { label: 'Draft', className: 'bg-gray-100 text-gray-600' },
  watching: { label: 'Watching', className: 'bg-amber-50 text-amber-700' },
  live: { label: 'Live', className: 'bg-green-50 text-green-700' },
  official: { label: 'Official', className: 'bg-brand-50 text-brand-700' },
};

const FAMILY_LABEL: Record<string, string> = { dining: 'Dining', care: 'Care', active: 'Active', other: 'Other' };

const day = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function Bar({ label, have, need }: { label: string; have: number; need: number }) {
  const met = need === 0 || have >= need;
  const pct = need === 0 ? 100 : Math.min(100, Math.round((have / need) * 100));
  return (
    <div>
      <div className="flex items-baseline justify-between text-xs">
        <span className="font-medium text-gray-700">{label}</span>
        <span className={met ? 'font-semibold text-green-700' : 'text-gray-500'}>{have} / {need}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100">
        <div className={`h-full rounded-full ${met ? 'bg-green-500' : 'bg-brand-500'}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

/** One place on the admin Places page: boundary, density against its thresholds, members and actions. */
export function PlaceCard({ place, busy, onEdit, onPublish, onUnpublish, onOfficial, onWatch, onDelete }: {
  place: PlaceView;
  busy: boolean;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onOfficial: () => void;
  onWatch: () => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const s = place.fresh;
  const status = STATUS[place.status] ?? STATUS.watching!;
  const published = place.status === 'live' || place.status === 'official';

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-gray-900">{place.name}</h2>
          <p className="text-xs text-gray-500">
            {place.refers_to ? `${place.refers_to} · ` : ''}{Number(place.radius_km)} km around{' '}
            <a className="text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}>
              {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
          {published && place.hidden ? <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700" title="Below 70% of its thresholds. It returns on its own at 100%.">Hidden: thinned out</span> : null}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-3 sm:grid-cols-4">
        <Bar label="Businesses" have={s.total} need={place.need_total} />
        <Bar label="Dining" have={s.dining} need={place.need_dining} />
        <Bar label="Care" have={s.care} need={place.need_care} />
        <Bar label="Active" have={s.active} need={place.need_active} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>{s.bookings_30d} bookings in 30 days from {s.businesses_with_booking_30d} of {s.total} businesses</span>
        {s.level2 ? <span className="font-semibold text-green-700">Level 2: take the numbers to the owner</span>
          : s.level1 ? <span className="font-semibold text-green-700">{published ? 'Level 1 held' : 'Level 1 reached: ready to publish'}</span>
          : <span>Level 1 not reached</span>}
        {place.level1_at ? <span>first reached {day(place.level1_at)}</span> : null}
        {place.published_at ? <span>published {day(place.published_at)}</span> : null}
      </div>

      {place.members.length > 0 ? (
        <div className="mt-3">
          <button type="button" className="text-xs font-medium text-brand-600 hover:underline" onClick={() => setOpen((v) => !v)}>
            {open ? 'Hide businesses' : `Show the ${place.members.length} businesses`}
          </button>
          {open ? (
            <ul className="mt-2 grid gap-1 text-xs text-gray-700 sm:grid-cols-2">
              {place.members.map((m) => (
                <li key={m.id} className="flex items-baseline justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5">
                  <span className="truncate">{m.name}</span>
                  <span className="flex-shrink-0 text-gray-400">{FAMILY_LABEL[m.family]}{m.bookings_30d ? ` · ${m.bookings_30d}` : ''}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
        <button type="button" className={BTN_SECONDARY} onClick={onEdit} disabled={busy}>Edit</button>
        {place.status === 'draft' ? <button type="button" className={BTN_SECONDARY} onClick={onWatch} disabled={busy}>Start watching</button> : null}
        {!published ? <button type="button" className={BTN_PRIMARY} onClick={onPublish} disabled={busy}>Publish</button> : null}
        {published ? <button type="button" className={BTN_SECONDARY} onClick={onUnpublish} disabled={busy}>Unpublish</button> : null}
        {place.status === 'live' ? <button type="button" className={BTN_SECONDARY} onClick={onOfficial} disabled={busy} title="The owner signed: this is now their official place">Mark official</button> : null}
        {!published ? <button type="button" className={BTN_DANGER} onClick={onDelete} disabled={busy}>Delete</button> : null}
        {place.visible ? <a className="ml-auto text-xs font-medium text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://balkina.ai/places/${place.slug}`}>Open web page</a> : null}
      </div>
    </section>
  );
}
