/**
 * Shared TypeScript types mirroring the database schema.
 * All app code imports types from here — never redefine elsewhere.
 */

export type UUID = string;
export type Timestamp = string; // ISO 8601
export type DateString = string; // YYYY-MM-DD
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

// ─── Enums ────────────────────────────────────────────────────────────────────

export type TenantStatus = 'active' | 'inactive' | 'suspended' | 'pending_subscription' | 'past_due';
export type AppointmentStatus = 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
export type DepositType = 'fixed' | 'percentage';
export type DiscountType = 'percentage' | 'fixed';
export type NudgeTriggerType = 'predicted_rebooking' | 'lapsed_customer' | 'post_appointment';

// ─── Table row types ──────────────────────────────────────────────────────────

export interface SubscriptionPlan {
  id: UUID;
  name: string;
  price_monthly: number;
  stripe_price_id: string | null;
  max_staff: number;
  max_locations: number;
  features: Json;
  created_at: Timestamp;
}

export interface Tenant {
  id: UUID;
  user_id: UUID;
  name: string;
  owner_name: string;
  email: string;
  phone: string | null;
  category_id: UUID | null;
  stripe_customer_id: string | null;
  stripe_account_id: string | null;
  stripe_subscription_id: string | null;
  subscription_plan_id: UUID | null;
  status: TenantStatus;
  created_at: Timestamp;
}

export interface TenantLocation {
  id: UUID;
  tenant_id: UUID;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
  timezone: string;
  created_at: Timestamp;
}

export interface Staff {
  id: UUID;
  tenant_id: UUID;
  name: string;
  email: string;
  phone: string | null;
  availability_schedule: Json;
  created_at: Timestamp;
}

export interface Category {
  id: UUID;
  parent_id: UUID | null;
  name: string;
  slug: string;
  icon_url: string | null;
  display_order: number;
  created_at: Timestamp;
}

export interface Service {
  id: UUID;
  tenant_id: UUID;
  category_id: UUID | null;
  name: string;
  duration_minutes: number;
  price: number;
  deposit_enabled: boolean;
  deposit_type: DepositType | null;
  deposit_amount: number | null;
  created_at: Timestamp;
}

export interface ServiceExtra {
  id: UUID;
  service_id: UUID;
  name: string;
  price: number;
  duration_minutes: number;
  created_at: Timestamp;
}

export interface Customer {
  id: UUID; // References auth.users
  display_name: string | null;
  phone: string | null;
  email: string | null;
  push_token: string | null;
  location_sharing_enabled: boolean;
  created_at: Timestamp;
}

export interface Appointment {
  id: UUID;
  customer_id: UUID;
  tenant_id: UUID;
  service_id: UUID;
  staff_id: UUID | null;
  location_id: UUID | null;
  start_time: Timestamp;
  end_time: Timestamp;
  status: AppointmentStatus;
  total_price: number;
  deposit_paid: boolean;
  deposit_amount_paid: number | null;
  balance_due: number | null;
  stripe_payment_intent_id: string | null;
  created_at: Timestamp;
}

export interface CustomerBehaviorProfile {
  id: UUID;
  customer_id: UUID;
  tenant_id: UUID;
  service_id: UUID;
  avg_interval_days: number | null;
  last_booking_date: DateString | null;
  predicted_next_date: DateString | null;
  created_at: Timestamp;
}

export interface Coupon {
  id: UUID;
  tenant_id: UUID;
  code: string;
  discount_type: DiscountType;
  discount_value: number;
  expires_at: Timestamp | null;
  usage_count: number;
  usage_limit: number | null;
  created_at: Timestamp;
}

export interface Review {
  id: UUID;
  appointment_id: UUID;
  customer_id: UUID;
  tenant_id: UUID;
  staff_id: UUID | null;
  rating: number; // 1–5
  comment: string | null;
  created_at: Timestamp;
}

export interface AiNudgeLog {
  id: UUID;
  customer_id: UUID;
  tenant_id: UUID;
  trigger_type: NudgeTriggerType;
  sent_at: Timestamp;
  opened_at: Timestamp | null;
  converted_at: Timestamp | null;
}

export interface StripeWebhookEvent {
  id: UUID;
  stripe_event_id: string;
  processed_at: Timestamp;
}

// ─── API response wrappers ────────────────────────────────────────────────────

export interface ApiSuccess<T> {
  data: T;
  error: null;
}

export interface ApiError {
  data: null;
  error: {
    message: string;
    code?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

// ─── Pagination ───────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
