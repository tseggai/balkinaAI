import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';

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
    supabase.from('tenant_locations').select('name, address, currency').eq('tenant_id', t.id),
    supabase.from('tenant_category_links').select('category_id, categories(name)').eq('tenant_id', t.id),
    supabase.from('location_gallery').select('image_url').eq('tenant_id', t.id).order('sort_order').limit(6),
  ]);

  const categories = ((catLinks ?? []) as unknown as { category_id: string; categories: CategoryData | null }[])
    .map((cl) => cl.categories?.name)
    .filter(Boolean) as string[];

  return {
    tenant: t,
    services: (services ?? []) as ServiceData[],
    locations: (locations ?? []) as LocationData[],
    categories,
    currency: ((locations ?? [])[0] as LocationData | undefined)?.currency ?? 'USD',
    gallery: ((gallery ?? []) as { image_url: string }[]).map((g) => g.image_url),
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

const CURRENCY_SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£', CAD: 'CA$', AUD: 'A$', CHF: 'CHF', JPY: '¥', RSD: 'RSD' };

function formatPrice(price: number, pricingType: string | null, currency?: string) {
  const sym = CURRENCY_SYMBOLS[currency ?? 'USD'] ?? '$';
  const suffix = pricingType === 'per_day' ? '/day' : pricingType === 'per_week' ? '/week' : '';
  return `${sym}${price.toFixed(price % 1 === 0 ? 0 : 2)}${suffix}`;
}

function formatDuration(minutes: number, pricingType: string | null) {
  if (pricingType === 'per_day') return 'Full day';
  if (pricingType === 'per_week') return 'Full week';
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }
  return `${minutes} min`;
}

export default async function TenantPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getTenantBySlug(slug);

  if (!data) notFound();

  const { tenant, services, locations, categories, currency, gallery } = data;
  const deepLink = `balkina://?tenant=${tenant.id}`;
  const appStoreUrl = 'https://apps.apple.com/app/balkina-ai/id6742752682';

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

      {/* CTA */}
      <div className="mt-8">
        <a href={deepLink} className="block w-full rounded-xl bg-brand-500 py-4 text-center text-lg font-semibold text-white shadow-lg hover:bg-brand-700 transition-colors">
          Book with AI
        </a>
        <p className="mt-2 text-center text-xs text-gray-400">
          Opens the Balkina AI app. <a href={appStoreUrl} className="underline">Don&apos;t have it? Download here.</a>
        </p>
      </div>

      {/* Services */}
      {services.length > 0 && (
        <div className="mt-10">
          <h2 className="text-lg font-semibold text-gray-900">Services</h2>
          <div className="mt-3 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
            {services.map((svc) => (
              <div key={svc.id} className="flex items-center gap-3 px-4 py-3">
                {svc.image_url ? (
                  <img src={svc.image_url} alt={svc.name} className="h-12 w-12 flex-shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-gray-100 text-lg">✂️</div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{svc.name}</p>
                  <p className="text-xs text-gray-500">{formatDuration(svc.duration_minutes, svc.pricing_type)}</p>
                </div>
                <p className="text-sm font-semibold text-brand-600">{formatPrice(svc.price, svc.pricing_type, currency)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Locations */}
      {locations.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Locations</h2>
          <div className="mt-3 space-y-2">
            {locations.map((loc, i) => (
              <div key={i} className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-3">
                <svg className="mt-0.5 h-5 w-5 flex-shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 0115 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium text-gray-900">{loc.name}</p>
                  {loc.address && <p className="text-xs text-gray-500">{loc.address}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bottom CTA */}
      <div className="mt-10 mb-8">
        <a href={deepLink} className="block w-full rounded-xl border-2 border-brand-500 py-3 text-center text-base font-semibold text-brand-600 hover:bg-brand-50 transition-colors">
          Book with AI
        </a>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-gray-400">
        Powered by <Link href="/" className="text-brand-500 hover:underline">Balkina AI</Link>
      </div>
    </div>
  );
}
