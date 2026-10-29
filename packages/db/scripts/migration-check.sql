-- Which migration files have left their mark in this database?
-- One representative object per file (first CREATE TABLE / ADD COLUMN / FUNCTION / VIEW / POLICY / INDEX).
-- 'check' probes look for a value inside a CHECK constraint; 'rows'/'insert' only prove the table or column exists. Run in the Supabase SQL editor.
WITH probes(migration, kind, obj, col) AS (VALUES
  ('001_initial_schema','table','subscription_plans',NULL),
  ('002_tenant_auth_fields','column','tenants','user_id'),
  ('003_fix_tenant_rls_and_jwt_helper','function','get_my_tenant_id',NULL),
  ('004_chat_tables','table','chat_sessions',NULL),
  ('005_public_tenant_read_policy','policy','Active tenants are publicly readable',NULL),
  ('006_robust_services','table','service_staff',NULL),
  ('007_clean','table','service_staff',NULL),
  ('007_phase6_full_features','table','custom_fields',NULL),
  ('008_chat_sessions_nullable_tenant','nullable','chat_sessions','tenant_id'),
  ('009_fix_coupons_loyalty_inventory_schema','column','coupons','is_lifetime'),
  ('010_add_notes_relax_coupon_check','column','appointments','notes'),
  ('011_appointment_line_items','table','appointment_extras',NULL),
  ('012_staff_special_days_and_locations','table','staff_special_days',NULL),
  ('013_add_missing_columns','column','customers','first_name'),
  ('014_demo_seed_tenants','insert','tenants',NULL),
  ('015_tenant_logo_url','column','tenants','logo_url'),
  ('016_seed_service_staff_images','rows','staff','image_url'),
  ('017_staff_auth','column','staff','user_id'),
  ('018_add_in_progress_status','check','appointments_status_check','in_progress'),
  ('019_notifications','table','customer_push_tokens',NULL),
  ('020_fix_appointments_rls_customer_user_id','policy','Customers can read their own appointments',NULL),
  ('021_fix_customers_rls_user_id','policy','Customers can read their own profile',NULL),
  ('022_add_customer_profile_columns','column','customers','first_name'),
  ('023_fix_customer_lookup_rls','policy','Authenticated users can find customer by own email',NULL),
  ('024_enable_realtime_appointments','publication','appointments',NULL),
  ('025_add_payments_enabled','column','tenants','payments_enabled'),
  ('026_add_approved_appointment_status','check','appointments_status_check','approved'),
  ('027_add_rating_columns_and_trigger','column','tenants','avg_rating'),
  ('028_behavior_rls_policies','policy','Tenants can view their own behavior profiles',NULL),
  ('029_service_locations','table','service_locations',NULL),
  ('030_structured_address_fields','column','tenant_locations','street_address'),
  ('031_subscription_addons','column','subscription_plans','extra_staff_price'),
  ('032_waitlist','table','waitlist',NULL),
  ('033_currency','column','waitlist','currency'),
  ('034_fix_rls_infinite_recursion','function','customer_has_appointment_with_tenant',NULL),
  ('035_tenant_gallery','table','location_gallery',NULL),
  ('036_ical_calendar_sync','table','staff_external_calendars',NULL),
  ('037_google_calendar_oauth','table','staff_google_calendar_connections',NULL),
  ('038_octo_integration','table','octo_connections',NULL),
  ('039_subcategories_and_description','column','tenants','description'),
  ('040_white_label_properties','table','properties',NULL),
  ('041_property_invites','table','property_invites',NULL),
  ('042_property_waitlist','column','waitlist','property_id'),
  ('043_property_messages','table','property_messages',NULL),
  ('044_property_billing','column','properties','stripe_customer_id'),
  ('045_property_message_reads','table','property_message_reads',NULL),
  ('046_property_tier_custom','check','properties_tier_check','custom'),
  ('047_restaurant_bookings','column','appointments','booking_type'),
  ('048_service_type','column','services','service_type'),
  ('049_business_type','column','tenants','business_type'),
  ('050_business_type_service_hospitality','column','categories','business_type'),
  ('051_pricing_type_per_person','check','services_pricing_type_check','per_person'),
  ('052_cover_imagery','column','properties','cover_image_url'),
  ('053_fix_property_admins_rls_recursion','function','is_admin_of_property',NULL),
  ('054_property_campaigns','table','property_campaigns',NULL),
  ('055_campaign_cta_and_entries','table','campaign_entries',NULL),
  ('056_campaign_required_pluslimit_push_scope','column','property_campaigns','cta_required'),
  ('057_campaign_entry_checkin','column','campaign_entries','checked_in_at'),
  ('058_campaign_per_guest_checkin','column','campaign_entries','checked_in'),
  ('059_property_splash_image','column','properties','splash_image_url'),
  ('060_property_members','table','property_member_codes',NULL),
  ('061_campaign_audience','column','property_campaigns','audience'),
  ('062_message_recipient_label','column','property_messages','recipient_label'),
  ('063_member_code_invites','column','property_member_codes','email'),
  ('064_deck_slides','table','deck_slides',NULL),
  ('065_deck_slides_visible','column','deck_slides','visible'),
  ('066_tenant_deck_restructure','insert','deck_slides',NULL),
  ('067_bokun_webhook_token','column','tenants','bokun_webhook_token'),
  ('068_growth','table','growth_search_targets',NULL),
  ('069_growth_claims','column','growth_prospects','claim_token'),
  ('070_growth_crm','column','growth_prospects','next_follow_up_at'),
  ('071_ig_publish_log','table','ig_publish_log',NULL),
  ('072_ig_schedule','table','ig_settings',NULL),
  ('073_canva_studio','table','canva_connection',NULL),
  ('074_ig_posts','table','ig_posts',NULL),
  ('075_ig_posts_bilingual','column','ig_posts','langs'),
  ('076_ig_posts_render_merge','column','ig_posts','canva_asset_id'),
  ('077_ig_token','column','ig_settings','access_token')
)
SELECT migration, kind, obj || COALESCE('.' || col, '') AS checks,
  CASE kind
    WHEN 'table'    THEN EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_name = obj)
    WHEN 'column'   THEN EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = obj AND c.column_name = col)
    WHEN 'function' THEN EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = obj)
    WHEN 'view'     THEN EXISTS (SELECT 1 FROM information_schema.views v WHERE v.table_schema = 'public' AND v.table_name = obj)
    WHEN 'policy'   THEN EXISTS (SELECT 1 FROM pg_policies pp WHERE pp.policyname = obj)
    WHEN 'index'    THEN EXISTS (SELECT 1 FROM pg_indexes i WHERE i.schemaname = 'public' AND i.indexname = obj)
    WHEN 'insert'   THEN EXISTS (SELECT 1 FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_name = obj)
    WHEN 'nullable' THEN EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = obj AND c.column_name = col AND c.is_nullable = 'YES')
    WHEN 'rows'     THEN EXISTS (SELECT 1 FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = obj AND c.column_name = col)
    WHEN 'check'    THEN EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conname = obj AND pg_get_constraintdef(k.oid) LIKE '%' || col || '%')
    WHEN 'publication' THEN EXISTS (SELECT 1 FROM pg_publication_tables pt WHERE pt.pubname = 'supabase_realtime' AND pt.tablename = obj)
    ELSE NULL
  END AS applied
FROM probes
ORDER BY migration;
