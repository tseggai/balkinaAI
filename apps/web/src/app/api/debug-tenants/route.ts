import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('tenants')
    .select(`id, name, status, tenant_locations(address, latitude, longitude)`)
    .eq('status', 'active');

  const { data: allTenants, error: allError } = await supabase
    .from('tenants')
    .select('id, name, status')
    .limit(50);

  const { data: services, error: svcError } = await supabase
    .from('services')
    .select('id, tenant_id, name, service_category, visibility')
    .limit(50);

  return NextResponse.json({
    active_count: data?.length,
    active_error: error?.message,
    active_tenants: data,
    all_tenants_count: allTenants?.length,
    all_tenants_error: allError?.message,
    all_tenants: allTenants,
    services_count: services?.length,
    services_error: svcError?.message,
    services_sample: services,
  });
}
