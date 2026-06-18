import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { notifyCampaign } from '@/lib/notify-campaign';

interface CampaignBody {
  title?: string;
  blurb?: string;
  description?: string;
  image_url?: string;
  campaign_type?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: string;
  is_property_only?: boolean;
  cta_label?: string;
  cta_url?: string;
  cta_type?: string;
  cta_fields?: string[];
  cta_required?: string[];
  cta_plus_one_limit?: number | null;
  is_active?: boolean;
  tenantIds?: string[];
}

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: campaigns } = await ctx.admin
    .from('property_campaigns')
    .select('*')
    .eq('property_id', ctx.propertyId)
    .order('created_at', { ascending: false });

  const list = (campaigns ?? []) as { id: string }[];
  const ids = list.map((c) => c.id);
  const byCampaign = new Map<string, string[]>();
  if (ids.length > 0) {
    const { data: links } = await ctx.admin
      .from('campaign_tenants')
      .select('campaign_id, tenant_id')
      .in('campaign_id', ids);
    for (const l of (links ?? []) as { campaign_id: string; tenant_id: string }[]) {
      const arr = byCampaign.get(l.campaign_id) ?? [];
      arr.push(l.tenant_id);
      byCampaign.set(l.campaign_id, arr);
    }
  }

  return NextResponse.json({
    data: list.map((c) => ({ ...c, tenant_ids: byCampaign.get(c.id) ?? [] })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = (await request.json()) as CampaignBody;
  if (!body.title?.trim()) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

  const { data: created, error } = await ctx.admin
    .from('property_campaigns')
    .insert({
      property_id: ctx.propertyId,
      title: body.title.trim(),
      blurb: body.blurb ?? null,
      description: body.description ?? null,
      image_url: body.image_url ?? null,
      campaign_type: body.campaign_type ?? 'promotion',
      starts_at: body.starts_at || null,
      ends_at: body.ends_at || null,
      location: body.location ?? null,
      is_property_only: body.is_property_only ?? true,
      cta_label: body.cta_label ?? null,
      cta_url: body.cta_url ?? null,
      cta_type: body.cta_type ?? 'none',
      cta_fields: body.cta_fields ?? [],
      cta_required: body.cta_required ?? [],
      cta_plus_one_limit: body.cta_plus_one_limit ?? null,
      is_active: body.is_active ?? true,
    } as never)
    .select('id')
    .single();
  if (error || !created) return NextResponse.json({ error: error?.message ?? 'Failed' }, { status: 500 });

  const campaignId = (created as { id: string }).id;
  const tenantIds = body.is_property_only ? [] : (body.tenantIds ?? []);
  if (tenantIds.length > 0) {
    await ctx.admin
      .from('campaign_tenants')
      .insert(tenantIds.map((tid) => ({ campaign_id: campaignId, tenant_id: tid })) as never);
  }

  if (body.is_active ?? true) {
    await notifyCampaign(ctx.admin, ctx.propertyId, slug, { id: campaignId, title: body.title.trim(), blurb: body.blurb ?? null });
  }

  return NextResponse.json({ id: campaignId, status: 'created' }, { status: 201 });
}
