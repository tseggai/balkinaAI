// Chat message parsing and formatting utilities

// ── Card Type Interfaces ────────────────────────────────────────────────────

export interface GalleryPhoto {
  id: string;
  image_url: string;
  caption?: string | null;
}

export interface BusinessCardData {
  type: 'business_card';
  id: string;
  name: string;
  image_url?: string;
  distance_mi: number;
  drive_minutes: number;
  category: string;
  avg_rating?: number;
  review_count?: number;
  gallery_photos?: GalleryPhoto[];
}

export interface ServiceCardData {
  type: 'service_card';
  id: string;
  name: string;
  image_url?: string;
  price: number;
  duration_minutes: number;
  deposit_enabled: boolean;
  deposit_amount?: number;
  deposit_type?: 'fixed' | 'percentage';
}

export interface StaffCardData {
  type: 'staff_card';
  id: string;
  name: string;
  image_url?: string;
  available_slots_count: number;
}

export interface PackageCardData {
  type: 'package_card';
  id: string;
  name: string;
  image_url?: string;
  price: number;
  services_count: number;
  service_names: string[];
  expiration_label?: string;
  customer_owned: boolean;
  sessions_remaining?: number;
}

export interface ExtrasGridData {
  type: 'extras_grid';
  extras: Array<{ id: string; name: string; price: number; duration_minutes: number; type?: string; max_quantity?: number; unit_label?: string | null; selected?: boolean }>;
}

export interface SummaryCardData {
  type: 'summary_card';
  service: string;
  package?: string;
  extras: string[];
  business: string;
  staff: string;
  date: string;
  time: string;
  address: string;
  subtotal: number;
  extras_total: number;
  package_discount: number;
  coupon_discount: number;
  loyalty_discount: number;
  total: number;
  deposit_required?: number;
  points_to_earn: number;
}

export interface ConfirmedCardData {
  type: 'confirmed_card';
  status: 'confirmed' | 'pending' | 'cancelled';
  appointmentId?: string;
  service: string;
  package?: string;
  extras: string[];
  business: string;
  staff: string;
  date: string;
  time: string;
  address: string;
  total: number;
  points_earned: number;
  latitude?: number;
  longitude?: number;
  deposit_amount?: number;
  deposit_paid?: boolean;
  payment_url?: string;
  payment_required?: boolean;
}

export interface ServiceChipData {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  deposit_enabled?: boolean;
  deposit_amount?: number;
  deposit_type?: 'fixed' | 'percentage';
  image_url?: string | null;
}

export interface BusinessWithServicesData {
  type: 'business_with_services';
  items: Array<BusinessCardData & { services: ServiceChipData[] }>;
}

export interface TimeSlotData {
  time: string;
  iso: string;
  staff_name?: string;
  available?: boolean;
}

export interface StaffWithSlotsData {
  type: 'staff_with_slots';
  items: Array<StaffCardData & { slots: TimeSlotData[]; all_slots?: TimeSlotData[] }>;
  anyone_slots?: Array<TimeSlotData>;
}

export interface BookingOptionsData {
  type: 'booking_options';
  packages: PackageCardData[];
  extras: Array<{ id: string; name: string; price: number; duration_minutes: number; type?: string; max_quantity?: number; unit_label?: string | null }>;
}

export type CardData =
  | { type: 'business_cards'; items: BusinessCardData[] }
  | { type: 'service_cards'; items: ServiceCardData[] }
  | { type: 'staff_cards'; items: StaffCardData[] }
  | { type: 'package_cards'; items: PackageCardData[] }
  | ExtrasGridData
  | SummaryCardData
  | ConfirmedCardData
  | BusinessWithServicesData
  | StaffWithSlotsData
  | BookingOptionsData;

export interface ParsedSegment {
  kind: 'text' | 'card';
  text?: string;
  card?: CardData;
}

