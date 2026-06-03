import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase env vars not configured');
  return createClient(url, key);
}

export async function POST(request: Request) {
  try {
    const supabase = getSupabase();
    const body = await request.json();

    const { business_name, owner_name, email, phone, category, location, street, city, state, country, postal_code, staff_count, currency, services_description, property_invite } = body;

    if (!business_name || !owner_name || !email) {
      return Response.json({ error: 'Business name, owner name, and email are required.' }, { status: 400 });
    }

    // If this signup came through a property invite link, resolve the code so the
    // resulting waitlist entry is tagged to the property for owner approval.
    let propertyId: string | null = null;
    let propertyInviteId: string | null = null;
    if (property_invite) {
      const { data: invite } = await supabase
        .from('property_invites')
        .select('id, property_id, status, expires_at')
        .eq('invite_code', property_invite)
        .maybeSingle();
      if (invite && invite.status === 'pending' && new Date(invite.expires_at) > new Date()) {
        propertyId = invite.property_id;
        propertyInviteId = invite.id;
      }
    }

    const { error } = await supabase.from('waitlist').insert({
      business_name,
      owner_name,
      email,
      phone: phone || null,
      category: category || null,
      location: location || null,
      street: street || null,
      city: city || null,
      state: state || null,
      country: country || null,
      postal_code: postal_code || null,
      staff_count: staff_count || 1,
      currency: currency || 'EUR',
      services_description: services_description || null,
      property_id: propertyId,
      property_invite_id: propertyInviteId,
    });

    if (error) {
      console.error('[waitlist] Insert error:', error.message);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    // Mark the invite as accepted so the property owner sees it move from
    // "Invited" to "Pending approval".
    if (propertyInviteId) {
      await supabase.from('property_invites').update({ status: 'accepted' }).eq('id', propertyInviteId);
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
