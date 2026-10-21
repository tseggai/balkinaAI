import type { GrowthProspect } from '@balkina/shared';
import { cleanBusinessName, guessOwnerName } from '@balkina/shared';

/**
 * Manual outreach helpers for the Prospects CRM: message templates (SR/EN),
 * channel-tagged claim links, WhatsApp deep links, and the small formatting
 * helpers the list and timeline share.
 */

export type OutreachStep = 'first' | 'follow_up' | 'last_chance';
export type OutreachLang = 'sr' | 'en';
export type OutreachChannel = 'whatsapp' | 'instagram' | 'email' | 'other';

export const OUTREACH_STEPS: { key: OutreachStep; label: string; followUpDays: number | null }[] = [
  { key: 'first', label: 'First touch', followUpDays: 2 },
  { key: 'follow_up', label: 'Follow-up', followUpDays: 3 },
  { key: 'last_chance', label: 'Last chance', followUpDays: null },
];

const CHANNEL_TAG: Record<OutreachChannel, string> = { whatsapp: 'wa', instagram: 'ig', email: 'em', other: 'ot' };
const COUNTRY_CODE: Record<string, string> = { me: '382', rs: '381', hr: '385', ba: '387', si: '386', mk: '389', al: '355', xk: '383' };

export function claimBase(): string {
  return (process.env.NEXT_PUBLIC_CLAIM_BASE_URL ?? 'https://balkina.ai').replace(/\/$/, '');
}

/** Claim link tagged with the channel so page views can be attributed. */
export function claimLinkFor(row: Pick<GrowthProspect, 'claim_token'>, channel: OutreachChannel | null): string | null {
  if (!row.claim_token) return null;
  const url = `${claimBase()}/claim/${row.claim_token}`;
  return channel ? `${url}?c=${CHANNEL_TAG[channel]}` : url;
}

/** Default language from the prospect's country (ex-Yugoslav markets → Serbian). */
export function defaultLang(row: Pick<GrowthProspect, 'country'>): OutreachLang {
  return ['me', 'rs', 'ba', 'hr'].includes((row.country ?? '').toLowerCase()) ? 'sr' : 'en';
}

/** Which message to send next, from how many we already sent. */
export function nextStep(row: Pick<GrowthProspect, 'touches'>): OutreachStep {
  if (row.touches <= 0) return 'first';
  if (row.touches === 1) return 'follow_up';
  return 'last_chance';
}

function firstName(full: string | null): string | null {
  if (!full) return null;
  const first = full.trim().split(/\s+/)[0];
  return first && first.length > 1 ? first : null;
}

function ownerFirstName(row: GrowthProspect): string | null {
  const enrichment = (row.enrichment && typeof row.enrichment === 'object' && !Array.isArray(row.enrichment) ? row.enrichment : {}) as { owner_name?: string | null };
  return firstName(guessOwnerName(row.name, enrichment.owner_name ?? null));
}

function expiresOn(row: GrowthProspect, lang: OutreachLang): string {
  if (!row.claim_expires_at) return lang === 'sr' ? 'kraja nedelje' : 'the end of the week';
  return new Date(row.claim_expires_at).toLocaleDateString(lang === 'sr' ? 'sr-Latn-ME' : 'en-GB', { day: 'numeric', month: 'long' });
}

