import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const supabase = createClient();

  const { data: program, error: progError } = await supabase
    .from('loyalty_programs')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (progError) return NextResponse.json({ data: null, error: { message: progError.message } }, { status: 500 });

  const { data: rules, error: rulesError } = await supabase
    .from('loyalty_rules')
    .select('*')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  if (rulesError) return NextResponse.json({ data: null, error: { message: rulesError.message } }, { status: 500 });

  return NextResponse.json({ data: { program, rules: rules ?? [] }, error: null });
}

export async function PUT(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const supabase = createAdminClient();

  // Upsert loyalty program
  const programPayload = {
    tenant_id: tenantId,
    is_active: body.is_active ?? false,
    points_per_booking: body.points_per_booking ?? 0,
    points_per_currency_unit: body.points_per_dollar ?? 0,
    redemption_rate: body.redemption_rate ?? 0,
    min_redemption_points: body.min_redemption_points ?? 0,
    points_expiry_days: body.points_expiry_days ?? 0,
    tiers: body.tiers ?? [],
  };

  const { data: program, error: progError } = await supabase
    .from('loyalty_programs')
    .upsert(programPayload as never, { onConflict: 'tenant_id' })
    .select()
    .single();

  if (progError) return NextResponse.json({ data: null, error: { message: progError.message } }, { status: 500 });

  // Replace loyalty rules
  await supabase.from('loyalty_rules').delete().eq('tenant_id', tenantId);

  const rules = body.rules as { type: string; target_id: string | null; points: number }[] | undefined;
  if (rules && Array.isArray(rules) && rules.length > 0) {
    const { error: rulesError } = await supabase.from('loyalty_rules').insert(
      rules.map((r) => ({
        tenant_id: tenantId,
        type: r.type,
        target_id: r.target_id || null,
        points: r.points ?? 0,
      })) as never
    );
    if (rulesError) return NextResponse.json({ data: null, error: { message: rulesError.message } }, { status: 500 });
  }

  return NextResponse.json({ data: { program }, error: null });
}
