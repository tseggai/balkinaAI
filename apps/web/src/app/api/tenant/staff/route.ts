import { NextResponse } from 'next/server';
import { getTenantContext, CORS_HEADERS } from '../auth';

export async function OPTIONS() { return new Response(null, { headers: CORS_HEADERS }); }

export async function GET(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const [{ data: staff }, { data: staffLocs }, { data: svcStaff }, { data: locations }, { data: services }] = await Promise.all([
    ctx.admin.from('staff').select('id, name, email, phone, image_url, status').eq('tenant_id', ctx.tenantId).order('name'),
    ctx.admin.from('staff_locations').select('staff_id, location_id'),
    ctx.admin.from('service_staff').select('staff_id, service_id'),
    ctx.admin.from('tenant_locations').select('id, name').eq('tenant_id', ctx.tenantId),
    ctx.admin.from('services').select('id, name').eq('tenant_id', ctx.tenantId),
  ]);

  const staffIds = new Set(((staff ?? []) as { id: string }[]).map(s => s.id));

  const locMap = new Map<string, string[]>();
  for (const sl of (staffLocs ?? []) as { staff_id: string; location_id: string }[]) {
    if (!staffIds.has(sl.staff_id)) continue;
    const arr = locMap.get(sl.staff_id) ?? [];
    arr.push(sl.location_id);
    locMap.set(sl.staff_id, arr);
  }

  const svcMap = new Map<string, string[]>();
  for (const ss of (svcStaff ?? []) as { staff_id: string; service_id: string }[]) {
    if (!staffIds.has(ss.staff_id)) continue;
    const arr = svcMap.get(ss.staff_id) ?? [];
    arr.push(ss.service_id);
    svcMap.set(ss.staff_id, arr);
  }

  const enriched = ((staff ?? []) as Record<string, unknown>[]).map(s => ({
    ...s,
    location_ids: locMap.get(s.id as string) ?? [],
    service_ids: svcMap.get(s.id as string) ?? [],
  }));

  return NextResponse.json({
    data: enriched,
    locations: locations ?? [],
    services: services ?? [],
  }, { headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await request.json();
  const { data, error } = await ctx.admin
    .from('staff')
    .insert({
      tenant_id: ctx.tenantId,
      name: body.name,
      email: body.email || null,
      phone: body.phone || null,
      status: 'active',
      availability_schedule: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' },
        saturday: { start: '09:00', end: '17:00' },
      },
    } as never)
    .select('id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500, headers: CORS_HEADERS });

  const staffId = (data as { id: string }).id;

  // Assign locations
  if (Array.isArray(body.location_ids) && body.location_ids.length > 0) {
    await ctx.admin.from('staff_locations').insert(
      body.location_ids.map((lid: string) => ({ staff_id: staffId, location_id: lid })) as never[]
    );
  }

  // Assign services
  if (Array.isArray(body.service_ids) && body.service_ids.length > 0) {
    await ctx.admin.from('service_staff').insert(
      body.service_ids.map((sid: string) => ({ staff_id: staffId, service_id: sid })) as never[]
    );
  }

  // Send invite if email provided
  if (body.send_invite && body.email) {
    try {
      const token = Math.random().toString(36).substring(2, 8).toUpperCase();
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      await ctx.admin.from('staff').update({ invite_token: token, invite_expires_at: expiresAt } as never).eq('id', staffId);

      const resendKey = process.env.RESEND_API_KEY;
      const fromEmail = process.env.RESEND_FROM_EMAIL || 'noreply@balkina.ai';
      if (resendKey) {
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: fromEmail,
            to: body.email,
            subject: `You've been invited to join ${ctx.tenantName} on Balkina AI`,
            html: `<div style="font-family:-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;">
              <h2>You're invited to join ${ctx.tenantName}!</h2>
              <p>Download the Balkina AI app and use the invite code below:</p>
              <p style="font-size:32px;letter-spacing:4px;color:#6B7FC4;text-align:center;font-weight:700;">${token}</p>
              <p>Your email: <strong>${body.email}</strong></p>
              <p><a href="https://apps.apple.com/us/app/balkina-ai/id6761651423" style="display:inline-block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;">Download for iOS</a></p>
              <p style="color:#9ca3af;font-size:13px;">This code expires in 7 days.</p>
            </div>`,
          }),
        });
      }
    } catch { /* best effort */ }
  }

  return NextResponse.json({ data: { id: staffId } }, { status: 201, headers: CORS_HEADERS });
}

export async function PATCH(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const body = await request.json();
  if (!body.id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS_HEADERS });

  // Update staff fields
  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.email !== undefined) updates.email = body.email;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.status !== undefined) updates.status = body.status;

  if (Object.keys(updates).length > 0) {
    await ctx.admin.from('staff').update(updates as never).eq('id', body.id).eq('tenant_id', ctx.tenantId);
  }

  // Update location assignments
  if (Array.isArray(body.location_ids)) {
    await ctx.admin.from('staff_locations').delete().eq('staff_id', body.id);
    if (body.location_ids.length > 0) {
      await ctx.admin.from('staff_locations').insert(
        body.location_ids.map((lid: string) => ({ staff_id: body.id, location_id: lid })) as never[]
      );
    }
  }

  // Update service assignments
  if (Array.isArray(body.service_ids)) {
    await ctx.admin.from('service_staff').delete().eq('staff_id', body.id);
    if (body.service_ids.length > 0) {
      await ctx.admin.from('service_staff').insert(
        body.service_ids.map((sid: string) => ({ staff_id: body.id, service_id: sid })) as never[]
      );
    }
  }

  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}

export async function DELETE(request: Request) {
  const ctx = await getTenantContext(request);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: CORS_HEADERS });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400, headers: CORS_HEADERS });

  await ctx.admin.from('staff_locations').delete().eq('staff_id', id);
  await ctx.admin.from('service_staff').delete().eq('staff_id', id);
  await ctx.admin.from('staff').delete().eq('id', id).eq('tenant_id', ctx.tenantId);
  return NextResponse.json({ success: true }, { headers: CORS_HEADERS });
}
