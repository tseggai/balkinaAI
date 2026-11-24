'use client';

import { useEffect, useState } from 'react';
import { PlaceDensityBar } from '@/components/place-density-bar';
import { PlaceMap } from '@/components/place-map';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, SECTION_TITLE } from '@/components/prospect-crm';
import { PLACE_STATUS, isPublished, placeGaps } from '@/lib/place-list';
import type { PlaceMember, PlaceView } from '@/lib/places';
import { useChromeTint } from '@/lib/use-chrome-tint';

const FAMILIES: { key: PlaceMember['family']; label: string }[] = [
  { key: 'dining', label: 'Dining' },
  { key: 'care', label: 'Care' },
  { key: 'active', label: 'Active' },
  { key: 'other', label: 'Other' },
];

const CARD = 'rounded-xl border border-gray-200 bg-white p-4';
const day = (iso: string | null): string => (iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

/** Right-side detail of one place: boundary on a map, density against its thresholds, members and actions. */
export function PlaceDrawer({ place, busy, hasPrev, hasNext, onPrev, onNext, onClose, onEdit, onPublish, onUnpublish, onOfficial, onWatch, onDelete }: {
  place: PlaceView;
  busy: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onUnpublish: () => void;
  onOfficial: () => void;
  onWatch: () => void;
  onDelete: () => void;
}) {
  const [shown, setShown] = useState(false);
  useChromeTint(true);
  useEffect(() => { const t = setTimeout(() => setShown(true), 10); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]:not([data-place-drawer])')) return; // a dialog is on top
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'ArrowRight' && hasNext) onNext();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, onPrev, onNext, hasPrev, hasNext]);

  const s = place.fresh;
  const status = PLACE_STATUS[place.status] ?? PLACE_STATUS.watching!;
  const published = isPublished(place);
  const gaps = placeGaps(place);
  const needBookings = 5 * s.total;
  const needBooked = Math.ceil(s.total / 2);
  const nav = 'rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30';

  return (
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" data-place-drawer>
      <div className={`absolute inset-0 bg-gray-900/30 transition-opacity duration-200 ${shown ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside className={`absolute inset-y-0 right-0 flex w-full max-w-[560px] flex-col bg-gray-50 shadow-2xl transition-transform duration-200 ease-out ${shown ? 'translate-x-0' : 'translate-x-full'}`}>
        <header className="shrink-0 border-b border-gray-200 bg-white px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] md:px-6 md:pt-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-lg font-bold text-gray-900 md:text-xl">{place.name}</h2>
              {place.refers_to ? <p className="mt-0.5 truncate text-sm text-gray-500">{place.refers_to}</p> : null}
              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${status.className}`}>{status.label}</span>
                {published && place.hidden ? <span className="rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700" title="Below 70% of its thresholds. It returns on its own at 100%.">Hidden: thinned out</span> : null}
                {s.level2 ? <span className="rounded-full bg-green-600 px-2.5 py-0.5 text-xs font-semibold text-white">Level 2</span>
                  : s.level1 ? <span className="rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700">Level 1 reached</span> : null}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button type="button" onClick={onPrev} disabled={!hasPrev} aria-label="Previous place" className={nav}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
              </button>
              <button type="button" onClick={onNext} disabled={!hasNext} aria-label="Next place" className={nav}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
              </button>
              <button type="button" onClick={onClose} aria-label="Close" className={`ml-1 ${nav}`}>
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 md:p-6">
          <section className={CARD}>
            <h3 className={SECTION_TITLE}>Density</h3>
            <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-3">
              <PlaceDensityBar label="Businesses" have={s.total} need={place.need_total} />
              <PlaceDensityBar label="Dining" have={s.dining} need={place.need_dining} />
              <PlaceDensityBar label="Care" have={s.care} need={place.need_care} />
              <PlaceDensityBar label="Active" have={s.active} need={place.need_active} />
            </div>
            <p className="mt-3 text-xs text-gray-600">
              {s.level2 ? <span className="font-semibold text-green-700">Level 2: take the numbers to the owner.</span>
                : s.level1 ? <span className="font-semibold text-green-700">{published ? 'Level 1 held.' : 'Level 1 reached: ready to publish.'}</span>
                : <>Still needed for Level 1: <span className="font-medium text-gray-900">{gaps.join(', ')}</span>.</>}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              {s.bookings_30d} {s.bookings_30d === 1 ? 'booking' : 'bookings'} in 30 days from {s.businesses_with_booking_30d} of {s.total} {s.total === 1 ? 'business' : 'businesses'}.
              {s.level1 && !s.level2 ? ` Level 2 needs ${needBookings} bookings with at least ${needBooked} businesses booked.` : ''}
            </p>
          </section>

          <section className={CARD}>
            <h3 className={SECTION_TITLE}>Boundary</h3>
            <PlaceMap lat={place.lat} lng={place.lng} radiusKm={Number(place.radius_km)} className="mt-3 h-48" />
            <p className="mt-2 text-xs text-gray-500">
              {Number(place.radius_km)} km around{' '}
              <a className="text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`}>
                {place.lat.toFixed(4)}, {place.lng.toFixed(4)}
              </a>
            </p>
          </section>

          <section className={CARD}>
            <h3 className={SECTION_TITLE}>Businesses ({place.members.length})</h3>
            {place.members.length === 0 ? <p className="mt-2 text-sm text-gray-400">No claimed business inside the boundary yet.</p> : null}
            {FAMILIES.map((f) => {
              const list = place.members.filter((m) => m.family === f.key);
              if (list.length === 0) return null;
              return (
                <div key={f.key} className="mt-3">
                  <p className="text-xs font-medium text-gray-500">{f.label} · {list.length}</p>
                  <ul className="mt-1 divide-y divide-gray-100">
                    {list.map((m) => (
                      <li key={m.id} className="flex items-baseline justify-between gap-3 py-1.5 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate text-gray-900">{m.name}</span>
                          {m.category ? <span className="block truncate text-xs text-gray-400">{m.category}</span> : null}
                        </span>
                        <span className="flex-shrink-0 text-xs tabular-nums text-gray-500">{m.bookings_30d} {m.bookings_30d === 1 ? 'booking' : 'bookings'}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </section>

          <section className={CARD}>
            <h3 className={SECTION_TITLE}>What customers see</h3>
            {place.photo_url ? <img src={place.photo_url} alt="" className="mt-3 h-32 w-full rounded-lg object-cover" /> : <p className="mt-2 text-sm text-gray-400">No photo yet. Add one with Edit.</p>}
            <p className="mt-2 text-sm text-gray-700">{place.tagline ?? 'Book anything here.'}</p>
            <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><dt className="text-gray-400">Added</dt><dd className="text-gray-700">{day(place.created_at)}</dd></div>
              <div><dt className="text-gray-400">Level 1 first reached</dt><dd className="text-gray-700">{day(place.level1_at) || 'Not yet'}</dd></div>
              <div><dt className="text-gray-400">Published</dt><dd className="text-gray-700">{day(place.published_at) || 'Not yet'}</dd></div>
              <div>
                <dt className="text-gray-400">Web page</dt>
                <dd>
                  {place.visible
                    ? <a className="text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://balkina.ai/places/${place.slug}`}>balkina.ai/places/{place.slug}</a>
                    : <span className="text-gray-700">Not shown</span>}
                </dd>
              </div>
            </dl>
          </section>
        </div>

        <footer className="flex shrink-0 flex-wrap items-center gap-2 border-t border-gray-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:px-6">
          <button type="button" className={BTN_SECONDARY} onClick={onEdit} disabled={busy}>Edit</button>
          {place.status === 'draft' ? <button type="button" className={BTN_SECONDARY} onClick={onWatch} disabled={busy}>Start watching</button> : null}
          {published ? <button type="button" className={BTN_SECONDARY} onClick={onUnpublish} disabled={busy}>Unpublish</button> : null}
          {place.status === 'live' ? <button type="button" className={BTN_SECONDARY} onClick={onOfficial} disabled={busy} title="The owner signed: this is now their official place">Mark official</button> : null}
          {!published ? <button type="button" className={BTN_DANGER} onClick={onDelete} disabled={busy}>Delete</button> : null}
          {!published ? <button type="button" className={`${BTN_PRIMARY} ml-auto`} onClick={onPublish} disabled={busy}>Publish</button> : null}
        </footer>
      </aside>
    </div>
  );
}
