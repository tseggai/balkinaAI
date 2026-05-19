import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import BookingFlow from '@/components/booking/BookingFlow';

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key);
}

interface TenantData {
  id: string;
  name: string;
  logo_url: string | null;
  avg_rating: number | null;
  review_count: number | null;
  owner_name: string | null;
  phone: string | null;
}

interface ServiceData {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  image_url: string | null;
  pricing_type: string | null;
}

interface LocationData {
  id: string;
  name: string;
  address: string | null;
  currency?: string;
}

interface CategoryData {
  name: string;
}

async function getTenantBySlug(slug: string) {
  const supabase = getSupabase();

  const { data: tenant } = await supabase
    .from('tenants')
    .select('id, name, logo_url, avg_rating, review_count, owner_name, phone')
    .eq('slug', slug)
    .eq('status', 'active')
    .single();

  if (!tenant) return null;

  const t = tenant as TenantData;

  const [{ data: services }, { data: locations }, { data: catLinks }, { data: gallery }] = await Promise.all([
    supabase.from('services').select('id, name, price, duration_minutes, image_url, pricing_type').eq('tenant_id', t.id).eq('visibility', 'public').order('name'),
    supabase.from('tenant_locations').select('id, name, address, currency').eq('tenant_id', t.id),
    supabase.from('tenant_category_links').select('category_id, categories(name)').eq('tenant_id', t.id),
    supabase.from('location_gallery').select('image_url').eq('tenant_id', t.id).order('sort_order').limit(6),
  ]);

  const serviceIds = ((services ?? []) as { id: string }[]).map(s => s.id);
  const { data: svcLocs } = serviceIds.length > 0
    ? await supabase.from('service_locations').select('service_id, location_id').in('service_id', serviceIds)
    : { data: [] };

  const categories = ((catLinks ?? []) as unknown as { category_id: string; categories: CategoryData | null }[])
    .map((cl) => cl.categories?.name)
    .filter(Boolean) as string[];

  const serviceLocationMap: Record<string, string[]> = {};
  for (const sl of (svcLocs ?? []) as { service_id: string; location_id: string }[]) {
    const arr = serviceLocationMap[sl.service_id] ?? [];
    arr.push(sl.location_id);
    serviceLocationMap[sl.service_id] = arr;
  }

  return {
    tenant: t,
    services: (services ?? []) as ServiceData[],
    locations: (locations ?? []) as LocationData[],
    categories,
    currency: ((locations ?? [])[0] as LocationData | undefined)?.currency ?? 'USD',
    gallery: ((gallery ?? []) as { image_url: string }[]).map((g) => g.image_url),
    serviceLocationMap,
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getTenantBySlug(slug);
  if (!data) return { title: 'Business Not Found' };

  return {
    title: `${data.tenant.name} — Book on Balkina AI`,
    description: `Book appointments with ${data.tenant.name}. ${data.services.length} services available. Powered by Balkina AI.`,
    openGraph: {
      title: `${data.tenant.name} — Book on Balkina AI`,
      description: `Book appointments with ${data.tenant.name}`,
      images: data.tenant.logo_url ? [{ url: data.tenant.logo_url }] : undefined,
    },
  };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`h-4 w-4 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getTenantBySlug(slug);

  if (!data) notFound();

  const { tenant, services, locations, categories, currency, gallery, serviceLocationMap } = data;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center">
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.name} width={88} height={88} className="mx-auto rounded-2xl object-cover" />
        ) : (
          <div className="mx-auto flex h-22 w-22 items-center justify-center rounded-2xl bg-brand-500 text-3xl font-bold text-white" style={{ width: 88, height: 88 }}>
            {tenant.name.charAt(0)}
          </div>
        )}
        <h1 className="mt-4 text-2xl font-bold text-gray-900 sm:text-3xl">{tenant.name}</h1>
        {categories.length > 0 && (
          <p className="mt-1 text-sm text-gray-500">{categories.join(' · ')}</p>
        )}
        {tenant.avg_rating && tenant.review_count ? (
          <div className="mt-2 flex items-center justify-center gap-2">
            <Stars rating={tenant.avg_rating} />
            <span className="text-sm text-gray-600">{tenant.avg_rating.toFixed(1)} ({tenant.review_count} reviews)</span>
          </div>
        ) : null}
      </div>

      {/* Gallery */}
      {gallery.length > 0 && (
        <div className="mt-6 flex gap-2 overflow-x-auto rounded-xl pb-2">
          {gallery.map((url, i) => (
            <img key={i} src={url} alt="" className="h-32 w-40 flex-shrink-0 rounded-lg object-cover sm:h-40 sm:w-48" />
          ))}
        </div>
      )}

      {/* Booking Flow */}
      {services.length > 0 ? (
        <BookingFlow
          tenantId={tenant.id}
          tenantName={tenant.name}
          services={services}
          locations={locations}
          currency={currency}
          serviceLocationMap={serviceLocationMap}
        />
      ) : (
        <p className="mt-8 text-center text-sm text-gray-400">No services available at this time.</p>
      )}

      {/* Footer */}
      <div className="mt-10 mb-8 text-center text-xs text-gray-400">
        Powered by <Link href="/" className="text-brand-500 hover:underline">Balkina AI</Link>
      </div>
    </div>
  );
}
