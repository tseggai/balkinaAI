import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { sendTenantLoginEmail } from '@balkina/notifications';
import { provisionTenantDefaults } from '@balkina/db';

/**
 * POST /api/admin/waitlist/setup
 * One-click tenant setup from a waitlist entry.
 * Creates: auth user → tenant → location → services
 * Then updates the waitlist entry status to 'onboarded' and emails the
 * tenant their branded login credentials directly from Balkina AI.
 */
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const { waitlist_id } = body;

  if (!waitlist_id) {
    return NextResponse.json({ error: 'waitlist_id is required' }, { status: 400 });
  }

  const supabase = auth.supabase;

  // 1. Fetch the waitlist entry
  const { data: entry, error: fetchErr } = await supabase
    .from('waitlist')
    .select('*')
    .eq('id', waitlist_id)
    .single();

  if (fetchErr || !entry) {
    return NextResponse.json({ error: 'Waitlist entry not found' }, { status: 404 });
  }

  if (entry.status === 'onboarded') {
    return NextResponse.json({ error: 'This entry has already been onboarded' }, { status: 400 });
  }

  // 2. Create auth user with a fresh temp password — we'll email it to them.
  const tempPassword = generateTempPassword();
  const { data: authUser, error: authErr } = await supabase.auth.admin.createUser({
    email: entry.email,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { full_name: entry.owner_name },
  });

  if (authErr) {
    // If user already exists, try to find them
    if (authErr.message?.includes('already been registered') || authErr.message?.includes('already exists')) {
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existing = users?.find((u: { email?: string }) => u.email === entry.email);
      if (existing) {
        // Check if they already have a tenant
        const { data: existingTenant } = await supabase
          .from('tenants')
          .select('id')
          .eq('user_id', existing.id)
          .single();
        if (existingTenant) {
          return NextResponse.json({ error: `User ${entry.email} already has a tenant. Update their waitlist status manually.` }, { status: 400 });
        }
        // Reset their password to a fresh temp password so the login email is valid.
        await supabase.auth.admin.updateUserById(existing.id, { password: tempPassword });
        return await createTenantFromWaitlist(supabase, entry, existing.id, waitlist_id, tempPassword);
      }
    }
    return NextResponse.json({ error: `Failed to create user: ${authErr.message}` }, { status: 500 });
  }

  return await createTenantFromWaitlist(supabase, entry, authUser.user.id, waitlist_id, tempPassword);
}

/**
 * Generate a 14-character temp password with mixed case, digits, and one symbol.
 * Avoids ambiguous characters so tenants can easily type it from the email.
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function createTenantFromWaitlist(supabase: any, entry: any, userId: string, waitlistId: string, tempPassword: string) {
  // 3. Find category by name (optional)
  let categoryId: string | null = null;
  if (entry.category) {
    const { data: cat } = await supabase
      .from('categories')
      .select('id')
      .ilike('name', `%${entry.category}%`)
      .limit(1)
      .single();
    if (cat) categoryId = cat.id;
  }

  // 4. Create tenant
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

  if (tenantErr) {
    return NextResponse.json({ error: `Failed to create tenant: ${tenantErr.message}` }, { status: 500 });
  }

  const tenantId = tenant.id;

  // 5. Provision the owner staff + default location (shared, idempotent helper).
  const { staffId, locationId } = await provisionTenantDefaults(
    supabase,
    tenantId,
    { userId, ownerName: entry.owner_name, email: entry.email, phone: entry.phone || null },
    entry.location
      ? {
          address: entry.location,
          street_address: entry.street || null,
          city: entry.city || null,
          state: entry.state || null,
          country: entry.country || null,
          postal_code: entry.postal_code || null,
        }
      : null,
  );

  // 6. Parse and create services (from services_description)
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
        tenant_id: tenantId,
        name,
        duration_minutes: duration,
        price,
        visibility: 'public',
      }).select('id').single();
      if (svc) serviceIds.push((svc as { id: string }).id);
    }
  }

  // Assign all services to location and staff
  for (const svcId of serviceIds) {
    if (locationId) {
      await supabase.from('service_locations').insert({ service_id: svcId, location_id: locationId } as never);
    }
    if (staffId) {
      await supabase.from('service_staff').insert({ service_id: svcId, staff_id: staffId } as never);
    }
  }

  // 7. Update waitlist status
  await supabase
    .from('waitlist')
    .update({ status: 'onboarded', updated_at: new Date().toISOString() })
    .eq('id', waitlistId);

  // 8. Email the tenant their branded login credentials. We never block tenant
  //    creation on email failure — surface it in the response instead so the
  //    admin can retry via the "Send Login" button.
  const loginUrl = process.env.NEXTAUTH_URL
    ? `${process.env.NEXTAUTH_URL}/auth/login`
    : 'https://app.balkina.ai/auth/login';
  let emailSent = false;
  let emailError: string | null = null;
  try {
    await sendTenantLoginEmail({
      email: entry.email,
      ownerName: entry.owner_name,
      businessName: entry.business_name,
      tempPassword,
      loginUrl,
    });
    emailSent = true;
  } catch (err) {
    emailError = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    success: true,
    tenant_id: tenantId,
    user_id: userId,
    email_sent: emailSent,
    email_error: emailError,
    message: emailSent
      ? `Tenant "${entry.business_name}" created and login email sent to ${entry.email}.`
      : `Tenant "${entry.business_name}" created. Email failed: ${emailError}. Use "Send Login" to retry.`,
  });
}