export function outreachMessage(row: GrowthProspect, step: OutreachStep, lang: OutreachLang, channel: OutreachChannel): string {
  const biz = cleanBusinessName(row.name);
  const name = ownerFirstName(row);
  const link = claimLinkFor(row, channel) ?? '';
  const hi = lang === 'sr' ? `Zdravo${name ? ` ${name}` : ''}` : `Hi${name ? ` ${name}` : ''}`;

  if (lang === 'sr') {
    switch (step) {
      case 'first':
        return `${hi}! 👋 Napravili smo besplatnu stranicu za online zakazivanje za ${biz}: klijenti zakazuju termin za 20 sekundi, i u 23h, a dan ranije dobiju podsetnik.\n\nPogledajte i probajte zakazivanje: ${link}\n\nAko vam se dopada, aktivirajte je jednim klikom — besplatno. Tu sam za sva pitanja.\nBalkina`;
      case 'follow_up':
        return `${hi}, samo da proverim — da li ste stigli da pogledate stranicu za ${biz}? ${link}\n\nProba traje 20 sekundi. Ako imate bilo kakvo pitanje, pišite mi ovde.`;
      case 'last_chance':
        return `${hi}, stranica za ${biz} je rezervisana do ${expiresOn(row, lang)}. Posle toga je uklanjamo da oslobodimo mesto.\n\nAktivacija je besplatna i traje 10 sekundi: ${link}`;
    }
  }
  switch (step) {
    case 'first':
      return `${hi}! 👋 We built a free online booking page for ${biz}: customers book in 20 seconds, even at 11pm, and get a reminder the day before.\n\nTake a look and try a test booking: ${link}\n\nIf you like it, activate it in one tap — free. Happy to answer any questions here.\nBalkina`;
    case 'follow_up':
      return `${hi}, just checking — did you get a chance to look at the page for ${biz}? ${link}\n\nTrying it takes 20 seconds. Any questions, just reply here.`;
    case 'last_chance':
      return `${hi}, the page for ${biz} is reserved until ${expiresOn(row, lang)}. After that we take it down to free the slot.\n\nActivating is free and takes 10 seconds: ${link}`;
  }
}

/** E.164-ish digits for wa.me; adds the country code to local numbers (067… → 38267…). */
export function whatsappDigits(phone: string | null, country: string | null): string | null {
  if (!phone) return null;
  let digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) digits = digits.slice(1);
  else if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) {
    const cc = COUNTRY_CODE[(country ?? '').toLowerCase()];
    if (!cc) return null;
    digits = cc + digits.slice(1);
  }
  return digits.length >= 8 ? digits : null;
}

export function whatsappHref(digits: string, text: string): string {
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

/** Follow-up date N days from now at 09:00 local. */
export function followUpIn(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(9, 0, 0, 0);
  return d.toISOString();
}

export function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const abs = Math.abs(diff);
  const future = diff < 0;
  const m = Math.round(abs / 60000);
  let out: string;
  if (m < 1) out = 'now';
  else if (m < 60) out = `${m}m`;
  else if (m < 60 * 24) out = `${Math.round(m / 60)}h`;
  else if (m < 60 * 24 * 14) out = `${Math.round(m / 1440)}d`;
  else out = `${Math.round(m / 10080)}w`;
  if (out === 'now') return out;
  return future ? `in ${out}` : `${out} ago`;
}

const ACTIVITY_LABELS: Record<string, string> = {
  claim_page_view: 'Viewed page',
  claim_page_leave: 'Time on page',
  claim_demo_opened: 'Opened demo',
  claim_demo_completed: 'Tested booking',
  claim_activate_opened: 'Opened activation',
  claim_clicked: 'Pressed activate',
  claim_whatsapp_support: 'Tapped WhatsApp support',
  claim_share_view: 'Viewed live page',
  claim_share_copy: 'Copied link',
  claim_share_whatsapp: 'Shared on WhatsApp',
  claim_share_native: 'Shared link',
  claim_dashboard_opened: 'Opened dashboard',
  claimed: 'Claimed page',
  sent: 'Message sent',
  replied: 'Replied',
  note: 'Note',
  call: 'Call',
  signed_up: 'Signed up',
  demo_booked: 'Demo booked',
};

export function activityLabel(type: string | null): string {
  if (!type) return '';
  return ACTIVITY_LABELS[type] ?? type.replace(/_/g, ' ');
}

/** Whether an event came from the prospect (vs. something we did). */
export function isProspectAction(type: string): boolean {
  return type.startsWith('claim') || type === 'replied';
}

export function dueState(iso: string | null): { label: string; cls: string } | null {
  if (!iso) return null;
  const due = new Date(iso);
  const now = new Date();
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);
  if (due.getTime() < now.getTime() - 60 * 60 * 1000 && due.toDateString() !== now.toDateString()) {
    return { label: `Overdue ${relativeTime(iso).replace(' ago', '')}`, cls: 'bg-red-100 text-red-700' };
  }
  if (due <= endOfToday) return { label: 'Due today', cls: 'bg-amber-100 text-amber-800' };
  return { label: `Follow up ${relativeTime(iso)}`, cls: 'bg-gray-100 text-gray-600' };
}

export function formatSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}
