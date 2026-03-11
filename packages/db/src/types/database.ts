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
          latitude: number | null;
          longitude: number | null;
          timezone: string;
          booking_limit_enabled: boolean;
          booking_limit_capacity: number | null;
          booking_limit_interval: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          address: string;
          latitude?: number | null;
          longitude?: number | null;
          timezone?: string;
          booking_limit_enabled?: boolean;
          booking_limit_capacity?: number | null;
          booking_limit_interval?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          address?: string;
          latitude?: number | null;
          longitude?: number | null;
          timezone?: string;
          booking_limit_enabled?: boolean;
          booking_limit_capacity?: number | null;
          booking_limit_interval?: string | null;
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
          image_url: string | null;
          profession: string | null;
          notes: string | null;
          is_active: boolean;
          booking_limit_capacity: number | null;
          booking_limit_interval: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          email: string;
          phone?: string | null;
          availability_schedule?: Json;
          image_url?: string | null;
          profession?: string | null;
          notes?: string | null;
          is_active?: boolean;
          booking_limit_capacity?: number | null;
          booking_limit_interval?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          email?: string;
          phone?: string | null;
          availability_schedule?: Json;
          image_url?: string | null;
          profession?: string | null;
          notes?: string | null;
          is_active?: boolean;
          booking_limit_capacity?: number | null;
          booking_limit_interval?: string | null;
          status?: string;
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
          deposit_type: string | null;
          deposit_amount: number | null;
          image_url: string | null;
          color: string;
          description: string | null;
          buffer_time_before: number;
          buffer_time_after: number;
          custom_duration: boolean;
          is_recurring: boolean;
          capacity: number;
          hide_price: boolean;
          hide_duration: boolean;
          visibility: string;
          min_booking_lead_time: number;
          max_booking_days_ahead: number;
          min_extras: number;
          max_extras: number | null;
          booking_limit_per_customer: number | null;
          booking_limit_per_customer_interval: string | null;
          booking_limit_per_slot: number | null;
          booking_limit_per_slot_interval: string | null;
          category_name: string | null;
          timesheet: Json | null;
          recurring_type: string | null;
          recurring_frequency: number;
          capacity_type: string;
          max_capacity: number;
          bring_friend: boolean;
          service_category: string | null;
          service_subcategory: string | null;
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
          deposit_type?: string | null;
          deposit_amount?: number | null;
          image_url?: string | null;
          color?: string;
          description?: string | null;
          buffer_time_before?: number;
          buffer_time_after?: number;
          custom_duration?: boolean;
          is_recurring?: boolean;
          capacity?: number;
          hide_price?: boolean;
          hide_duration?: boolean;
          visibility?: string;
          min_booking_lead_time?: number;
          max_booking_days_ahead?: number;
          min_extras?: number;
          max_extras?: number | null;
          booking_limit_per_customer?: number | null;
          booking_limit_per_customer_interval?: string | null;
          booking_limit_per_slot?: number | null;
          booking_limit_per_slot_interval?: string | null;
          category_name?: string | null;
          timesheet?: Json | null;
          recurring_type?: string | null;
          recurring_frequency?: number;
          capacity_type?: string;
          max_capacity?: number;
          bring_friend?: boolean;
          service_category?: string | null;
          service_subcategory?: string | null;
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
          deposit_type?: string | null;
          deposit_amount?: number | null;
          image_url?: string | null;
          color?: string;
          description?: string | null;
          buffer_time_before?: number;
          buffer_time_after?: number;
          custom_duration?: boolean;
          is_recurring?: boolean;
          capacity?: number;
          hide_price?: boolean;
          hide_duration?: boolean;
          visibility?: string;
          min_booking_lead_time?: number;
          max_booking_days_ahead?: number;
          min_extras?: number;
          max_extras?: number | null;
          booking_limit_per_customer?: number | null;
          booking_limit_per_customer_interval?: string | null;
          booking_limit_per_slot?: number | null;
          booking_limit_per_slot_interval?: string | null;
          category_name?: string | null;
          timesheet?: Json | null;
          recurring_type?: string | null;
          recurring_frequency?: number;
          capacity_type?: string;
          max_capacity?: number;
          bring_friend?: boolean;
          service_category?: string | null;
          service_subcategory?: string | null;
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
          status:
            | 'pending'
            | 'confirmed'
            | 'cancelled'
            | 'completed'
            | 'no_show'
            | 'rescheduled'
            | 'rejected'
            | 'emergency';
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
          status?:
            | 'pending'
            | 'confirmed'
            | 'cancelled'
            | 'completed'
            | 'no_show'
            | 'rescheduled'
            | 'rejected'
            | 'emergency';
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
          status?:
            | 'pending'
            | 'confirmed'
            | 'cancelled'
            | 'completed'
            | 'no_show'
            | 'rescheduled'
            | 'rejected'
            | 'emergency';
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
      custom_fields: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          field_type: string;
          options: Json | null;
          is_required: boolean;
          applies_to: string;
          display_order: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          field_type: string;
          options?: Json | null;
          is_required?: boolean;
          applies_to: string;
          display_order?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          field_type?: string;
          options?: Json | null;
          is_required?: boolean;
          applies_to?: string;
          display_order?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'custom_fields_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      appointment_custom_field_values: {
        Row: {
          id: string;
          appointment_id: string;
          custom_field_id: string;
          value: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          appointment_id: string;
          custom_field_id: string;
          value?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          appointment_id?: string;
          custom_field_id?: string;
          value?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'appointment_custom_field_values_appointment_id_fkey';
            columns: ['appointment_id'];
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'appointment_custom_field_values_custom_field_id_fkey';
            columns: ['custom_field_id'];
            referencedRelation: 'custom_fields';
            referencedColumns: ['id'];
          },
        ];
      };
      service_staff: {
        Row: {
          id: string;
          service_id: string;
          staff_id: string;
          custom_price: number | null;
          custom_deposit: number | null;
          deposit_type: string;
        };
        Insert: {
          id?: string;
          service_id: string;
          staff_id: string;
          custom_price?: number | null;
          custom_deposit?: number | null;
          deposit_type?: string;
        };
        Update: {
          id?: string;
          service_id?: string;
          staff_id?: string;
          custom_price?: number | null;
          custom_deposit?: number | null;
          deposit_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'service_staff_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'service_staff_staff_id_fkey';
            columns: ['staff_id'];
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      service_special_days: {
        Row: {
          id: string;
          service_id: string;
          date: string;
          start_time: string | null;
          end_time: string | null;
          is_day_off: boolean;
          breaks: Json;
        };
        Insert: {
          id?: string;
          service_id: string;
          date: string;
          start_time?: string | null;
          end_time?: string | null;
          is_day_off?: boolean;
          breaks?: Json;
        };
        Update: {
          id?: string;
          service_id?: string;
          date?: string;
          start_time?: string | null;
          end_time?: string | null;
          is_day_off?: boolean;
          breaks?: Json;
        };
        Relationships: [
          {
            foreignKeyName: 'service_special_days_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_holidays: {
        Row: {
          id: string;
          staff_id: string;
          date: string;
          note: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          staff_id: string;
          date: string;
          note?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          staff_id?: string;
          date?: string;
          note?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_holidays_staff_id_fkey';
            columns: ['staff_id'];
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      packages: {
        Row: {
          id: string;
          tenant_id: string;
          image_url: string | null;
          name: string;
          has_expiration: boolean;
          expiration_value: number | null;
          expiration_unit: string | null;
          is_private: boolean;
          description: string | null;
          price: number;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          image_url?: string | null;
          name: string;
          has_expiration?: boolean;
          expiration_value?: number | null;
          expiration_unit?: string | null;
          is_private?: boolean;
          description?: string | null;
          price: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          image_url?: string | null;
          name?: string;
          has_expiration?: boolean;
          expiration_value?: number | null;
          expiration_unit?: string | null;
          is_private?: boolean;
          description?: string | null;
          price?: number;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'packages_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      package_services: {
        Row: {
          id: string;
          package_id: string;
          service_id: string;
          quantity: number;
        };
        Insert: {
          id?: string;
          package_id: string;
          service_id: string;
          quantity: number;
        };
        Update: {
          id?: string;
          package_id?: string;
          service_id?: string;
          quantity?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'package_services_package_id_fkey';
            columns: ['package_id'];
            referencedRelation: 'packages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'package_services_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_packages: {
        Row: {
          id: string;
          customer_id: string;
          package_id: string;
          tenant_id: string;
          purchased_at: string;
          expires_at: string | null;
          sessions_remaining: Json;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          package_id: string;
          tenant_id: string;
          purchased_at?: string;
          expires_at?: string | null;
          sessions_remaining?: Json;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          package_id?: string;
          tenant_id?: string;
          purchased_at?: string;
          expires_at?: string | null;
          sessions_remaining?: Json;
          status?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_packages_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_packages_package_id_fkey';
            columns: ['package_id'];
            referencedRelation: 'packages';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_packages_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      loyalty_programs: {
        Row: {
          id: string;
          tenant_id: string;
          is_active: boolean;
          points_per_booking: number;
          points_per_currency_unit: number;
          points_to_currency_rate: number;
          min_redemption_points: number;
          points_expiry_days: number | null;
          tiers: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          is_active?: boolean;
          points_per_booking?: number;
          points_per_currency_unit?: number;
          points_to_currency_rate?: number;
          min_redemption_points?: number;
          points_expiry_days?: number | null;
          tiers?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          is_active?: boolean;
          points_per_booking?: number;
          points_per_currency_unit?: number;
          points_to_currency_rate?: number;
          min_redemption_points?: number;
          points_expiry_days?: number | null;
          tiers?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'loyalty_programs_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      loyalty_rules: {
        Row: {
          id: string;
          loyalty_program_id: string;
          rule_type: string;
          condition_value: number | null;
          points_value: number | null;
          service_id: string | null;
          staff_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          loyalty_program_id: string;
          rule_type: string;
          condition_value?: number | null;
          points_value?: number | null;
          service_id?: string | null;
          staff_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          loyalty_program_id?: string;
          rule_type?: string;
          condition_value?: number | null;
          points_value?: number | null;
          service_id?: string | null;
          staff_id?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'loyalty_rules_loyalty_program_id_fkey';
            columns: ['loyalty_program_id'];
            referencedRelation: 'loyalty_programs';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loyalty_rules_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loyalty_rules_staff_id_fkey';
            columns: ['staff_id'];
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      customer_loyalty_points: {
        Row: {
          id: string;
          customer_id: string;
          tenant_id: string;
          points_balance: number;
          tier: string;
          lifetime_points: number;
          updated_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          tenant_id: string;
          points_balance?: number;
          tier?: string;
          lifetime_points?: number;
          updated_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          tenant_id?: string;
          points_balance?: number;
          tier?: string;
          lifetime_points?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'customer_loyalty_points_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'customer_loyalty_points_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      loyalty_transactions: {
        Row: {
          id: string;
          customer_id: string;
          tenant_id: string;
          appointment_id: string | null;
          transaction_type: string;
          points: number;
          description: string | null;
          expires_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          customer_id: string;
          tenant_id: string;
          appointment_id?: string | null;
          transaction_type: string;
          points: number;
          description?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          customer_id?: string;
          tenant_id?: string;
          appointment_id?: string | null;
          transaction_type?: string;
          points?: number;
          description?: string | null;
          expires_at?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'loyalty_transactions_customer_id_fkey';
            columns: ['customer_id'];
            referencedRelation: 'customers';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loyalty_transactions_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'loyalty_transactions_appointment_id_fkey';
            columns: ['appointment_id'];
            referencedRelation: 'appointments';
            referencedColumns: ['id'];
          },
        ];
      };
      products: {
        Row: {
          id: string;
          tenant_id: string;
          image_url: string | null;
          name: string;
          quantity_on_hand: number;
          min_order_quantity: number;
          max_order_quantity: number | null;
          purchase_price: number;
          sell_price: number;
          display_in_booking: boolean;
          description: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          image_url?: string | null;
          name: string;
          quantity_on_hand?: number;
          min_order_quantity?: number;
          max_order_quantity?: number | null;
          purchase_price: number;
          sell_price: number;
          display_in_booking?: boolean;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          image_url?: string | null;
          name?: string;
          quantity_on_hand?: number;
          min_order_quantity?: number;
          max_order_quantity?: number | null;
          purchase_price?: number;
          sell_price?: number;
          display_in_booking?: boolean;
          description?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'products_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      product_services: {
        Row: {
          id: string;
          product_id: string;
          service_id: string;
          quantity_used: number;
        };
        Insert: {
          id?: string;
          product_id: string;
          service_id: string;
          quantity_used: number;
        };
        Update: {
          id?: string;
          product_id?: string;
          service_id?: string;
          quantity_used?: number;
        };
        Relationships: [
          {
            foreignKeyName: 'product_services_product_id_fkey';
            columns: ['product_id'];
            referencedRelation: 'products';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'product_services_service_id_fkey';
            columns: ['service_id'];
            referencedRelation: 'services';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_roles: {
        Row: {
          id: string;
          tenant_id: string;
          name: string;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          tenant_id: string;
          name: string;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          tenant_id?: string;
          name?: string;
          notes?: string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_roles_tenant_id_fkey';
            columns: ['tenant_id'];
            referencedRelation: 'tenants';
            referencedColumns: ['id'];
          },
        ];
      };
      staff_role_assignments: {
        Row: {
          id: string;
          role_id: string;
          staff_id: string;
        };
        Insert: {
          id?: string;
          role_id: string;
          staff_id: string;
        };
        Update: {
          id?: string;
          role_id?: string;
          staff_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'staff_role_assignments_role_id_fkey';
            columns: ['role_id'];
            referencedRelation: 'staff_roles';
            referencedColumns: ['id'];
          },
          {
            foreignKeyName: 'staff_role_assignments_staff_id_fkey';
            columns: ['staff_id'];
            referencedRelation: 'staff';
            referencedColumns: ['id'];
          },
        ];
      };
      role_permissions: {
        Row: {
          id: string;
          role_id: string;
          module: string;
          can_view: boolean;
          can_add: boolean;
          can_edit: boolean;
          can_delete: boolean;
        };
        Insert: {
          id?: string;
          role_id: string;
          module: string;
          can_view?: boolean;
          can_add?: boolean;
          can_edit?: boolean;
          can_delete?: boolean;
        };
        Update: {
          id?: string;
          role_id?: string;
          module?: string;
          can_view?: boolean;
          can_add?: boolean;
          can_edit?: boolean;
          can_delete?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: 'role_permissions_role_id_fkey';
            columns: ['role_id'];
            referencedRelation: 'staff_roles';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