export interface ParsedLink {
  label: string;
  url: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'businesses' | 'booking_confirmation';
  isStreaming?: boolean;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function cleanAIMessage(text: string): string {
  return text
    // Strip markdown code fences that GPT sometimes wraps around [[CARD:...]] blocks
    .replace(/```(?:json|JSON)?\s*\n?([\s\S]*?)\n?\s*```/g, '$1')
    .replace(/^\d+\.\s*$/gm, '')
    .replace(/^-\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Fallback: detect plain-text summary and convert to card ──────────────

export function tryParseSummaryText(text: string): SummaryCardData | null {
  if (!text.includes('summary of your booking') && !text.includes('booking summary')) return null;

  const extract = (label: string): string => {
    const regex = new RegExp(`[-\\*]*\\s*\\*{0,2}${label}:?\\*{0,2}\\s*(.+)`, 'i');
    const m = text.match(regex);
    return m?.[1]?.trim() ?? '';
  };

  const service = extract('Service');
  const business = extract('Business');
  if (!service || !business) return null;

  const totalMatch = text.match(/total\s+is\s+\*{0,2}\$?([\d.]+)\*{0,2}/i) ?? text.match(/\*{0,2}Total(?:\s*Price)?:?\*{0,2}\s*\$?([\d.]+)/i);
  const total = totalMatch ? parseFloat(totalMatch[1]!) : 0;

  const subtotalMatch = text.match(/Subtotal:?\*{0,2}\s*\$?([\d.]+)/i);
  const subtotal = subtotalMatch ? parseFloat(subtotalMatch[1]!) : total;

  const extrasStr = extract('Extras');
  const extras = extrasStr && extrasStr.toLowerCase() !== 'none' ? extrasStr.split(',').map(e => e.trim()) : [];

  return {
    type: 'summary_card',
    service,
    extras,
    business,
    staff: extract('Staff'),
    date: extract('Date'),
    time: extract('Time'),
    address: extract('Address'),
    subtotal,
    extras_total: 0,
    package_discount: 0,
    coupon_discount: 0,
    loyalty_discount: 0,
    total,
    points_to_earn: 0,
  };
}

// ── Fallback: detect plain-text confirmed booking and convert to card ────

export function tryParseConfirmedText(text: string): ConfirmedCardData | null {
  if (!text.includes('booking is confirmed') && !text.includes('Appointment Confirmed')) return null;

  const extract = (label: string): string => {
    const regex = new RegExp(`[-\\*]*\\s*\\*{0,2}${label}:?\\*{0,2}\\s*(.+)`, 'i');
    const m = text.match(regex);
    return m?.[1]?.trim() ?? '';
  };

  const service = extract('Service');
  const business = extract('Business');
  if (!service || !business) return null;

  const totalMatch = text.match(/\*{0,2}Total(?:\s*Price)?:?\*{0,2}\s*\$?([\d.]+)/i);
  const total = totalMatch ? parseFloat(totalMatch[1]!) : 0;

  const extrasStr = extract('Extras');
  const extras = extrasStr && extrasStr.toLowerCase() !== 'none' ? extrasStr.split(',').map(e => e.trim()) : [];

  return {
    type: 'confirmed_card',
    status: 'confirmed',
    service,
    extras,
    business,
    staff: extract('Staff'),
    date: extract('Date'),
    time: extract('Time'),
    address: extract('Address'),
    total,
    points_earned: 0,
  };
}

// ── Parse [[CARD:...]] blocks from message content ─────────────────────────

export function parseCardBlocks(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  // Match [[CARD:{...}]] — use } followed by ]] to avoid cutting at ]] inside JSON arrays
  const regex = /\[\[CARD:(\{[\s\S]*?\})\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) segments.push({ kind: 'text', text: textBefore });
    }
    try {
      const cardData = JSON.parse(match[1]!) as CardData;
      segments.push({ kind: 'card', card: cardData });
    } catch {
      // Malformed JSON — render as text
      segments.push({ kind: 'text', text: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim();
    if (remaining) segments.push({ kind: 'text', text: remaining });
  }

  if (segments.length > 0) return segments;

  // Fallback: detect plain-text summary and convert to structured card
  const summaryCard = tryParseSummaryText(content);
  if (summaryCard) {
    return [{ kind: 'card', card: summaryCard }];
  }

  // Fallback: detect plain-text confirmed booking and convert to structured card
  const confirmedCard = tryParseConfirmedText(content);
  if (confirmedCard) {
    return [{ kind: 'card', card: confirmedCard }];
  }

  return [{ kind: 'text', text: content }];
}

// ── Parse [[button:...]] and [[link:Label|URL]] ─────────────────────────────

export function parseMessageContent(content: string): { text: string; buttons: string[]; links: ParsedLink[] } {
  const buttonRegex = /\[\[button:([^\]]+)\]\]/g;
  const linkRegex = /\[\[link:([^|]+)\|([^\]]+)\]\]/g;
  const buttons: string[] = [];
  const links: ParsedLink[] = [];

  let text = content.replace(linkRegex, (_match, label: string, url: string) => {
    links.push({ label: label.trim(), url: url.trim() });
    return '';
  });

  text = text.replace(buttonRegex, (_match, label: string) => {
    buttons.push(label.trim());
    return '';
  })
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n+|\n+$/g, '')
    .trim();

  return { text, buttons, links };
}

// ── Color hash for initials ──────────────────────────────────────────────────

const AVATAR_COLORS = ['#6B7FC4', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];

export function nameToColor(name: string): string {
  if (!name) return AVATAR_COLORS[0]!;
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]!;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
