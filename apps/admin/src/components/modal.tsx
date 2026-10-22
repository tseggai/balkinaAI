'use client';

import { useEffect, type ReactNode } from 'react';

/** Centered in-app dialog. Closes on backdrop click and Escape unless `busy`. */
export function Modal({ open, onClose, title, children, footer, busy = false, width = 'max-w-md' }: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  busy?: boolean;
  width?: string;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, busy, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose} role="dialog" aria-modal="true">
      <div className={`w-full ${width} rounded-2xl bg-white p-5 shadow-xl`} onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold text-gray-900">{title}</h2>
        <div className="mt-3 text-sm text-gray-700">{children}</div>
        {footer && <div className="mt-5 flex justify-end gap-2">{footer}</div>}
      </div>
    </div>
  );
}
