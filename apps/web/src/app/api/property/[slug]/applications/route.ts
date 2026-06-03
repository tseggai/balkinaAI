import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';

/**
 * GET /api/property/[slug]/applications
 * Waitlist signups that came in through this property's invite links and are
 * awaiting the property owner's review/approval.
 */
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data } = await ctx.admin
    .from('waitlist')
    .select('id, business_name, owner_name, email, phone, category, location, services_description, status, created_at')
    .eq('property_id', ctx.propertyId)
    .in('status', ['pending', 'contacted'])
    .order('created_at', { ascending: false });

  return NextResponse.json({ data: data ?? [] });
}
