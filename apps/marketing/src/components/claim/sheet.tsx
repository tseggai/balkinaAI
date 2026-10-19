'use client';

import { useEffect, useRef, type ReactNode } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  /** Small uppercase label in the sticky header. */
  eyebrow: ReactNode;
  /** When this value changes the body scrolls back to the top. */
  scrollKey?: string | number;
  children: ReactNode;
}

/**
 * Bottom sheet used by both the booking demo and the activation form so they
 * look and move the same: slides up on phones, pops in centred on desktop.
 * The header is sticky and the body scrolls on its own, so a step change
 * never leaves the user staring at a half-scrolled card.
 */
export function Sheet({ open, onClose, eyebrow, scrollKey, children }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) bodyRef.current?.scrollTo({ top: 0 });
  }, [open, scrollKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sheet-overlay fixed inset-0 z-50 flex items-end justify-center bg-gray-900/40 sm:items-center sm:p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        className="sheet-panel flex max-h-[92dvh] w-full max-w-md flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl sm:max-h-[90vh] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-6 pb-2 pt-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</p>
          <button onClick={onClose} aria-label="Close" className="-mr-2 rounded-full p-2 text-gray-400 hover:bg-gray-100">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div ref={bodyRef} className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-6 pb-6 pt-1">
          {children}
        </div>
      </div>
    </div>
  );
}
