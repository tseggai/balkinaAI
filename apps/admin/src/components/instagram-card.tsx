'use client';

import { useState } from 'react';
import { Modal } from '@/components/modal';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY, INPUT } from '@/components/prospect-crm';

export interface IgConnection {
  credentials: boolean;
  source: 'db' | 'env' | null;
  username: string | null;
  expiresAt: string | null;
  login: 'instagram' | 'facebook';
}

function daysLeft(iso: string | null): number | null {
  if (!iso) return null;
  return Math.round((Date.parse(iso) - Date.now()) / 86_400_000);
}

/** Compact Instagram connection card: status, test, refresh, replace or disconnect the token. */
export function InstagramCard({ conn, onChanged, notify }: { conn: IgConnection; onChanged: () => Promise<void>; notify: (title: string, lines: string[]) => void }) {
  const [busy, setBusy] = useState('');
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const left = daysLeft(conn.expiresAt);
  const tone = !conn.credentials ? 'bg-gray-300' : left !== null && left <= 7 ? 'bg-amber-500' : 'bg-emerald-500';

  const call = async (label: string, init: RequestInit) => {
    setBusy(label);
    const res = await fetch('/api/admin/ig/token', init);
    const data = (await res.json().catch(() => ({}))) as { error?: string; account?: { username?: string }; expires_at?: string };
    setBusy('');
    if (!res.ok) { notify(`${label} failed`, [data.error ?? 'Unknown error']); return false; }
    return data;
  };

  const test = async () => {
    setBusy('test');
    const res = await fetch('/api/admin/ig/check', { method: 'POST' });
    const data = (await res.json()) as { ok: boolean; account?: { username?: string; id?: string }; error?: string };
    setBusy('');
    notify(data.ok ? 'Instagram token works' : 'Instagram token failed', [data.ok ? `Posting as @${data.account?.username ?? data.account?.id}.` : data.error ?? 'Unknown error']);
  };
  const refresh = async () => {
    const r = await call('Refresh', { method: 'PUT' });
    if (r) { notify('Token refreshed', ['Valid for another 60 days.']); await onChanged(); }
  };
  const save = async () => {
    const r = await call('Connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ access_token: token }) });
    if (r) { setOpen(false); setToken(''); notify('Instagram connected', [`Posting as @${(r as { account?: { username?: string } }).account?.username ?? '…'}. The publisher refreshes the token automatically before it expires.`]); await onChanged(); }
  };
  const disconnect = async () => {
    const r = await call('Disconnect', { method: 'DELETE' });
    if (r) await onChanged();
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-2">
          <span className="text-sm font-semibold text-gray-900">Instagram</span>
          <span className="text-xs text-gray-500">
            {conn.credentials
              ? `${conn.username ? `@${conn.username}` : 'connected'}${conn.source === 'env' ? ' · token from Vercel' : left !== null ? ` · token expires in ${left} d` : ''}`
              : 'not connected'}
          </span>
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
        {conn.credentials && <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={test}>{busy === 'test' ? '…' : 'Test'}</button>}
        {conn.source === 'db' && <button type="button" className={BTN_SECONDARY} disabled={Boolean(busy)} onClick={refresh}>{busy === 'Refresh' ? '…' : 'Refresh'}</button>}
        <button type="button" className={conn.credentials ? BTN_SECONDARY : BTN_PRIMARY} disabled={Boolean(busy)} onClick={() => setOpen(true)}>{conn.credentials ? 'Replace' : 'Connect'}</button>
        {conn.source === 'db' && <button type="button" className={BTN_DANGER} disabled={Boolean(busy)} onClick={disconnect}>Disconnect</button>}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={conn.credentials ? 'Replace the Instagram token' : 'Connect Instagram'}
        busy={busy === 'Connect'}
        footer={
          <>
            <button type="button" className={BTN_SECONDARY} onClick={() => setOpen(false)}>Cancel</button>
            <button type="button" className={BTN_PRIMARY} disabled={token.trim().length < 20 || busy === 'Connect'} onClick={save}>{busy === 'Connect' ? 'Checking…' : 'Connect'}</button>
          </>
        }
      >
        <p>Meta app dashboard → Instagram → API setup with Instagram login → Generate token (60 days). Paste it here; it is checked against the account, stored server-side and refreshed automatically before it expires.</p>
        <textarea className={`${INPUT} mt-3 font-mono text-xs`} rows={4} value={token} onChange={(e) => setToken(e.target.value)} placeholder="IGAAR…" autoComplete="off" spellCheck={false} />
      </Modal>
    </div>
  );
}
