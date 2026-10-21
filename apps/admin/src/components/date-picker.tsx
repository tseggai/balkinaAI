'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Small brand-styled date picker (replaces the browser's native calendar).
 * Value is an ISO timestamp or null; picking a day sets 09:00 local time.
 */
export function DatePicker({ value, onChange, placeholder = 'Pick a date', className = '' }: { value: string | null; onChange: (iso: string | null) => void; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const selected = value ? new Date(value) : null;
  const [view, setView] = useState(() => startOfMonth(selected ?? new Date()));
  const ref = useRef<HTMLDivElement>(null);

  const toggle = () => {
    if (!open) setView(startOfMonth(selected ?? new Date()));
    setOpen(!open);
  };
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const today = new Date();
  const pick = (d: Date) => {
    const at = new Date(d);
    at.setHours(9, 0, 0, 0);
    onChange(at.toISOString());
    setOpen(false);
  };
  const days = monthGrid(view);
  const label = selected ? selected.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' }) : placeholder;

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button type="button" onClick={toggle} className={`flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm hover:bg-gray-50 ${selected ? 'text-gray-900' : 'text-gray-500'}`}>
        <svg className="h-4 w-4 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8} aria-hidden><path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" /></svg>
        {label}
      </button>

      {open && (
        <div className="absolute left-0 z-20 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setView(addMonths(view, -1))} aria-label="Previous month" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
            </button>
            <span className="text-sm font-semibold text-gray-900">{view.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
            <button type="button" onClick={() => setView(addMonths(view, 1))} aria-label="Next month" className="rounded-lg p-1 text-gray-500 hover:bg-gray-100">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
            </button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium text-gray-400">
            {['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map((d) => <span key={d} className="py-1">{d}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5 text-sm">
            {days.map((d) => {
              const inMonth = d.getMonth() === view.getMonth();
              const isSel = !!selected && sameDay(d, selected);
              const isToday = sameDay(d, today);
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => pick(d)}
                  className={`h-8 rounded-lg ${isSel ? 'bg-brand-600 font-semibold text-white' : isToday ? 'border border-brand-300 text-brand-700 hover:bg-brand-50' : inMonth ? 'text-gray-800 hover:bg-brand-50' : 'text-gray-300 hover:bg-gray-50'}`}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between text-xs">
            <button type="button" onClick={() => { onChange(null); setOpen(false); }} className="text-gray-500 hover:underline">Clear</button>
            <button type="button" onClick={() => pick(today)} className="font-medium text-brand-600 hover:underline">Today</button>
          </div>
        </div>
      )}
    </div>
  );
}

function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number): Date { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function sameDay(a: Date, b: Date): boolean { return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }

/** 6 rows × 7 days, weeks starting Monday. */
function monthGrid(view: Date): Date[] {
  const first = startOfMonth(view);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);
  return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
}
