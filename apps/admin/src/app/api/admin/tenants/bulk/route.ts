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

const CITIES = [
  { name: 'San Francisco', lat: 37.7749, lng: -122.4194, tz: 'America/Los_Angeles' },
  { name: 'New York', lat: 40.7128, lng: -74.0060, tz: 'America/New_York' },
  { name: 'Chicago', lat: 41.8781, lng: -87.6298, tz: 'America/Chicago' },
  { name: 'Miami', lat: 25.7617, lng: -80.1918, tz: 'America/New_York' },
  { name: 'Austin', lat: 30.2672, lng: -97.7431, tz: 'America/Chicago' },
  { name: 'Seattle', lat: 47.6062, lng: -122.3321, tz: 'America/Los_Angeles' },
  { name: 'Denver', lat: 39.7392, lng: -104.9903, tz: 'America/Denver' },
  { name: 'London', lat: 51.5074, lng: -0.1278, tz: 'Europe/London' },
  { name: 'Dubai', lat: 25.2048, lng: 55.2708, tz: 'Asia/Dubai' },
  { name: 'Tokyo', lat: 35.6762, lng: 139.6503, tz: 'Asia/Tokyo' },
];

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
  const withLocations = body.with_locations !== false;
  const withStaff = body.with_staff !== false;
  const withServices = body.with_services !== false;

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

    // Create 1-3 locations
    if (withLocations) {
      const numLocations = Math.floor(Math.random() * 3) + 1;
      const cities = [...CITIES].sort(() => Math.random() - 0.5).slice(0, numLocations);

      for (const city of cities) {
        const { data: loc } = await auth.supabase
          .from('tenant_locations')
          .insert({
            tenant_id: tenantId,
            name: `${bizName} - ${city.name}`,
            address: `${Math.floor(100 + Math.random() * 9900)} Main St, ${city.name}`,
            latitude: city.lat + randomFloat(-0.02, 0.02),
            longitude: city.lng + randomFloat(-0.02, 0.02),
            timezone: city.tz,
            phone: `+1${Math.floor(2000000000 + Math.random() * 8000000000)}`,
          } as never)
          .select('id')
          .single();

        if (loc) {
          locationIds.push((loc as { id: string }).id);
          locCount++;
        }
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
