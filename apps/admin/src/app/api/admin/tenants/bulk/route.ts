import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';

// Sample business data for generating realistic test tenants
const BUSINESS_TYPES = [
  { names: ['Elite Cuts', 'Sharp Edge Barbers', 'The Gentleman\'s Den', 'Crown Barbershop', 'Fade Factory'], category: 'barbershop' },
  { names: ['Glow Beauty Studio', 'Serenity Spa & Salon', 'Luxe Hair Lounge', 'Bella Nails & Spa', 'Radiance Beauty Bar'], category: 'beauty' },
  { names: ['Zen Wellness Center', 'Pure Massage Therapy', 'Harmony Day Spa', 'Bliss Body Works', 'Tranquil Touch'], category: 'wellness' },
  { names: ['FitPro Personal Training', 'Iron Body Gym', 'Peak Performance Studio', 'Core Strength Fitness', 'Agile Athletics'], category: 'fitness' },
  { names: ['Dr. Smith Dental', 'Bright Smile Clinic', 'ClearView Optometry', 'Premier Dermatology', 'HealthFirst Medical'], category: 'medical' },
];

const FIRST_NAMES = ['James', 'Maria', 'David', 'Sarah', 'Michael', 'Emma', 'Robert', 'Lisa', 'Carlos', 'Fatima', 'Ahmed', 'Yuki', 'Olga', 'Chen', 'Priya'];
const LAST_NAMES = ['Johnson', 'Garcia', 'Williams', 'Martinez', 'Brown', 'Lee', 'Wilson', 'Anderson', 'Taylor', 'Thomas', 'Moore', 'Jackson', 'White', 'Harris', 'Clark'];

// Fallback cities used when no custom locations are provided
const DEFAULT_CITIES: LocationInput[] = [
  { name: 'San Francisco', state: 'CA', country: 'United States', lat: 37.7749, lng: -122.4194, tz: 'America/Los_Angeles' },
  { name: 'New York', state: 'NY', country: 'United States', lat: 40.7128, lng: -74.0060, tz: 'America/New_York' },
  { name: 'Chicago', state: 'IL', country: 'United States', lat: 41.8781, lng: -87.6298, tz: 'America/Chicago' },
  { name: 'Miami', state: 'FL', country: 'United States', lat: 25.7617, lng: -80.1918, tz: 'America/New_York' },
  { name: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
];

interface LocationInput {
  name: string;
  lat: number;
  lng: number;
  tz: string;
  address?: string;
  state?: string;
  country?: string;
}

// Geocode a city name to get lat/lng/timezone using Google Maps API
async function geocodeCity(city: string, country?: string): Promise<{ lat: number; lng: number; tz: string } | null> {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  try {
    const query = country ? `${city}, ${country}` : city;
    const geoRes = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query)}&key=${apiKey}`
    );
    const geoJson = await geoRes.json() as { status: string; results?: { geometry?: { location?: { lat: number; lng: number } } }[] };
    if (geoJson.status !== 'OK' || !geoJson.results?.[0]?.geometry?.location) return null;

    const { lat, lng } = geoJson.results[0].geometry.location;

    const tzRes = await fetch(
      `https://maps.googleapis.com/maps/api/timezone/json?location=${lat},${lng}&timestamp=${Math.floor(Date.now() / 1000)}&key=${apiKey}`
    );
    const tzJson = await tzRes.json() as { status: string; timeZoneId?: string };
    const tz = tzJson.status === 'OK' && tzJson.timeZoneId ? tzJson.timeZoneId : 'UTC';

    return { lat, lng, tz };
  } catch {
    return null;
  }
}

const STAFF_NAMES = [
  'Alex Rivera', 'Jordan Smith', 'Taylor Kim', 'Morgan Lee', 'Casey Brown',
  'Riley Johnson', 'Avery Davis', 'Quinn Wilson', 'Reese Martinez', 'Dakota Thomas',
];

