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

    const { business_name, owner_name, email, phone, category, location, staff_count, services_description } = body;

    if (!business_name || !owner_name || !email) {
      return Response.json({ error: 'Business name, owner name, and email are required.' }, { status: 400 });
    }

    const { error } = await supabase.from('waitlist').insert({
      business_name,
      owner_name,
      email,
      phone: phone || null,
      category: category || null,
      location: location || null,
      staff_count: staff_count || 1,
      services_description: services_description || null,
    });

    if (error) {
      console.error('[waitlist] Insert error:', error.message);
      return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
    }

    return Response.json({ success: true });
  } catch {
    return Response.json({ error: 'Invalid request.' }, { status: 400 });
  }
}
