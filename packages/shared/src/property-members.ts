/**
 * Property membership (Migration 060). Flags a property's customers by type so
 * they can receive resident-only announcements and special access. The flag is
 * anchored to an owner-distributed code: redeeming one makes the customer an
 * active member of that code's type instantly (no approval).
 */

export const PROPERTY_MEMBER_TYPES = ['homeowner', 'renter', 'commercial_owner', 'guest'] as const;
export type PropertyMemberType = (typeof PROPERTY_MEMBER_TYPES)[number];

export const PROPERTY_MEMBER_TYPE_LABELS: Record<PropertyMemberType, string> = {
  homeowner: 'Homeowner',
  renter: 'Renter',
  commercial_owner: 'Commercial owner',
  guest: 'Guest',
};

/** Residents get resident-only announcements / access. Guests do not. */
const RESIDENT_TYPES: ReadonlySet<PropertyMemberType> = new Set(['homeowner', 'renter', 'commercial_owner']);

export function isResidentType(type?: string | null): boolean {
  return !!type && RESIDENT_TYPES.has(type as PropertyMemberType);
}

export function memberTypeLabel(type?: string | null): string {
  return PROPERTY_MEMBER_TYPE_LABELS[(type as PropertyMemberType)] ?? 'Member';
}

export interface PropertyMember {
  id: string;
  property_id: string;
  customer_id: string;
  member_type: PropertyMemberType;
  unit: string | null;
  status: 'active' | 'revoked';
  source: 'code' | 'admin' | 'import';
  code_id: string | null;
  verified_at: string;
  created_at: string;
  updated_at: string;
}

export interface PropertyMemberCode {
  id: string;
  property_id: string;
  code: string;
  member_type: PropertyMemberType;
  unit: string | null;
  label: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
}
