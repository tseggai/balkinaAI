import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const { data, error } = await auth.supabase
    .from('subscription_plans')
    .select('*')
    .order('price_monthly', { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Count tenants per plan
  const { data: tenants } = await auth.supabase
    .from('tenants')
    .select('subscription_plan_id');

  const planCounts: Record<string, number> = {};
  for (const t of (tenants ?? []) as { subscription_plan_id: string | null }[]) {
    if (t.subscription_plan_id) {
      planCounts[t.subscription_plan_id] = (planCounts[t.subscription_plan_id] ?? 0) + 1;
    }
  }

  const plansWithCounts = (data ?? []).map((plan: Record<string, unknown>) => ({
    ...plan,
    tenant_count: planCounts[plan.id as string] ?? 0,
  }));

  return NextResponse.json({ data: plansWithCounts });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { name, price_monthly, stripe_price_id, max_staff, max_locations, features } = body as {
    name: string;
    price_monthly: number;
    stripe_price_id?: string;
    max_staff?: number;
    max_locations?: number;
    features?: Record<string, unknown>;
  };

  if (!name) return NextResponse.json({ error: 'name is required' }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('subscription_plans')
    .insert({
      name,
      price_monthly: price_monthly ?? 0,
      stripe_price_id: stripe_price_id ?? null,
      max_staff: max_staff ?? 1,
      max_locations: max_locations ?? 1,
      features: features ?? {},
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { id, ...fields } = body as { id: string; name?: string; price_monthly?: number; stripe_price_id?: string; max_staff?: number; max_locations?: number; features?: Record<string, unknown> };

  if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

  const { data, error } = await auth.supabase
    .from('subscription_plans')
    .update(fields)
    .eq('id', id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ data });
}
