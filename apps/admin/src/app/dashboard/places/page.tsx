'use client';

import { useCallback, useEffect, useState } from 'react';
import { ConfirmDialog, type ConfirmRequest } from '@/components/confirm-dialog';
import { PlaceCard } from '@/components/place-card';
import { EMPTY_PLACE, PlaceFormModal, type PlaceFormValues } from '@/components/place-form-modal';
import { BTN_PRIMARY, BTN_SECONDARY, SECTION_TITLE } from '@/components/prospect-crm';
import type { PlacesReport, PlaceView } from '@/lib/places';

type Form = { id: string | null; title: string; initial: PlaceFormValues };

async function api(path: string, method: string, body?: unknown): Promise<{ ok: boolean; status: number; data: Record<string, unknown> }> {
  const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  return { ok: res.ok, status: res.status, data };
}

const valuesOf = (p: PlaceView): PlaceFormValues => ({
  name: p.name, refers_to: p.refers_to ?? '', tagline: p.tagline ?? '', photo_url: p.photo_url ?? '',
  lat: p.lat, lng: p.lng, radius_km: Number(p.radius_km),
  need_total: p.need_total, need_dining: p.need_dining, need_care: p.need_care, need_active: p.need_active,
});

/**
 * Places (docs/PLACES.md): destinations grouped by geography from independently signed-up businesses.
 * A person draws a place and publishes it; membership, density, hiding and the candidate list are automatic.
 */
export default function PlacesPage() {
  const [report, setReport] = useState<PlacesReport | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const r = await api('/api/admin/places', 'GET');
    if (!r.ok) { setLoadError(String(r.data.error ?? 'Could not load places')); return; }
    setLoadError('');
    setReport(r.data as unknown as PlacesReport);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const act = async (place: PlaceView, body: Record<string, unknown>, done: string) => {
    setBusy(true);
    const r = await api(`/api/admin/places/${place.id}`, 'PATCH', body);
    setBusy(false);
    setConfirm(null);
    if (!r.ok) { setNotice(String(r.data.error ?? 'That did not work')); return; }
    setNotice(done);
    await load();
  };

  const publish = (place: PlaceView) => {
    const ready = place.fresh.level1;
    setConfirm({
      title: `Publish ${place.name}?`,
      body: ready
        ? `"Book anything in ${place.name}" will appear on the home screen for people nearby, with its own web page. Confirm the name has passed the legal check first.`
        : `${place.name} has not reached Level 1: ${place.fresh.total} of ${place.need_total} businesses. Publishing now promises more than the place holds. Publish anyway?`,
      confirmLabel: ready ? 'Publish' : 'Publish anyway',
      danger: !ready,
      onConfirm: () => act(place, { action: 'publish', force: !ready }, `${place.name} is live.`),
    });
  };

  const save = async (values: PlaceFormValues) => {
    if (!form) return;
    setBusy(true);
    setFormError('');
    const r = form.id
      ? await api(`/api/admin/places/${form.id}`, 'PATCH', { action: 'update', ...values, refers_to: values.refers_to || null, tagline: values.tagline || null })
      : await api('/api/admin/places', 'POST', values);
    setBusy(false);
    if (!r.ok) { setFormError(String(r.data.error ?? 'Could not save the place')); return; }
    setForm(null);
    await load();
  };

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Places</h1>
          <p className="text-sm text-gray-500">Destinations grouped from the businesses that signed up on their own. A place shows to customers once you publish it.</p>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={() => { setFormError(''); setForm({ id: null, title: 'New place', initial: EMPTY_PLACE }); }}>New place</button>
      </div>

      {notice ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-700">
          <span>{notice}</span>
          <button type="button" className="text-xs text-gray-400 hover:text-gray-600" onClick={() => setNotice('')}>Dismiss</button>
        </div>
      ) : null}
      {loadError ? <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p> : null}
      {report?.missingTable ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          The places table does not exist yet. Apply Migration 080 (packages/db/migrations/080_places.sql) and reload this page.
        </p>
      ) : null}

      {!report && !loadError ? <p className="text-sm text-gray-400">Measuring places…</p> : null}

      {report && !report.missingTable ? (
        <>
          {report.places.length === 0 ? <p className="text-sm text-gray-400">No places yet. Draw the first one with &quot;New place&quot;.</p> : null}
          {report.places.map((p) => (
            <PlaceCard
              key={p.id}
              place={p}
              busy={busy}
              onEdit={() => { setFormError(''); setForm({ id: p.id, title: `Edit ${p.name}`, initial: valuesOf(p) }); }}
              onPublish={() => publish(p)}
              onUnpublish={() => setConfirm({ title: `Unpublish ${p.name}?`, body: 'The row and the web page disappear for customers. The place keeps being measured.', confirmLabel: 'Unpublish', onConfirm: () => act(p, { action: 'unpublish' }, `${p.name} is no longer shown.`) })}
              onOfficial={() => setConfirm({ title: `Mark ${p.name} official?`, body: 'Use this when the property owner has signed. The place stays visible even if it thins out.', confirmLabel: 'Mark official', onConfirm: () => act(p, { action: 'official' }, `${p.name} is now official.`) })}
              onWatch={() => void act(p, { action: 'watch' }, `${p.name} is being watched.`)}
              onDelete={() => setConfirm({
                title: `Delete ${p.name}?`,
                body: 'The place and its thresholds are removed. No business is affected.',
                confirmLabel: 'Delete',
                danger: true,
                onConfirm: async () => {
                  setBusy(true);
                  const r = await api(`/api/admin/places/${p.id}`, 'DELETE');
                  setBusy(false);
                  setConfirm(null);
                  if (!r.ok) { setNotice(String(r.data.error ?? 'Could not delete the place')); return; }
                  await load();
                },
              })}
            />
          ))}

          <section className="rounded-xl border border-gray-200 bg-white p-4">
            <h2 className={SECTION_TITLE}>Where a new place could be</h2>
            <p className="mt-1 text-xs text-gray-500">Clusters of at least eight claimed businesses within 500 m that belong to no place. A suggestion only: you name and draw the place.</p>
            {report.candidates.length === 0 ? (
              <p className="mt-3 text-sm text-gray-400">No clusters yet.</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {report.candidates.map((c) => (
                  <li key={`${c.lat},${c.lng}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-gray-50 px-3 py-2 text-sm">
                    <span className="min-w-0 text-gray-700">
                      <span className="font-semibold">{c.count} businesses</span> near{' '}
                      <a className="text-brand-600 hover:underline" target="_blank" rel="noreferrer" href={`https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}`}>{c.lat.toFixed(4)}, {c.lng.toFixed(4)}</a>
                      <span className="block truncate text-xs text-gray-500">{c.names.join(', ')}</span>
                    </span>
                    <button
                      type="button"
                      className={BTN_SECONDARY}
                      onClick={() => { setFormError(''); setForm({ id: null, title: 'New place', initial: { ...EMPTY_PLACE, lat: Number(c.lat.toFixed(4)), lng: Number(c.lng.toFixed(4)), radius_km: 0.5 } }); }}
                    >
                      Draw a place here
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}

      <PlaceFormModal open={Boolean(form)} title={form?.title ?? ''} initial={form?.initial ?? EMPTY_PLACE} busy={busy} error={formError} onClose={() => setForm(null)} onSave={(v) => void save(v)} />
      <ConfirmDialog request={confirm} busy={busy} onClose={() => setConfirm(null)} />
    </div>
  );
}
