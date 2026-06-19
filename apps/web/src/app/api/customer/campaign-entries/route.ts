import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return new Response(null, { headers: CORS_HEADERS });
}

/**
 * List a customer's campaign RSVPs / passes (with per-guest check-in state) so
 * they show up in "My Bookings". Scoped to a property when propertySlug is set.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const userId = url.searchParams.get('userId');
  const propertySlug = url.searchParams.get('propertySlug');
  if (!userId) return NextResponse.json({ error: 'userId required' }, { status: 400, headers: CORS_HEADERS });

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  // Resolve the customer record the same way the RSVP endpoint stores it.
  const { data: cust } = await admin
    .from('customers')
    .select('id')
    .or(`id.eq.${userId},user_id.eq.${userId}`)
    .limit(1)
    .maybeSingle();
  const customerId = (cust as { id: string } | null)?.id ?? null;
  if (!customerId) return NextResponse.json({ entries: [] }, { headers: CORS_HEADERS });

  // Optionally scope to a single property (white-label builds).
  let propertyId: string | null = null;
  if (propertySlug) {
    const { data: prop } = await admin.from('properties').select('id').eq('slug', propertySlug).maybeSingle();
    propertyId = (prop as { id: string } | null)?.id ?? null;
  }

  const { data: rows } = await admin
    .from('campaign_entries')
    .select('id, data, checked_in, created_at, property_campaigns!inner(id, title, image_url, location, starts_at, property_id, is_active)')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  type Row = {
    id: string;
    data: Record<string, unknown> | null;
    checked_in: Record<string, string> | null;
    created_at: string;
    property_campaigns: { id: string; title: string; image_url: string | null; location: string | null; starts_at: string | null; property_id: string; is_active: boolean } | { id: string; title: string; image_url: string | null; location: string | null; starts_at: string | null; property_id: string; is_active: boolean }[];
  };

  const entries = ((rows ?? []) as unknown as Row[])
    .map((r) => {
      const camp = Array.isArray(r.property_campaigns) ? r.property_campaigns[0] : r.property_campaigns;
      return { r, camp };
    })
    .filter(({ camp }) => !!camp && (!propertyId || camp.property_id === propertyId))
    .map(({ r, camp }) => {
      const data = r.data ?? {};
      const guests = (data.guests as { name?: string }[] | undefined)
        ?? [{ name: [data.first_name, data.last_name].filter(Boolean).join(' ') || (data.name as string) || 'Guest' }];
      return {
        entryId: r.id,
        campaignId: camp!.id,
        title: camp!.title,
        imageUrl: camp!.image_url,
        location: camp!.location,
        startsAt: camp!.starts_at,
        createdAt: r.created_at,
        guests: guests.map((g, i) => ({
          index: i,
          name: g.name || (i === 0 ? 'Guest' : `Guest ${i}`),
          checkedInAt: r.checked_in?.[String(i)] ?? null,
        })),
      };
    });

  return NextResponse.json({ entries }, { headers: CORS_HEADERS });
}
