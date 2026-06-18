'use client';

import { useEffect, useRef, useState } from 'react';

/** A clean calendar + time picker. Value is a local 'YYYY-MM-DDTHH:mm' string. */
export function DateTimeField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = value ? new Date(value) : null;
  const [view, setView] = useState(() => (selected ? new Date(selected) : new Date()));
  const time = value ? value.split('T')[1] ?? '12:00' : '12:00';

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const pad = (n: number) => String(n).padStart(2, '0');
  const fmtDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const setDay = (d: Date) => onChange(`${fmtDate(d)}T${time}`);
  const setTime = (t: string) => onChange(`${selected ? fmtDate(selected) : fmtDate(new Date())}T${t}`);

  const display = selected
    ? selected.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) +
      ' · ' + selected.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : (placeholder ?? 'Select date & time');

  // Build the month grid.
  const year = view.getFullYear(), month = view.getMonth();
  const firstDow = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  const today = new Date(); const todayStr = fmtDate(today);

  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
        <span>{display}</span>
        <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
          <div className="flex items-center justify-between px-1">
            <button type="button" onClick={() => setView(new Date(year, month - 1, 1))} className="rounded p-1 text-gray-500 hover:bg-gray-100">‹</button>
            <span className="text-sm font-semibold text-gray-900">{view.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => setView(new Date(year, month + 1, 1))} className="rounded p-1 text-gray-500 hover:bg-gray-100">›</button>
          </div>
          <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[11px] text-gray-400">
            {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={i} className="py-1">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <div key={i} />;
              const isSel = selected && fmtDate(d) === fmtDate(selected);
              const isToday = fmtDate(d) === todayStr;
              return (
                <button key={i} type="button" onClick={() => setDay(d)}
                  className={`h-8 rounded-md text-sm transition-colors ${isSel ? 'bg-brand-500 font-semibold text-white' : isToday ? 'bg-brand-50 text-brand-700' : 'text-gray-700 hover:bg-gray-100'}`}>
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-2 border-t border-gray-100 pt-3">
            <span className="text-xs font-medium text-gray-500">Time</span>
            <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
              className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:border-brand-500 focus:outline-none" />
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg bg-brand-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700">Done</button>
          </div>
        </div>
      )}
    </div>
  );
}
