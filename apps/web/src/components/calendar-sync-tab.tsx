'use client';

import { useEffect, useState, useCallback } from 'react';

interface ExternalCalendar {
  id: string;
  name: string;
  ical_url: string;
  last_synced_at: string | null;
  last_error: string | null;
  is_active: boolean;
}

interface GoogleConnection {
  id: string;
  google_email: string;
  is_active: boolean;
}

export function CalendarSyncTab({ staffId }: { staffId: string }) {
  const [feedToken, setFeedToken] = useState('');
  const [calendars, setCalendars] = useState<ExternalCalendar[]>([]);
  const [googleConn, setGoogleConn] = useState<GoogleConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [calRes, gcalRes] = await Promise.all([
        fetch(`/api/tenant/staff-calendars?staffId=${staffId}`),
        fetch(`/api/tenant/google-calendar?staffId=${staffId}`),
      ]);
      const calJson = await calRes.json();
      if (calJson.data) {
        setFeedToken(calJson.data.feedToken ?? '');
        setCalendars(calJson.data.calendars ?? []);
      }
      const gcalJson = await gcalRes.json();
      setGoogleConn(gcalJson.data ?? null);
    } catch { /* ignore */ }
    setLoading(false);
  }, [staffId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const feedUrl = feedToken ? `${window.location.origin}/api/calendar/${feedToken}` : '';

  const copyFeedUrl = () => {
    navigator.clipboard.writeText(feedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addUrl.trim()) return;
    setAdding(true);
    setError('');
    try {
      const res = await fetch('/api/tenant/staff-calendars', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ staffId, name: addName.trim() || 'External Calendar', icalUrl: addUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to add calendar');
      } else {
        setAddName('');
        setAddUrl('');
        fetchData();
      }
    } catch {
      setError('Network error');
    }
    setAdding(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this external calendar?')) return;
    await fetch(`/api/tenant/staff-calendars?id=${id}`, { method: 'DELETE' });
    fetchData();
  };

  if (loading) {
    return <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-gray-100" />)}</div>;
  }

  return (
    <div className="space-y-6">
      {/* Export Feed */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Export Calendar</h3>
        <p className="mt-1 text-xs text-gray-500">
          Copy this URL into Google Calendar, Outlook, Apple Calendar, or any app that supports iCal subscriptions. Bookings will sync automatically.
        </p>
        {feedUrl && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="text"
              readOnly
              value={feedUrl}
              className="flex-1 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600 font-mono"
              onClick={(e) => (e.target as HTMLInputElement).select()}
            />
            <button
              onClick={copyFeedUrl}
              className="rounded-lg bg-brand-500 px-3 py-2 text-xs font-medium text-white hover:bg-brand-700 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Google Calendar */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Google Calendar</h3>
        <p className="mt-1 text-xs text-gray-500">
          Connect Google Calendar for real-time two-way sync. Bookings push to your calendar automatically, and your busy times block Balkina bookings.
        </p>
        {googleConn ? (
          <div className="mt-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
              <svg className="h-4 w-4 text-green-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Connected</p>
              <p className="text-xs text-gray-500">{googleConn.google_email}</p>
            </div>
            <button
              onClick={async () => {
                if (!confirm('Disconnect Google Calendar?')) return;
                await fetch(`/api/tenant/google-calendar?staffId=${staffId}`, { method: 'DELETE' });
                fetchData();
              }}
              className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
            >
              Disconnect
            </button>
          </div>
        ) : (
          <a
            href={`/api/tenant/google-calendar/auth?staffId=${staffId}`}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-white border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 transition-colors"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Connect Google Calendar
          </a>
        )}
      </div>

      {/* Import Calendars */}
      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Import External Calendars</h3>
        <p className="mt-1 text-xs text-gray-500">
          Add iCal feed URLs from Google Calendar, Airbnb, Calendly, etc. Busy times will block bookings for this staff member. Syncs every 15 minutes.
        </p>

        {/* Existing calendars */}
        {calendars.length > 0 && (
          <div className="mt-3 space-y-2">
            {calendars.map((cal) => (
              <div key={cal.id} className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{cal.name}</p>
                  <p className="text-xs text-gray-400 truncate">{cal.ical_url}</p>
                  <p className="text-xs text-gray-400">
                    {cal.last_synced_at
                      ? `Last synced: ${new Date(cal.last_synced_at).toLocaleString()}`
                      : 'Not synced yet'}
                    {cal.last_error && <span className="text-red-400 ml-2">Error: {cal.last_error}</span>}
                  </p>
                </div>
                <button
                  onClick={() => handleDelete(cal.id)}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Add new */}
        <form onSubmit={handleAdd} className="mt-3 space-y-2">
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Calendar name"
              value={addName}
              onChange={(e) => setAddName(e.target.value)}
              className="w-1/3 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
            <input
              type="url"
              placeholder="iCal URL (https://...)"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              required
              className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button
            type="submit"
            disabled={adding || !addUrl.trim()}
            className="rounded-lg bg-brand-500 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:opacity-50 transition-colors"
          >
            {adding ? 'Adding...' : 'Add Calendar'}
          </button>
        </form>
      </div>
    </div>
  );
}
