import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Public list of subscribable plans for the onboarding flow. Sourced from the
 * same admin-managed `subscription_plans` table the marketing site renders, so
 * the two never drift. Only plans with a configured Stripe price are returned —
 * a plan without `stripe_price_id` can't be checked out, so it's hidden until
 * an admin sets one in admin.balkina.ai/dashboard/plans.
 */
export async function GET() {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('subscription_plans')
    .select('id, name, price_monthly, max_staff, max_locations, stripe_price_id')
    .order('price_monthly', { ascending: true });

  if (error) return NextResponse.json({ data: [], error: error.message });

  const plans = (data ?? [])
    .filter((p: Record<string, unknown>) => Boolean(p.stripe_price_id))
    .map((p: Record<string, unknown>) => ({
      id: p.id as string,
      name: p.name as string,
      price_monthly: Number(p.price_monthly ?? 0),
      max_staff: Number(p.max_staff ?? 1),
      max_locations: Number(p.max_locations ?? 1),
    }));

  return NextResponse.json({ data: plans });
}
