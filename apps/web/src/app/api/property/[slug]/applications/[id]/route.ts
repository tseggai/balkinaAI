import { NextResponse } from 'next/server';
import { getPropertyAdmin } from '@/lib/property-admin';
import { sendTenantLoginEmail } from '@balkina/notifications';

/**
 * Generate a 14-character temp password with mixed case, digits and one symbol,
 * avoiding ambiguous characters so it's easy to type from the email.
 */
function generateTempPassword(): string {
  const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const lower = 'abcdefghjkmnpqrstuvwxyz';
  const digit = '23456789';
  const symbol = '!@#$%&*';
  const all = upper + lower + digit;
  const pick = (chars: string) => chars[Math.floor(Math.random() * chars.length)];
  const required = [pick(upper), pick(lower), pick(digit), pick(symbol)];
  const remaining = Array.from({ length: 10 }, () => pick(all));
  return [...required, ...remaining].sort(() => Math.random() - 0.5).join('');
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Db = any;

/**
 * POST /api/property/[slug]/applications/[id]
 * Approve a property application: provision the tenant account from the waitlist
 * entry, link it to the property, and email the owner their login credentials.
 */
export async function POST(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase: Db = ctx.admin;

  // Fetch the application, scoped to this property.
  const { data: entry, error: fetchErr } = await supabase
    .from('waitlist')
    .select('*')
    .eq('id', id)
    .eq('property_id', ctx.propertyId)
    .single();
  if (fetchErr || !entry) {
    return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  }
  if (entry.status === 'onboarded') {
    return NextResponse.json({ error: 'This application has already been approved' }, { status: 400 });
  }

  // 1. Create (or reuse) the auth user.
  const tempPassword = generateTempPassword();
  let userId: string | null = null;

  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: entry.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: entry.owner_name },
  });

  if (authErr) {
    if (authErr.message?.includes('already been registered') || authErr.message?.includes('already exists')) {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users?.find((u: { email?: string }) => u.email === entry.email);
      if (!existing) return NextResponse.json({ error: `Failed to create user: ${authErr.message}` }, { status: 500 });

      const { data: existingTenant } = await supabase.from('tenants').select('id').eq('user_id', existing.id).single();
      if (existingTenant) {
        // Already a tenant — just link to the property and mark onboarded.
        await linkTenant(supabase, ctx.propertyId, existingTenant.id);
        await supabase.from('waitlist').update({ status: 'onboarded', updated_at: new Date().toISOString() }).eq('id', id);
        return NextResponse.json({ success: true, status: 'linked_existing', message: `${entry.business_name} linked to your property.` });
      }
      await supabase.auth.admin.updateUserById(existing.id, { password: tempPassword });
      userId = existing.id;
    } else {
      return NextResponse.json({ error: `Failed to create user: ${authErr.message}` }, { status: 500 });
    }
  } else {
    userId = authUser.user.id;
  }

  if (!userId) return NextResponse.json({ error: 'Could not resolve user' }, { status: 500 });

  // 2. Resolve category by name (optional).
  let categoryId: string | null = null;
  if (entry.category) {
    const { data: cat } = await supabase.from('categories').select('id').ilike('name', `%${entry.category}%`).limit(1).single();
    if (cat) categoryId = cat.id;
  }

  // 3. Create the tenant (active).
  const { data: tenant, error: tenantErr } = await supabase
    .from('tenants')
    .insert({
      user_id: userId,
      name: entry.business_name,
      owner_name: entry.owner_name,
      email: entry.email,
      phone: entry.phone || null,
      category_id: categoryId,
      currency: entry.currency || 'EUR',
      status: 'active',
    })
    .select('id')
    .single();
  if (tenantErr || !tenant) {
    return NextResponse.json({ error: `Failed to create tenant: ${tenantErr?.message}` }, { status: 500 });
  }
  const tenantId = tenant.id;

  // 4. Location (if provided).
  let locationId: string | null = null;
  if (entry.location) {
    const { data: loc } = await supabase.from('tenant_locations').insert({
      tenant_id: tenantId,
      name: 'Main Location',
      address: entry.location,
      street_address: entry.street || null,
      city: entry.city || null,
      state: entry.state || null,
      country: entry.country || null,
      postal_code: entry.postal_code || null,
    }).select('id').single();
    if (loc) locationId = loc.id;
  }

  // 5. Owner staff member so bookings work immediately.
  const { data: ownerStaff } = await supabase.from('staff').insert({
    tenant_id: tenantId,
    name: entry.owner_name,
    email: entry.email,
    phone: entry.phone || null,
    user_id: userId,
    status: 'active',
    availability_schedule: {
      monday: { start: '09:00', end: '17:00' },
      tuesday: { start: '09:00', end: '17:00' },
      wednesday: { start: '09:00', end: '17:00' },
      thursday: { start: '09:00', end: '17:00' },
      friday: { start: '09:00', end: '17:00' },
      saturday: { start: '09:00', end: '17:00' },
    },
  }).select('id').single();
  const staffId = ownerStaff ? ownerStaff.id : null;
  if (staffId && locationId) {
    await supabase.from('staff_locations').insert({ staff_id: staffId, location_id: locationId });
  }

  // 6. Parse and create services from services_description.
  const serviceIds: string[] = [];
  if (entry.services_description) {
    const serviceStrings = entry.services_description.split(',').map((s: string) => s.trim()).filter(Boolean);
    for (const svcStr of serviceStrings) {
      const nameMatch = svcStr.match(/^([^(–-]+)/);
      const durationMatch = svcStr.match(/\((\d+)\s*min\)/);
      const priceMatch = svcStr.match(/[€$£](\d+(?:\.\d+)?)/);
      const name = nameMatch ? nameMatch[1].trim() : svcStr;
      const duration = durationMatch ? parseInt(durationMatch[1]) : 60;
      const price = priceMatch ? parseFloat(priceMatch[1]) : 0;
      const { data: svc } = await supabase.from('services').insert({
        tenant_id: tenantId, name, duration_minutes: duration, price, visibility: 'public',
      }).select('id').single();
      if (svc) serviceIds.push(svc.id);
    }
  }
  for (const svcId of serviceIds) {
    if (locationId) await supabase.from('service_locations').insert({ service_id: svcId, location_id: locationId });
    if (staffId) await supabase.from('service_staff').insert({ service_id: svcId, staff_id: staffId });
  }

  // 7. Link tenant to the property + mark application onboarded.
  await linkTenant(supabase, ctx.propertyId, tenantId);
  await supabase.from('waitlist').update({ status: 'onboarded', updated_at: new Date().toISOString() }).eq('id', id);

  // 8. Email login credentials (best-effort).
  const loginUrl = process.env.NEXTAUTH_URL ? `${process.env.NEXTAUTH_URL}/auth/login` : 'https://app.balkina.ai/auth/login';
  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendTenantLoginEmail({ email: entry.email, ownerName: entry.owner_name, businessName: entry.business_name, tempPassword, loginUrl });
    emailSent = true;
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    success: true,
    status: 'approved',
    tenant_id: tenantId,
    email_sent: emailSent,
    email_error: emailError,
    message: emailSent
      ? `${entry.business_name} approved and login email sent to ${entry.email}.`
      : `${entry.business_name} approved. Login email failed: ${emailError}.`,
  });
}

/**
 * DELETE /api/property/[slug]/applications/[id] — decline an application.
 */
export async function DELETE(request: Request, { params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  const ctx = await getPropertyAdmin(slug);
  if (!ctx) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  await (ctx.admin as Db)
    .from('waitlist')
    .update({ status: 'declined', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('property_id', ctx.propertyId);

  return NextResponse.json({ success: true });
}

async function linkTenant(supabase: Db, propertyId: string, tenantId: string) {
  const { data: existing } = await supabase
    .from('property_tenants')
    .select('id')
    .eq('property_id', propertyId)
    .eq('tenant_id', tenantId)
    .maybeSingle();
  if (!existing) {
    await supabase.from('property_tenants').insert({ property_id: propertyId, tenant_id: tenantId, featured: false });
  }
}
