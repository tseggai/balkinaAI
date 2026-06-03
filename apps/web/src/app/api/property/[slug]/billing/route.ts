import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { PROPERTY_PLAN_PRICE_IDS } from '@/lib/stripe';
import { countPropertySeats, syncPropertySeats } from '@/lib/property-billing';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/** GET /api/property/[slug]/billing — current subscription state for the UI. */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin: Db = ctx.admin;
  const { data: propRow } = await admin
    .from('properties')
    .select('tier, subscription_status, seats, stripe_subscription_id')
    .eq('id', ctx.propertyId)
    .single();
  const property = (propRow as { tier: string | null; subscription_status: string | null; seats: number | null; stripe_subscription_id: string | null } | null);

  const isActive = property?.subscription_status === 'active' || property?.subscription_status === 'past_due';
  // Keep seats in sync when subscribed; otherwise just report the live count.
  const tenantCount = isActive
    ? await syncPropertySeats(admin, ctx.propertyId)
    : await countPropertySeats(admin, ctx.propertyId);

  return NextResponse.json({
    tier: property?.tier ?? 'essentials',
    subscription_status: property?.subscription_status ?? 'inactive',
    has_subscription: !!property?.stripe_subscription_id && isActive,
    seats: tenantCount,
    role: ctx.role,
    plans_configured: {
      essentials: !!PROPERTY_PLAN_PRICE_IDS.essentials,
      premium: !!PROPERTY_PLAN_PRICE_IDS.premium,
    },
  });
}
