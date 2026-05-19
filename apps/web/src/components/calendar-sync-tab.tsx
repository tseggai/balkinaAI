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

export function CalendarSyncTab({ staffId }: { staffId: string }) {
  const [feedToken, setFeedToken] = useState('');
  const [calendars, setCalendars] = useState<ExternalCalendar[]>([]);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/tenant/staff-calendars?staffId=${staffId}`);
      const json = await res.json();
      if (json.data) {
        setFeedToken(json.data.feedToken ?? '');
        setCalendars(json.data.calendars ?? []);
      }
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
