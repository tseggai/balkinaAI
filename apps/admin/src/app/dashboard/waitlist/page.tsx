'use client';

import { useState, useEffect, useCallback } from 'react';

interface WaitlistEntry {
  id: string;
  business_name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  category: string | null;
  location: string | null;
  staff_count: number;
  services_description: string | null;
  status: 'pending' | 'contacted' | 'onboarded' | 'declined';
  notes: string | null;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800',
  contacted: 'bg-blue-100 text-blue-800',
  onboarded: 'bg-green-100 text-green-800',
  declined: 'bg-gray-100 text-gray-600',
};

export default function WaitlistPage() {
  const [entries, setEntries] = useState<WaitlistEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [settingUp, setSettingUp] = useState<string | null>(null);
  const [inviting, setInviting] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [message, setMessage] = useState('');

  const fetchEntries = useCallback(async () => {
    const res = await fetch(`/api/admin/waitlist?status=${filter}`);
    const json = await res.json();
    setEntries(json.data ?? []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  const updateStatus = async (id: string, status: string) => {
    await fetch('/api/admin/waitlist', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    fetchEntries();
  };

  const setupTenant = async (id: string) => {
    setSettingUp(id);
    setMessage('');
    try {
      const res = await fetch('/api/admin/waitlist/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ waitlist_id: id }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(`Tenant created: ${data.message}`);
        fetchEntries();
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage('Network error during setup.');
    }
    setSettingUp(null);
  };

  const sendInvite = async (email: string, id: string) => {
    setInviting(id);
    setMessage('');
    try {
      const res = await fetch('/api/admin/waitlist/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setMessage(`Error: ${data.error}`);
      }
    } catch {
      setMessage('Network error sending invite.');
    }
    setInviting(null);
  };

  const counts = {
    all: entries.length,
    pending: entries.filter((e) => e.status === 'pending').length,
    contacted: entries.filter((e) => e.status === 'contacted').length,
    onboarded: entries.filter((e) => e.status === 'onboarded').length,
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Beta Waitlist</h1>
          <p className="mt-1 text-sm text-gray-500">{entries.length} total submissions</p>
        </div>
      </div>

      {message && (
        <div className={`mb-4 rounded-lg px-4 py-3 text-sm ${message.startsWith('Error') ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'}`}>
          {message}
          <button onClick={() => setMessage('')} className="ml-2 font-medium underline">dismiss</button>
        </div>
      )}

      {/* Filter tabs */}
      <div className="mb-6 flex gap-2">
        {['all', 'pending', 'contacted', 'onboarded'].map((s) => (
          <button
            key={s}
            onClick={() => { setFilter(s); setLoading(true); }}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              filter === s ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)} ({counts[s as keyof typeof counts] ?? 0})
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : entries.length === 0 ? (
        <p className="text-gray-400">No waitlist entries yet.</p>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-gray-200 bg-white">
              {/* Summary row */}
              <div
                className="flex cursor-pointer items-center gap-4 px-5 py-4"
                onClick={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <p className="text-sm font-semibold text-gray-900 truncate">{entry.business_name}</p>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STATUS_COLORS[entry.status]}`}>
                      {entry.status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">
                    {entry.owner_name} &middot; {entry.email} {entry.category ? `· ${entry.category}` : ''}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-gray-400">{new Date(entry.created_at).toLocaleDateString()}</p>
                <svg className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${expandedId === entry.id ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </div>

              {/* Expanded details */}
              {expandedId === entry.id && (
                <div className="border-t border-gray-100 px-5 py-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-medium text-gray-400">Phone</p>
                      <p className="text-sm text-gray-700">{entry.phone || '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-400">Team Size</p>
                      <p className="text-sm text-gray-700">{entry.staff_count} staff</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-gray-400">Location</p>
                      <p className="text-sm text-gray-700">{entry.location || '—'}</p>
                    </div>
                    <div className="sm:col-span-2">
                      <p className="text-xs font-medium text-gray-400">Services</p>
                      <p className="text-sm text-gray-700">{entry.services_description || '—'}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-4">
                    {entry.status === 'pending' && (
                      <>
                        <button
                          onClick={() => setupTenant(entry.id)}
                          disabled={settingUp === entry.id}
                          className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                        >
                          {settingUp === entry.id ? 'Setting up...' : 'Set Up Tenant'}
                        </button>
                        <button
                          onClick={() => updateStatus(entry.id, 'contacted')}
                          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                        >
                          Mark Contacted
                        </button>
                        <button
                          onClick={() => updateStatus(entry.id, 'declined')}
                          className="rounded-lg px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
                        >
                          Decline
                        </button>
                      </>
                    )}
                    {entry.status === 'contacted' && (
                      <button
                        onClick={() => setupTenant(entry.id)}
                        disabled={settingUp === entry.id}
                        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
                      >
                        {settingUp === entry.id ? 'Setting up...' : 'Set Up Tenant'}
                      </button>
                    )}
                    {entry.status === 'onboarded' && (
                      <button
                        onClick={() => sendInvite(entry.email, entry.id)}
                        disabled={inviting === entry.id}
                        className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 transition-colors"
                      >
                        {inviting === entry.id ? 'Sending...' : 'Send Login Invite'}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
