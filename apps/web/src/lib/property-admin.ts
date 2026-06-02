import { createClient, createAdminClient } from '@/lib/supabase/server';

export interface PropertyAdminContext {
  propertyId: string;
  propertySlug: string;
  userId: string;
  role: string;
  /** RLS-scoped client (acts as the signed-in property admin). */
  supabase: ReturnType<typeof createClient>;
  /** Service-role client for privileged operations (auth user creation, etc.). */
  admin: ReturnType<typeof createAdminClient>;
}

/**
 * Verify the signed-in user is an admin of the property identified by `slug`.
 * Returns null when unauthenticated or not an admin of that property.
 */
export async function getPropertyAdmin(slug: string): Promise<PropertyAdminContext | null> {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: adminRow } = await supabase
    .from('property_admins')
    .select('property_id, role')
    .eq('user_id', user.id)
    .maybeSingle();
  if (!adminRow) return null;

  const admin = adminRow as { property_id: string; role: string };
  const { data: prop } = await supabase
    .from('properties')
    .select('id, slug')
    .eq('id', admin.property_id)
    .single();
  if (!prop || (prop as { slug: string }).slug !== slug) return null;

  return {
    propertyId: (prop as { id: string }).id,
    propertySlug: (prop as { slug: string }).slug,
    userId: user.id,
    role: admin.role,
    supabase,
    admin: createAdminClient(),
  };
}
