/**
 * GET /api/widget/[tenantId]/info
 * Public endpoint — returns tenant name for the chat widget.
 * No auth required.
 */
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(
  _request: Request,
  { params }: { params: { tenantId: string } },
) {
  const { tenantId } = params;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('tenants')
    .select('name, status')
    .eq('id', tenantId)
    .single();

  const tenant = data as { name: string; status: string } | null;

  if (error || !tenant || tenant.status !== 'active') {
    return NextResponse.json(
      { data: null, error: { message: 'Business not found' } },
      { status: 404 }
    );
  }

  return NextResponse.json({
    data: { name: tenant.name },
    error: null,
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  });
}
