'use client';

import { Modal } from '@/components/modal';
import { BTN_DANGER, BTN_PRIMARY, BTN_SECONDARY } from '@/components/prospect-crm';

export interface ConfirmRequest {
  title: string;
  body: string;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void | Promise<void>;
}

/** In-app replacement for window.confirm. Render once; drive it with a `ConfirmRequest | null`. */
export function ConfirmDialog({ request, busy, onClose }: { request: ConfirmRequest | null; busy: boolean; onClose: () => void }) {
  return (
    <Modal
      open={Boolean(request)}
      onClose={onClose}
      title={request?.title ?? ''}
      busy={busy}
      footer={
        <>
          <button type="button" className={BTN_SECONDARY} onClick={onClose} disabled={busy}>Cancel</button>
          <button type="button" className={request?.danger ? BTN_DANGER : BTN_PRIMARY} onClick={() => void request?.onConfirm()} disabled={busy}>
            {busy ? 'Working…' : request?.confirmLabel ?? 'Confirm'}
          </button>
        </>
      }
    >
      {request?.body}
    </Modal>
  );
}