const SERVICE_TEMPLATES: Record<string, { name: string; price: number; duration: number }[]> = {
  barbershop: [
    { name: 'Haircut', price: 35, duration: 30 },
    { name: 'Beard Trim', price: 20, duration: 15 },
    { name: 'Hot Towel Shave', price: 40, duration: 30 },
    { name: 'Hair & Beard Combo', price: 50, duration: 45 },
  ],
  beauty: [
    { name: 'Manicure', price: 35, duration: 30 },
    { name: 'Pedicure', price: 45, duration: 45 },
    { name: 'Facial', price: 75, duration: 60 },
    { name: 'Hair Coloring', price: 120, duration: 90 },
  ],
  wellness: [
    { name: 'Swedish Massage', price: 90, duration: 60 },
    { name: 'Deep Tissue Massage', price: 110, duration: 60 },
    { name: 'Aromatherapy', price: 80, duration: 45 },
    { name: 'Hot Stone Therapy', price: 120, duration: 75 },
  ],
  fitness: [
    { name: 'Personal Training', price: 70, duration: 60 },
    { name: 'Group Class', price: 25, duration: 45 },
    { name: 'Yoga Session', price: 30, duration: 60 },
    { name: 'HIIT Workout', price: 35, duration: 30 },
  ],
  medical: [
    { name: 'Consultation', price: 150, duration: 30 },
    { name: 'Check-up', price: 200, duration: 45 },
    { name: 'Follow-up', price: 100, duration: 20 },
    { name: 'Treatment Session', price: 250, duration: 60 },
  ],
};

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)] as T;
}

function randomFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;

  const body = await request.json();
  const count = Math.min(50, Math.max(1, parseInt(body.count ?? '10', 10)));
  const withStaff = body.with_staff !== false;
  const withServices = body.with_services !== false;

  // Custom locations: array of { name, country? } (simplified) or { name, lat, lng, tz } (full)
  // If provided, ALL tenants get exactly these locations
  // If not provided, each tenant gets 1-3 random cities from defaults
  let customLocations: LocationInput[] | null = null;
  if (Array.isArray(body.locations) && body.locations.length > 0) {
    // Resolve any locations missing lat/lng/tz via geocoding
    const resolved: LocationInput[] = [];
    for (const loc of body.locations as { name: string; country?: string; state?: string; lat?: number; lng?: number; tz?: string; address?: string }[]) {
      if (!loc.name) continue;
      if (loc.lat && loc.lng && loc.tz) {
        resolved.push(loc as LocationInput);
      } else {
        // Geocode from city + country
        const geo = await geocodeCity(loc.name, loc.country);
        resolved.push({
          name: loc.name,
          lat: geo?.lat ?? 0,
          lng: geo?.lng ?? 0,
          tz: geo?.tz ?? 'UTC',
          country: loc.country,
          state: loc.state,
          address: loc.address,
        });
      }
    }
    if (resolved.length > 0) customLocations = resolved;
  }

  // Fetch categories for matching
  const { data: categories } = await auth.supabase
    .from('categories')
    .select('id, name');
  const categoryMap = new Map(
    ((categories ?? []) as { id: string; name: string }[]).map(c => [c.name.toLowerCase(), c.id])
  );

  // Fetch a default plan
  const { data: defaultPlan } = await auth.supabase
    .from('subscription_plans')
    .select('id')
    .order('price_monthly', { ascending: true })
    .limit(1)
    .single();

  const results: { tenant_id: string; name: string; locations: number; staff: number; services: number }[] = [];

  for (let i = 0; i < count; i++) {
    const bizType = randomItem(BUSINESS_TYPES);
    const bizName = randomItem(bizType.names) + ` #${Date.now().toString(36).slice(-4)}`;
    const firstName = randomItem(FIRST_NAMES);
    const lastName = randomItem(LAST_NAMES);
    const ownerName = `${firstName} ${lastName}`;
    const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}+${Date.now().toString(36).slice(-3)}@test.balkina.ai`;

    const categoryId = categoryMap.get(bizType.category) ?? null;

    // Create tenant
    const { data: tenant, error: tenantError } = await auth.supabase
      .from('tenants')
      .insert({
        name: bizName,
        owner_name: ownerName,
        email,
        phone: `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`,
        category_id: categoryId,
        subscription_plan_id: defaultPlan?.id ?? null,
        status: 'active',
        payments_enabled: Math.random() > 0.5,
      } as never)
      .select('id')
      .single();

    if (tenantError || !tenant) continue;

    const tenantId = (tenant as { id: string }).id;
    let locCount = 0;
    let staffCount = 0;
    let svcCount = 0;
    const locationIds: string[] = [];
    const staffIds: string[] = [];

    // Create locations
    const citiesToUse = customLocations
      ? customLocations
      : [...DEFAULT_CITIES].sort(() => Math.random() - 0.5).slice(0, Math.floor(Math.random() * 3) + 1);

    for (const cityData of citiesToUse) {
      const streetNum = Math.floor(100 + Math.random() * 9900);
      const streetName = `${streetNum} Main St`;
      const addressParts = [streetName, cityData.name, cityData.state, cityData.country].filter(Boolean);
      const fullAddress = cityData.address ?? addressParts.join(', ');
      const { data: loc } = await auth.supabase
        .from('tenant_locations')
        .insert({
          tenant_id: tenantId,
          name: `${bizName} - ${cityData.name}`,
          address: fullAddress,
          street_address: cityData.address ? null : streetName,
          city: cityData.name,
          state: cityData.state ?? null,
          country: cityData.country ?? null,
          latitude: cityData.lat + randomFloat(-0.005, 0.005),
          longitude: cityData.lng + randomFloat(-0.005, 0.005),
          timezone: cityData.tz,
          phone: `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`,
        } as never)
        .select('id')
        .single();

      if (loc) {
        locationIds.push((loc as { id: string }).id);
        locCount++;
      }
    }

    // Create 2-5 staff
    if (withStaff) {
      const numStaff = Math.floor(Math.random() * 4) + 2;
      const names = [...STAFF_NAMES].sort(() => Math.random() - 0.5).slice(0, numStaff);

      for (const staffName of names) {
        const { data: s } = await auth.supabase
          .from('staff')
          .insert({
            tenant_id: tenantId,
            name: staffName,
            email: `${staffName.toLowerCase().replace(' ', '.')}+${Date.now().toString(36).slice(-3)}@test.balkina.ai`,
            status: 'active',
          } as never)
          .select('id')
          .single();

        if (s) {
          const sId = (s as { id: string }).id;
          staffIds.push(sId);
          staffCount++;

          // Assign to random location(s)
          if (locationIds.length > 0) {
            const assignedLoc = randomItem(locationIds);
            await auth.supabase
              .from('staff_locations')
              .insert({ staff_id: sId, location_id: assignedLoc } as never);
          }
        }
      }
    }

    // Create services
    if (withServices) {
      const templates = SERVICE_TEMPLATES[bizType.category] ?? [];
      for (const tmpl of templates) {
        const { data: svc } = await auth.supabase
          .from('services')
          .insert({
            tenant_id: tenantId,
            name: tmpl.name,
            price: tmpl.price,
            duration_minutes: tmpl.duration,
            visibility: 'public',
          } as never)
          .select('id')
          .single();

        if (svc) {
          const svcId = (svc as { id: string }).id;
          svcCount++;

          // Assign all staff to this service
          for (const sid of staffIds) {
            await auth.supabase
              .from('service_staff')
              .insert({ service_id: svcId, staff_id: sid } as never);
          }

          // Assign to all locations
          for (const lid of locationIds) {
            await auth.supabase
              .from('service_locations')
              .insert({ service_id: svcId, location_id: lid } as never);
          }
        }
      }
    }

    results.push({ tenant_id: tenantId, name: bizName, locations: locCount, staff: staffCount, services: svcCount });
  }

  return NextResponse.json({
    created: results.length,
    tenants: results,
  }, { status: 201 });
}
