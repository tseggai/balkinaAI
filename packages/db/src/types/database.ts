/**
 * Supabase database types.
 * Regenerate with: npm run generate-types (from packages/db)
 * Uses: supabase gen types typescript --linked > src/types/database.ts
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      subscription_plans: {
        Row: {
          id: string;
          name: string;
          price_monthly: number;
          stripe_price_id: string | null;
          max_staff: number;
          max_locations: number;
          features: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          price_monthly: number;
          stripe_price_id?: string | null;
          max_staff?: number;
          max_locations?: number;
          features?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          price_monthly?: number;
          stripe_price_id?: string | null;
          max_staff?: number;
          max_locations?: number;
          features?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      tenants: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          owner_name: string;
          email: string;
          phone: string | null;
          category_id: string | null;
          stripe_customer_id: string | null;
          stripe_account_id: string | null;
          stripe_subscription_id: string | null;
          subscription_plan_id: string | null;
          status: 'pending_subscription' | 'active' | 'suspended' | 'past_due';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          owner_name: string;
          email: string;
          phone?: string | null;
          category_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_account_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_plan_id?: string | null;
          status?: 'pending_subscription' | 'active' | 'suspended' | 'past_due';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          owner_name?: string;
          email?: string;
          phone?: string | null;
          category_id?: string | null;
          stripe_customer_id?: string | null;
          stripe_account_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_plan_id?: string | null;
          status?: 'pending_subscription' | 'active' | 'suspended' | 'past_due';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenants_user_id_fkey';
            columns: ['user_id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenants_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'tenants_subscription_plan_id_fkey';
            columns: ['subscription_plan_id'];
            referencedRelation: 'subscription_plans';
            referencedColumns: ['id'];
          },
        ];
      };
      tenant_locations: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          address: string;
          lat: number | null;
          lng: number | null;
          timezone: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          address: string;
          lat?: number | null;
          lng?: number | null;
          timezone?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          address?: string;
          lat?: number | null;
          lng?: number | null;
          timezone?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'tenant_locations_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      staff: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          email: string;
          phone: string | null;
          availability_schedule: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          email: string;
          phone?: string | null;
          availability_schedule?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          availability_schedule?: Json;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      categories: {
        Row: {
          id: string;
          parent_id: string | null;
          name: string;
          slug: string;
          icon_url: string | null;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          parent_id?: string | null;
          name: string;
          slug: string;
          icon_url?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          parent_id?: string | null;
          name?: string;
          slug?: string;
          icon_url?: string | null;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'categories_parent_id_fkey';
            columns: ['parent_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      services: {
        Row: {
          id: string;
          tenant_id: string;
          category_id: string | null;
          name: string;
          duration_minutes: number;
          price: number;
          deposit_enabled: boolean;
          deposit_type: 'fixed' | 'percentage' | null;
          deposit_amount: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          category_id?: string | null;
          name: string;
          duration_minutes: number;
          price: number;
          deposit_enabled?: boolean;
          deposit_type?: 'fixed' | 'percentage' | null;
          deposit_amount?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          category_id?: string | null;
          name?: string;
          duration_minutes?: number;
          price?: number;
          deposit_enabled?: boolean;
          deposit_type?: 'fixed' | 'percentage' | null;
          deposit_amount?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'services_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'services_category_id_fkey';
            columns: ['category_id'];
            referencedRelation: 'categories';
            referencedColumns: ['id'];
          },
        ];
      };
      service_extras: {
        Row: {
          id: string;
          service_id: string;
          name: string;
          price: number;
          duration_minutes: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          name: string;
          price: number;
          duration_minutes?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          name?: string;
          price?: number;
          duration_minutes?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_extras_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      customers: {
        Row: {
          id: string;
          display_name: string | null;
          phone: string | null;
          email: string | null;
          push_token: string | null;
          location_sharing_enabled: boolean;
          created_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          phone?: string | null;
          email?: string | null;
          push_token?: string | null;
          location_sharing_enabled?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          phone?: string | null;
          email?: string | null;
          push_token?: string | null;
          location_sharing_enabled?: boolean;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customers_id_fkey';
            columns: ['id'];
            referencedRelation: 'users';
            referencedColumns: ['id'];
          },
        ];
      };
      appointments: {
        Row: {
          id: string;
          customer_id: string;
          tenant_id: string;
          service_id: string;
          staff_id: string | null;
          location_id: string | null;
          start_time: string;
          end_time: string;
          status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
          total_price: number;
          deposit_paid: boolean;
          deposit_amount_paid: number | null;
          balance_due: number | null;
          stripe_payment_intent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          tenant_id: string;
          service_id: string;
          staff_id?: string | null;
          location_id?: string | null;
          start_time: string;
          end_time: string;
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
          total_price: number;
          deposit_paid?: boolean;
          deposit_amount_paid?: number | null;
          balance_due?: number | null;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          tenant_id?: string;
          service_id?: string;
          staff_id?: string | null;
          location_id?: string | null;
          start_time?: string;
          end_time?: string;
          status?: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show';
          total_price?: number;
          deposit_paid?: boolean;
          deposit_amount_paid?: number | null;
          balance_due?: number | null;
          stripe_payment_intent_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appointments_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_staff_id_fkey';
            columns: ['staff_id'];
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointments_location_id_fkey';
            columns: ['location_id'];
            referencedRelation: 'tenant_locations';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_behavior_profiles: {
        Row: {
          id: string;
          customer_id: string;
          tenant_id: string;
          service_id: string;
          avg_interval_days: number | null;
          last_booking_date: string | null;
          predicted_next_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          tenant_id: string;
          service_id: string;
          avg_interval_days?: number | null;
          last_booking_date?: string | null;
          predicted_next_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          tenant_id?: string;
          service_id?: string;
          avg_interval_days?: number | null;
          last_booking_date?: string | null;
          predicted_next_date?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_behavior_profiles_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_behavior_profiles_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_behavior_profiles_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      coupons: {
        Row: {
          id: string;
          tenant_id: string;
          code: string;
          discount_type: 'percentage' | 'fixed';
          discount_value: number;
          expires_at: string | null;
          usage_count: number;
          usage_limit: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          code: string;
          discount_type: 'percentage' | 'fixed';
          discount_value: number;
          expires_at?: string | null;
          usage_count?: number;
          usage_limit?: number | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          code?: string;
          discount_type?: 'percentage' | 'fixed';
          discount_value?: number;
          expires_at?: string | null;
          usage_count?: number;
          usage_limit?: number | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'coupons_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      reviews: {
        Row: {
          id: string;
          appointment_id: string;
          customer_id: string;
          tenant_id: string;
          staff_id: string | null;
          rating: number;
          comment: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          customer_id: string;
          tenant_id: string;
          staff_id?: string | null;
          rating: number;
          comment?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          customer_id?: string;
          tenant_id?: string;
          staff_id?: string | null;
          rating?: number;
          comment?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'reviews_appointment_id_fkey';
            columns: ['appointment_id'];
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'reviews_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      ai_nudge_log: {
        Row: {
          id: string;
          customer_id: string;
          tenant_id: string;
          trigger_type: string;
          sent_at: string;
          opened_at: string | null;
          converted_at: string | null;
        };
        Insert: {
          id?: string;
          customer_id: string;
          tenant_id: string;
          trigger_type: string;
          sent_at?: string;
          opened_at?: string | null;
          converted_at?: string | null;
        };
        Update: {
          id?: string;
          customer_id?: string;
          tenant_id?: string;
          trigger_type?: string;
          sent_at?: string;
          opened_at?: string | null;
          converted_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: 'ai_nudge_log_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'ai_nudge_log_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      stripe_webhook_events: {
        Row: {
          id: string;
          stripe_event_id: string;
          processed_at: string;
        };
        Insert: {
          id?: string;
          stripe_event_id: string;
          processed_at?: string;
        };
        Update: {
          id?: string;
          stripe_event_id?: string;
          processed_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
