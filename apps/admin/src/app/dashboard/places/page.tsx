'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ConfirmDialog, type ConfirmRequest } from '@/components/confirm-dialog';
import { PlaceDrawer } from '@/components/place-drawer';
import { EMPTY_PLACE, PlaceFormModal, type PlaceFormValues } from '@/components/place-form-modal';
import { PlaceListHeader } from '@/components/place-list-header';
import { PlaceRow } from '@/components/place-row';
import { PlaceSummary } from '@/components/place-summary';
import { PlaceToolbar } from '@/components/place-toolbar';
import { BTN_PRIMARY, BTN_SECONDARY, SECTION_TITLE } from '@/components/prospect-crm';
import { DEFAULT_PLACE_QUERY, PLACE_PAGE_SIZE, queryPlaces, statusCounts, type PlaceQuery } from '@/lib/place-list';
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
 * The list is searched, filtered, sorted and paged in the browser; a row opens the place's detail.
 */
export default function PlacesPage() {
  const [report, setReport] = useState<PlacesReport | null>(null);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState<Form | null>(null);
  const [formError, setFormError] = useState('');
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState<PlaceQuery>(DEFAULT_PLACE_QUERY);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await api('/api/admin/places', 'GET');
    if (!r.ok) { setLoadError(String(r.data.error ?? 'Could not load places')); return; }
    setLoadError('');
    setReport(r.data as unknown as PlacesReport);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const all = useMemo(() => report?.places ?? [], [report]);
  const rows = useMemo(() => queryPlaces(all, query), [all, query]);
  const counts = useMemo(() => statusCounts(all), [all]);
  const pages = Math.max(1, Math.ceil(rows.length / PLACE_PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = rows.slice((current - 1) * PLACE_PAGE_SIZE, current * PLACE_PAGE_SIZE);
  const open = openId ? all.find((p) => p.id === openId) ?? null : null;
  const openIndex = open ? rows.findIndex((p) => p.id === open.id) : -1;

  const change = (patch: Partial<PlaceQuery>) => { setQuery((q) => ({ ...q, ...patch })); setPage(1); };
  const step = (by: number) => {
    const next = rows[openIndex + by];
    if (!next) return;
    setOpenId(next.id);
    setPage(Math.floor((openIndex + by) / PLACE_PAGE_SIZE) + 1);
  };
  const openForm = (next: Form) => { setFormError(''); setForm(next); };

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

  const remove = (place: PlaceView) => setConfirm({
    title: `Delete ${place.name}?`,
    body: 'The place and its thresholds are removed. No business is affected.',
    confirmLabel: 'Delete',
    danger: true,
    onConfirm: async () => {
      setBusy(true);
      const r = await api(`/api/admin/places/${place.id}`, 'DELETE');
      setBusy(false);
      setConfirm(null);
      if (!r.ok) { setNotice(String(r.data.error ?? 'Could not delete the place')); return; }
      setOpenId(null);
      setNotice(`${place.name} was deleted.`);
      await load();
    },
  });

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
    if (!form.id && typeof r.data.id === 'string') setOpenId(r.data.id);
    await load();
  };

  return (
    <div className="space-y-5 p-4 md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Places</h1>
          <p className="mt-1 text-sm text-gray-500">Destinations grouped from the businesses that signed up on their own. A place shows to customers once you publish it.</p>
        </div>
        <button type="button" className={BTN_PRIMARY} onClick={() => openForm({ id: null, title: 'New place', initial: EMPTY_PLACE })}>New place</button>
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
          {all.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-white px-5 py-12 text-center">
              <h2 className="text-base font-semibold text-gray-900">No places yet</h2>
              <p className="mx-auto mt-1 max-w-md text-sm text-gray-500">Search for an area, set its radius and the number of businesses that make it worth showing.</p>
              <button type="button" className={`${BTN_PRIMARY} mt-5`} onClick={() => openForm({ id: null, title: 'New place', initial: EMPTY_PLACE })}>New place</button>
            </div>
          ) : (
            <>
              <PlaceSummary places={all} onFilter={change} />
              <PlaceToolbar query={query} counts={counts} shown={rows.length} total={all.length} onChange={change} onReset={() => { setQuery((q) => ({ ...DEFAULT_PLACE_QUERY, sort: q.sort, dir: q.dir })); setPage(1); }} />

              <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                <PlaceListHeader query={query} onChange={change} />
                {visible.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-gray-500">No places match these filters.</p>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {visible.map((p) => <PlaceRow key={p.id} place={p} selected={p.id === openId} onOpen={() => setOpenId(p.id)} />)}
                  </div>
                )}
              </div>

              {pages > 1 ? (
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{(current - 1) * PLACE_PAGE_SIZE + 1} to {Math.min(current * PLACE_PAGE_SIZE, rows.length)} of {rows.length}</span>
                  <div className="flex items-center gap-2">
                    <button type="button" className={BTN_SECONDARY} disabled={current <= 1} onClick={() => setPage(current - 1)}>Previous</button>
                    <span className="text-xs">Page {current} of {pages}</span>
                    <button type="button" className={BTN_SECONDARY} disabled={current >= pages} onClick={() => setPage(current + 1)}>Next</button>
                  </div>
                </div>
              ) : null}
            </>
          )}

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
                      onClick={() => openForm({ id: null, title: 'New place', initial: { ...EMPTY_PLACE, lat: Number(c.lat.toFixed(4)), lng: Number(c.lng.toFixed(4)), radius_km: 0.5 } })}
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

      {open ? (
        <PlaceDrawer
          place={open}
          busy={busy}
          hasPrev={openIndex > 0}
          hasNext={openIndex >= 0 && openIndex < rows.length - 1}
          onPrev={() => step(-1)}
          onNext={() => step(1)}
          onClose={() => setOpenId(null)}
          onEdit={() => openForm({ id: open.id, title: `Edit ${open.name}`, initial: valuesOf(open) })}
          onPublish={() => publish(open)}
          onUnpublish={() => setConfirm({ title: `Unpublish ${open.name}?`, body: 'The row and the web page disappear for customers. The place keeps being measured.', confirmLabel: 'Unpublish', onConfirm: () => act(open, { action: 'unpublish' }, `${open.name} is no longer shown.`) })}
          onOfficial={() => setConfirm({ title: `Mark ${open.name} official?`, body: 'Use this when the property owner has signed. The place stays visible even if it thins out.', confirmLabel: 'Mark official', onConfirm: () => act(open, { action: 'official' }, `${open.name} is now official.`) })}
          onWatch={() => void act(open, { action: 'watch' }, `${open.name} is being watched.`)}
          onDelete={() => remove(open)}
        />
      ) : null}

      <PlaceFormModal open={Boolean(form)} title={form?.title ?? ''} initial={form?.initial ?? EMPTY_PLACE} busy={busy} error={formError} onClose={() => setForm(null)} onSave={(v) => void save(v)} />
      <ConfirmDialog request={confirm} busy={busy} onClose={() => setConfirm(null)} />
    </div>
  );
}
