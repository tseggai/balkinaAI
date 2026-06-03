'use client';

import { useEffect, useState, useCallback } from 'react';

interface TenantMessage {
  id: string;
  subject: string;
  body: string;
  property_name: string;
  is_direct: boolean;
  created_at: string;
  read: boolean;
}

export default function TenantMessagesPage() {
  const [messages, setMessages] = useState<TenantMessage[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch('/api/tenant/messages');
    const json = await res.json();
    const list = (json.messages ?? []) as TenantMessage[];
    setMessages(list);
    setLoading(false);

    // Mark everything as read on open, then refresh the sidebar badge.
    const unreadIds = list.filter((m) => !m.read).map((m) => m.id);
    if (unreadIds.length) {
      await fetch('/api/tenant/messages', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids: unreadIds }),
      }).catch(() => {});
      window.dispatchEvent(new Event('tenant-messages-read'));
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Messages</h1>
        <p className="mt-1 text-sm text-gray-500">Announcements and messages from the properties your business is part of.</p>
      </div>

      {loading ? (
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : messages.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 py-16 text-center text-sm text-gray-400">
          No messages yet.
        </div>
      ) : (
        <div className="mt-6 max-w-2xl space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={`rounded-xl border bg-white p-5 ${m.read ? 'border-gray-200' : 'border-brand-300 bg-brand-50/30'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    {!m.read && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-brand-500" />}
                    <h2 className="truncate text-sm font-semibold text-gray-900">{m.subject}</h2>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {m.property_name} · {m.is_direct ? 'Direct message' : 'Announcement'}
                  </p>
                </div>
                <span className="flex-shrink-0 text-xs text-gray-400">{new Date(m.created_at).toLocaleDateString()}</span>
              </div>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-gray-700">{m.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
