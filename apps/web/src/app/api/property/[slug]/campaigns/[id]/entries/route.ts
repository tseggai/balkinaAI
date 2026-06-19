import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';

/** GET entries (RSVPs/sign-ups) for a campaign — property admin only. */
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: camp } = await ctx.admin
    .from('property_campaigns')
    .select('id, cta_fields')
    .eq('id', id)
    .eq('property_id', ctx.propertyId)
    .maybeSingle();
  if (!camp) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const { data } = await ctx.admin
    .from('campaign_entries')
    .select('id, data, created_at, checked_in')
    .eq('campaign_id', id)
    .order('created_at', { ascending: false });

  return NextResponse.json({
    fields: (camp as { cta_fields: string[] }).cta_fields ?? [],
    entries: data ?? [],
  });
}

/**
 * PATCH { entryId, guestIndex, checked } — check a single guest in/out.
 * Per-guest check-in lives in campaign_entries.checked_in: { "<index>": ISO }.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await request.json() as { entryId?: string; guestIndex?: number; checked?: boolean };
  if (!body.entryId || body.guestIndex == null) {
    return NextResponse.json({ error: 'entryId and guestIndex required' }, { status: 400 });
  }
  const key = String(body.guestIndex);

  const { data: entry } = await ctx.admin
    .from('campaign_entries')
    .select('id, checked_in, data, campaign_id, property_campaigns!inner(property_id)')
    .eq('id', body.entryId)
    .eq('campaign_id', id)
    .maybeSingle();
  const e = entry as { checked_in: Record<string, string> | null; data: Record<string, unknown>; property_campaigns: { property_id: string } | { property_id: string }[] } | null;
  if (!e) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const pc = Array.isArray(e.property_campaigns) ? e.property_campaigns[0] : e.property_campaigns;
  if (pc?.property_id !== ctx.propertyId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const checkedIn = { ...(e.checked_in ?? {}) };
  const wasCheckedIn = !!checkedIn[key];
  const guests = (e.data?.guests as { name?: string }[] | undefined) ?? [];
  const guestName = guests[body.guestIndex]?.name || (body.guestIndex === 0 ? 'Guest' : `Guest ${body.guestIndex}`);

  if (body.checked === false) {
    delete checkedIn[key];
  } else {
    checkedIn[key] = new Date().toISOString();
  }

  const { error } = await ctx.admin
    .from('campaign_entries')
    .update({ checked_in: checkedIn } as never)
    .eq('id', body.entryId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ status: 'ok', already: wasCheckedIn && body.checked !== false, guestName, checked_in: checkedIn });
}
