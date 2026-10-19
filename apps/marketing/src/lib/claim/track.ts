// Fire-and-forget funnel tracking for the claim page. Never throws, never
// blocks the UI; uses sendBeacon when available so events survive navigation.

export type ClaimEventType =
  | 'claim_page_view'
  | 'claim_demo_opened'
  | 'claim_demo_completed'
  | 'claim_activate_opened'
  | 'claim_clicked'
  | 'claim_whatsapp_support'
  | 'claim_share_copy'
  | 'claim_share_whatsapp'
  | 'claim_share_native'
  | 'claim_dashboard_opened';

export function trackClaim(token: string, type: ClaimEventType, payload?: Record<string, string | number | boolean>) {
  try {
    const body = JSON.stringify({ token, type, payload });
    if (typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon('/api/claim/event', new Blob([body], { type: 'application/json' }));
      return;
    }
    void fetch('/api/claim/event', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body, keepalive: true });
  } catch {
    /* tracking must never break the page */
  }
}
