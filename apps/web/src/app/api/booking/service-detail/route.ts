import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * GET /api/booking/service-detail?serviceId=&tenantId=
 * Returns a service's selectable extras and packages for the storefront
 * service-detail sheet. Public (anon) read.
 */
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const serviceId = searchParams.get('serviceId');
    const tenantId = searchParams.get('tenantId');
    if (!serviceId) {
      return NextResponse.json({ error: 'serviceId required' }, { status: 400, headers: CORS_HEADERS });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    const { data: extras } = await supabase
      .from('service_extras')
      .select('name, price, duration_minutes')
      .eq('service_id', serviceId)
      .order('price', { ascending: true });

    // Packages that include this service (tenant-scoped, active).
    let packages: { name: string; price: number; description: string | null; image_url: string | null }[] = [];
    const { data: links } = await supabase
      .from('package_services')
      .select('package_id')
      .eq('service_id', serviceId);
    const packageIds = ((links ?? []) as { package_id: string }[]).map((l) => l.package_id);
    if (packageIds.length > 0) {
      let q = supabase
        .from('packages')
        .select('name, price, description, image_url')
        .in('id', packageIds)
        .eq('is_active', true)
        .eq('is_private', false);
      if (tenantId) q = q.eq('tenant_id', tenantId);
      const { data: pkgs } = await q;
      packages = (pkgs ?? []) as typeof packages;
    }

    return NextResponse.json({ extras: extras ?? [], packages }, { headers: CORS_HEADERS });
  } catch (err) {
    console.error('[booking/service-detail] error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500, headers: CORS_HEADERS });
  }
}
