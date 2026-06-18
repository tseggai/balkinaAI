import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';

/** GET entries (RSVPs/sign-ups) for a campaign — property admin only. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Ensure the campaign belongs to this property.
  const { data: camp } = await ctx.admin
    .from('property_campaigns')
    .select('id, cta_fields')
    .eq('id', id)
    .eq('property_id', ctx.propertyId)
    .maybeSingle();
  if (!camp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await ctx.admin
    .from('campaign_entries')
    .select('id, data, created_at')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    fields: (camp as { cta_fields: string[] }).cta_fields ?? [],
    entries: data ?? [],
  });
}
