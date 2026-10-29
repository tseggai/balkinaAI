'use client';

import { useEffect, useRef, useState } from 'react';

export interface Slide { url: string | null; label: string; placeholder?: string }

/**
 * Instagram-style carousel: one image at a time, arrows on hover, dots, swipe on touch.
 * `aspect` is the Tailwind aspect class of the slide box (aspect-square, aspect-[9/16]).
 */
export function Carousel({ slides, aspect = 'aspect-square', className = '', onOpen, onIndex }: {
  slides: Slide[];
  aspect?: string;
  className?: string;
  onOpen?: (slide: Slide) => void;
  onIndex?: (i: number) => void;
}) {
  const [i, setI] = useState(0);
  const start = useRef<number | null>(null);
  const n = slides.length;
  useEffect(() => { if (i >= n) setI(0); }, [n, i]);
  useEffect(() => { onIndex?.(i); }, [i, onIndex]);
  const go = (d: number) => setI((x) => (x + d + n) % n);
  const s = slides[i];
  if (!s) return null;
  return (
    <div className={`group relative ${className}`}>
      <div
        className={`${aspect} w-full overflow-hidden rounded-xl bg-gray-100`}
        onTouchStart={(e) => { start.current = e.touches[0]?.clientX ?? null; }}
        onTouchEnd={(e) => { const x = e.changedTouches[0]?.clientX ?? null; if (start.current !== null && x !== null && Math.abs(x - start.current) > 40) go(x < start.current ? 1 : -1); start.current = null; }}
      >
        {s.url ? (
          <img src={s.url} alt={s.label} className="h-full w-full cursor-zoom-in object-cover" onClick={() => onOpen?.(s)} />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-4 text-center text-xs text-gray-400">{s.placeholder ?? 'Not rendered yet'}</div>
        )}
      </div>
      {n > 1 && (
        <>
          <button type="button" aria-label="Previous" onClick={() => go(-1)} className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow opacity-0 transition group-hover:opacity-100 focus:opacity-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" /></svg>
          </button>
          <button type="button" aria-label="Next" onClick={() => go(1)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-white/90 p-1.5 text-gray-700 shadow opacity-0 transition group-hover:opacity-100 focus:opacity-100">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" /></svg>
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {slides.map((_, k) => <span key={k} className={`h-1.5 w-1.5 rounded-full ${k === i ? 'bg-white' : 'bg-white/50'} shadow`} />)}
          </div>
        </>
      )}
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-gray-500">
        <span>{s.label}</span>
        {n > 1 && <span>{i + 1} / {n}</span>}
      </div>
    </div>
  );
}
