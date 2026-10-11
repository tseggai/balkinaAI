/**
 * Growth engine types (Migration 068). See docs/GTM_GROWTH_PLAN.md.
 */
import type { UUID, Timestamp, DateString, Json } from './index.js';

export type GrowthSegment = 'tenant' | 'property';

export type GrowthProspectStage =
  | 'new'
  | 'enriched'
  | 'qualified'
  | 'disqualified'
  | 'preprovisioned'
  | 'contacted'
  | 'replied'
  | 'claimed'
  | 'signed_up'
  | 'customer'
  | 'lost';

export const GROWTH_PROSPECT_STAGES: GrowthProspectStage[] = [
  'new',
  'enriched',
  'qualified',
  'disqualified',
  'preprovisioned',
  'contacted',
  'replied',
  'claimed',
  'signed_up',
  'customer',
  'lost',
];

export type GrowthEnrollmentStatus =
  | 'pending_approval'
  | 'active'
  | 'paused'
  | 'replied'
  | 'bounced'
  | 'unsubscribed'
  | 'converted'
  | 'finished';

export interface GrowthSearchTarget {
  id: UUID;
  segment: GrowthSegment;
  vertical: string;
  query: string;
  city: string;
  country: string;
  language: string;
  enabled: boolean;
  priority: number;
  last_run_at: Timestamp | null;
  last_results: number | null;
  total_found: number;
  created_at: Timestamp;
}

export interface GrowthProspect {
  id: UUID;
  segment: GrowthSegment;
  vertical: string | null;
  name: string;
  address: string | null;
  city: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  website: string | null;
  instagram: string | null;
  phone: string | null;
  email: string | null;
  google_place_id: string | null;
  google_maps_url: string | null;
  google_rating: number | null;
  google_review_count: number | null;
  google_types: string[] | null;
  business_status: string | null;
  source: string;
  search_target_id: UUID | null;
  icp_score: number;
  stage: GrowthProspectStage;
  enrichment: Json;
  notes: string | null;
  tenant_id: UUID | null;
  enriched_at: Timestamp | null;
  last_contacted_at: Timestamp | null;
  claim_token: string | null;
  preprovisioned_at: Timestamp | null;
  claim_expires_at: Timestamp | null;
  claimed_at: Timestamp | null;
  claim_email: string | null;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface GrowthContact {
  id: UUID;
  prospect_id: UUID;
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  language: string;
  source: string | null;
  consent_basis: string;
  verified_at: Timestamp | null;
  unsubscribed_at: Timestamp | null;
  bounced_at: Timestamp | null;
  created_at: Timestamp;
}

export interface GrowthSequenceStep {
  day: number;
  channel: 'email' | 'sms' | 'linkedin' | 'instagram';
  template: string;
}

export interface GrowthSequence {
  id: UUID;
  name: string;
  segment: GrowthSegment;
  steps: GrowthSequenceStep[];
  requires_approval: boolean;
  daily_cap: number;
  enabled: boolean;
  created_at: Timestamp;
}

export interface GrowthEnrollment {
  id: UUID;
  sequence_id: UUID;
  prospect_id: UUID;
  contact_id: UUID | null;
  current_step: number;
  next_send_at: Timestamp | null;
  status: GrowthEnrollmentStatus;
  drafts: Json;
  created_at: Timestamp;
  updated_at: Timestamp;
}

export interface GrowthEvent {
  id: UUID;
  prospect_id: UUID | null;
  contact_id: UUID | null;
  enrollment_id: UUID | null;
  type: string;
  channel: string | null;
  provider_id: string | null;
  payload: Json;
  created_at: Timestamp;
}

export interface GrowthAdMetric {
  id: UUID;
  platform: string;
  segment: GrowthSegment;
  campaign_id: string;
  campaign_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  day: DateString;
  currency: string;
  spend: number;
  impressions: number;
  clicks: number;
  leads: number;
  signups: number;
  activations: number;
  raw: Json;
  created_at: Timestamp;
}

/** Shape of growth_prospects.enrichment, written by the enricher. */
export interface GrowthEnrichment {
  fetched_at: Timestamp;
  fetched_url: string | null;
  contact_url?: string;
  skipped?: 'no_website' | 'social_only';
  error?: 'fetch_failed';
  title?: string | null;
  description?: string | null;
  lang?: string | null;
  emails: string[];
  phones: string[];
  socials: { instagram?: string; facebook?: string; whatsapp?: string; tiktok?: string; linkedin?: string };
  booking_widget: string | null;
  text_chars?: number;
  llm_model?: string;
  owner_name?: string | null;
  services: { name: string; price?: number | null; currency?: string | null; duration_minutes?: number | null }[];
  hours?: Record<string, string> | null;
  languages?: string[];
  summary?: string | null;
}
