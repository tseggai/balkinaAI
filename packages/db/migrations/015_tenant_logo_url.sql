-- =============================================================================
-- Migration: 015_tenant_logo_url.sql
-- Adds logo_url column to tenants table for business branding
-- =============================================================================

ALTER TABLE tenants ADD COLUMN IF NOT EXISTS logo_url text;

-- ── Seed logos for demo tenants ──────────────────────────────────────────────
-- Using placeholder images from picsum.photos with fixed seeds for consistency

UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000001'; -- Milpitas Fades Barbershop
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000002'; -- Zen Garden Spa & Wellness
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1545205597-3d9d02c29597?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000003'; -- Sunrise Yoga Studio
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000004'; -- Peak Performance Coaching
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1629909613654-28e377c37b09?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000005'; -- Milpitas Family Dental
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000006'; -- Glow Skin Studio
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1604654894610-df63bc536371?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000007'; -- Polished Nails & Beauty
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000008'; -- Iron Forge Fitness
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1573497620053-ea5300f94f21?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000009'; -- Serenity Therapy Center
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000010'; -- Align Chiropractic
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1562322140-8baeececf08b?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000011'; -- Luxe Lash Salon
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000012'; -- Harmony Music Academy
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000013'; -- Happy Paws Pet Grooming
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1520340356584-f9917d1eea6f?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000014'; -- Elite Auto Detailing
UPDATE tenants SET logo_url = 'https://images.unsplash.com/photo-1506126613408-eca07ce68773?w=400&h=400&fit=crop' WHERE id = 'a0000001-0000-0000-0000-000000000015'; -- Vitality Wellness Coaching
