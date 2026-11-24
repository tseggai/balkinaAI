/**
 * /places/<slug> — "Book anything in <place>" on the web (docs/PLACES.md). Lists the claimed
 * businesses located in a published place, each linking to its own booking page. The place is a
 * location, not a partner: the page uses Balkina's own look and says the businesses are independent.
 */
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import Link from 'next/link';
import PlaceBusinessCard, { type PlaceBusiness } from '@/components/places/PlaceBusinessCard';

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://app.balkina.ai';

interface PlaceData {
  place: { id: string; slug: string; name: string; tagline: string | null; photo_url: string | null };
  tenants: PlaceBusiness[];
  notice?: string;
}

async function getPlace(slug: string): Promise<PlaceData | null> {
  try {
    const res = await fetch(`${API_BASE}/api/places/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    return (await res.json()) as PlaceData;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await getPlace(slug);
  if (!data) return { title: 'Place not found' };
  const title = `Book anything in ${data.place.name} — Balkina AI`;
  const description = `${data.tenants.length} places to book in ${data.place.name}: restaurants, wellness, activities and more. Independent businesses, booked in seconds with Balkina AI.`;
  return { title, description, openGraph: { title, description, images: data.place.photo_url ? [{ url: data.place.photo_url }] : undefined } };
}

export default async function PlacePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const data = await getPlace(slug);
  if (!data) notFound();
  const { place, tenants } = data;

  // Group by top-level category, largest group first.
  const groups = new Map<string, PlaceBusiness[]>();
  for (const t of tenants) {
    const key = t.category?.trim() || 'More to book';
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const sections = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="relative overflow-hidden rounded-2xl bg-brand-500 px-6 py-10 text-center text-white">
        {place.photo_url ? (
          <>
            <img src={place.photo_url} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className="absolute inset-0 bg-black/45" />
          </>
        ) : null}
        <div className="relative">
          <p className="text-sm font-medium text-white/85">Book anything in</p>
          <h1 className="mt-1 text-3xl font-bold sm:text-4xl">{place.name}</h1>
          {place.tagline ? <p className="mx-auto mt-2 max-w-md text-sm text-white/90">{place.tagline}</p> : null}
        </div>
      </div>

      {sections.length === 0 ? (
        <p className="mt-10 text-center text-sm text-gray-400">Nothing to book here yet.</p>
      ) : sections.map(([title, list]) => (
        <section key={title} className="mt-8">
          <h2 className="text-lg font-semibold text-gray-900">
            {title}
            <span className="ml-2 text-sm font-normal text-gray-400">{list.length}</span>
          </h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {list.map((t) => <PlaceBusinessCard key={t.id} business={t} />)}
          </div>
        </section>
      ))}

      <div className="mb-8 mt-12 text-center text-xs text-gray-400">
        <p>{data.notice ?? 'Independent businesses. Not affiliated with the property owner.'}</p>
        <p className="mt-2">Powered by <Link href="/" className="text-brand-500 hover:underline">Balkina AI</Link></p>
      </div>
    </div>
  );
}
