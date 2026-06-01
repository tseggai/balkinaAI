import { createClient } from '@supabase/supabase-js';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';

function getSupabase() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
}

interface PropertyData {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  description: string | null;
  welcome_message: string;
  primary_color: string;
  website: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
}

interface TenantData {
  id: string;
  name: string;
  logo_url: string | null;
  avg_rating: number | null;
  review_count: number | null;
  description: string | null;
  slug: string | null;
  subcategory: string | null;
  featured: boolean;
}

async function getProperty(slug: string) {
  const supabase = getSupabase();

  const { data: property } = await supabase
    .from('properties')
    .select('*')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (!property) return null;
  const p = property as PropertyData;

  const { data: tenantLinks } = await supabase
    .from('property_tenants')
    .select('tenant_id, display_order, featured, tenants(id, name, logo_url, avg_rating, review_count, description, slug)')
    .eq('property_id', p.id)
    .order('display_order');

  const tenantIds = ((tenantLinks ?? []) as { tenant_id: string }[]).map((tl) => tl.tenant_id);

  const { data: subcatRows } = tenantIds.length > 0
    ? await supabase
        .from('tenant_category_links')
        .select('tenant_id, categories!inner(name, parent_id)')
        .in('tenant_id', tenantIds)
        .not('categories.parent_id', 'is', null)
    : { data: [] };

  const subcatMap = new Map<string, string>();
  for (const row of (subcatRows ?? []) as { tenant_id: string; categories: { name: string; parent_id: string } | { name: string; parent_id: string }[] }[]) {
    const cat = Array.isArray(row.categories) ? row.categories[0] : row.categories;
    if (cat?.name && !subcatMap.has(row.tenant_id)) subcatMap.set(row.tenant_id, cat.name);
  }

  const tenants: TenantData[] = ((tenantLinks ?? []) as unknown as {
    featured: boolean;
    tenants: { id: string; name: string; logo_url: string | null; avg_rating: number | null; review_count: number | null; description: string | null; slug: string | null } | null;
  }[])
    .filter((tl) => tl.tenants)
    .map((tl) => ({
      id: tl.tenants!.id, // eslint-disable-line
      name: tl.tenants!.name,
      logo_url: tl.tenants!.logo_url,
      avg_rating: tl.tenants!.avg_rating,
      review_count: tl.tenants!.review_count,
      description: tl.tenants!.description,
      slug: tl.tenants!.slug,
      subcategory: subcatMap.get(tl.tenants!.id) ?? null,
      featured: tl.featured,
    }));

  return { property: p, tenants };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getProperty(slug);
  if (!data) return { title: 'Property Not Found' };

  return {
    title: `${data.property.name} — Book on Balkina AI`,
    description: data.property.description ?? `Explore and book services at ${data.property.name}. Powered by Balkina AI.`,
    openGraph: {
      title: `${data.property.name} — Book on Balkina AI`,
      description: data.property.description ?? `Explore and book services at ${data.property.name}`,
      images: data.property.logo_url ? [{ url: data.property.logo_url }] : undefined,
    },
  };
}

function Stars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg key={star} className={`h-3.5 w-3.5 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`} fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </span>
  );
}

export default async function PropertyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getProperty(slug);

  if (!data) notFound();

  const { property, tenants } = data;
  const featured = tenants.filter((t) => t.featured);
  const regular = tenants.filter((t) => !t.featured);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center">
        {property.logo_url ? (
          <img src={property.logo_url} alt={property.name} width={120} height={120} className="mx-auto rounded-2xl object-cover" />
        ) : (
          <div className="mx-auto flex items-center justify-center rounded-2xl text-4xl font-bold text-white" style={{ width: 120, height: 120, backgroundColor: property.primary_color }}>
            {property.name.charAt(0)}
          </div>
        )}
        <h1 className="mt-5 text-3xl font-bold text-gray-900 sm:text-4xl">{property.name}</h1>
        {property.description && (
          <p className="mt-2 text-base text-gray-500">{property.description}</p>
        )}
        {property.address && (
          <p className="mt-1 text-sm text-gray-400">{[property.address, property.city, property.country].filter(Boolean).join(', ')}</p>
        )}
      </div>

      {/* Welcome */}
      <div className="mt-8 rounded-xl p-4 text-center" style={{ backgroundColor: property.primary_color + '10' }}>
        <p className="text-sm font-medium" style={{ color: property.primary_color }}>{property.welcome_message}</p>
      </div>

      {/* Featured */}
      {featured.length > 0 && (
        <div className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">Featured</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {featured.map((t) => (
              <TenantCard key={t.id} tenant={t} primaryColor={property.primary_color} />
            ))}
          </div>
        </div>
      )}

      {/* All businesses */}
      <div className="mt-8">
        <h2 className="text-lg font-semibold text-gray-900">
          {featured.length > 0 ? 'All Businesses' : 'Businesses'}
          <span className="ml-2 text-sm font-normal text-gray-400">{tenants.length}</span>
        </h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {(featured.length > 0 ? regular : tenants).map((t) => (
            <TenantCard key={t.id} tenant={t} primaryColor={property.primary_color} />
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-12 mb-8 text-center text-xs text-gray-400">
        Powered by <Link href="/" className="text-brand-500 hover:underline">Balkina AI</Link>
        {property.website && (
          <span> · <a href={property.website} className="hover:underline" target="_blank" rel="noopener">{property.name}</a></span>
        )}
      </div>
    </div>
  );
}

function TenantCard({ tenant, primaryColor }: { tenant: TenantData; primaryColor: string }) {
  const href = tenant.slug ? `/b/${tenant.slug}` : '#';
  return (
    <a href={href} className="block rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md">
      <div className="flex items-start gap-3">
        {tenant.logo_url ? (
          <img src={tenant.logo_url} alt={tenant.name} className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
        ) : (
          <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl text-xl font-bold text-white" style={{ backgroundColor: primaryColor }}>
            {tenant.name.charAt(0)}
          </div>
        )}
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-gray-900 truncate">{tenant.name}</h3>
          {tenant.subcategory && (
            <p className="text-xs font-medium mt-0.5" style={{ color: primaryColor }}>{tenant.subcategory}</p>
          )}
          {tenant.avg_rating && tenant.review_count ? (
            <div className="mt-1 flex items-center gap-1.5">
              <Stars rating={tenant.avg_rating} />
              <span className="text-xs text-gray-500">{tenant.avg_rating.toFixed(1)} ({tenant.review_count})</span>
            </div>
          ) : null}
          {tenant.description && (
            <p className="mt-1 text-xs text-gray-500 line-clamp-2">{tenant.description}</p>
          )}
        </div>
      </div>
    </a>
  );
}
