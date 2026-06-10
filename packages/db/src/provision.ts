/**
 * Shared tenant-default provisioning.
 *
 * Every onboarding path (admin waitlist setup, property applications, and
 * self-serve registration) must give a brand-new tenant the minimum it needs to
 * take bookings: an **owner staff record** (a real person, linked to the owner's
 * auth user, with a default working schedule) and a **default location**. This
 * was previously copy-pasted into the managed paths and missing entirely from
 * self-serve, so the three could drift. This helper is the single source of
 * truth and is idempotent — calling it twice for the same tenant is a no-op.
 *
 * It deliberately does NOT create services: the services a tenant offers are
 * path-specific (parsed from a waitlist description, or added later via the
 * onboarding wizard). Callers receive the staff/location ids so they can attach
 * their own services.
 */

export interface ProvisionOwner {
  /** auth.users id of the owner — linked onto the staff record. */
  userId: string;
  ownerName: string;
  email: string;
  phone?: string | null;
}

export interface ProvisionLocationInput {
  name?: string;
  address?: string | null;
  street_address?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  postal_code?: string | null;
}

export interface ProvisionResult {
  staffId: string | null;
  locationId: string | null;
  /** false when an owner-staff record already existed (idempotent skip). */
  created: boolean;
}

/** Default Mon–Sat 09:00–17:00 schedule for the owner staff record. */
const DEFAULT_SCHEDULE = {
  monday: { start: '09:00', end: '17:00' },
  tuesday: { start: '09:00', end: '17:00' },
  wednesday: { start: '09:00', end: '17:00' },
  thursday: { start: '09:00', end: '17:00' },
  friday: { start: '09:00', end: '17:00' },
  saturday: { start: '09:00', end: '17:00' },
};

/**
 * Provision the owner staff + default location for a freshly created tenant.
 * Must be called with a **service-role** Supabase client (RLS-bypassing),
 * server-side only.
 *
 * @param supabase  service-role Supabase client
 * @param tenantId  the tenant just created
 * @param owner     owner identity (linked onto the staff record)
 * @param location  optional address fields for the default location
 */
export async function provisionTenantDefaults(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tenantId: string,
  owner: ProvisionOwner,
  location?: ProvisionLocationInput | null,
): Promise<ProvisionResult> {
  // Idempotency: if this tenant already has an owner staff record, do nothing.
  const { data: existingStaff } = await supabase
    .from('staff')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('user_id', owner.userId)
    .limit(1)
    .maybeSingle();

  if (existingStaff) {
    const { data: existingLoc } = await supabase
      .from('tenant_locations')
      .select('id')
      .eq('tenant_id', tenantId)
      .limit(1)
      .maybeSingle();
    return {
      staffId: (existingStaff as { id: string }).id,
      locationId: existingLoc ? (existingLoc as { id: string }).id : null,
      created: false,
    };
  }

  // Default location — reuse an existing one if the tenant already has any.
  let locationId: string | null = null;
  const { data: anyLoc } = await supabase
    .from('tenant_locations')
    .select('id')
    .eq('tenant_id', tenantId)
    .limit(1)
    .maybeSingle();
  if (anyLoc) {
    locationId = (anyLoc as { id: string }).id;
  } else {
    const { data: loc } = await supabase
      .from('tenant_locations')
      .insert({
        tenant_id: tenantId,
        name: location?.name || 'Main Location',
        address: location?.address ?? null,
        street_address: location?.street_address ?? null,
        city: location?.city ?? null,
        state: location?.state ?? null,
        country: location?.country ?? null,
        postal_code: location?.postal_code ?? null,
      })
      .select('id')
      .single();
    if (loc) locationId = (loc as { id: string }).id;
  }

  // Owner staff record so bookings work immediately.
  const { data: ownerStaff } = await supabase
    .from('staff')
    .insert({
      tenant_id: tenantId,
      name: owner.ownerName,
      email: owner.email,
      phone: owner.phone ?? null,
      user_id: owner.userId,
      status: 'active',
      availability_schedule: DEFAULT_SCHEDULE,
    })
    .select('id')
    .single();
  const staffId = ownerStaff ? (ownerStaff as { id: string }).id : null;

  if (staffId && locationId) {
    await supabase
      .from('staff_locations')
      .insert({ staff_id: staffId, location_id: locationId });
  }

  return { staffId, locationId, created: true };
}
