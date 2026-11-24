export interface PlaceBusiness {
  id: string;
  name: string;
  slug: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  description: string | null;
  avg_rating: number | null;
  review_count: number | null;
  category: string | null;
  subcategory: string | null;
}

/** One business of a place; opens its own booking page. */
export default function PlaceBusinessCard({ business }: { business: PlaceBusiness }) {
  const image = business.logo_url ?? business.cover_image_url;
  const body = (
    <div className="flex items-start gap-3">
      {image ? (
        <img src={image} alt={business.name} className="h-14 w-14 flex-shrink-0 rounded-xl object-cover" />
      ) : (
        <div className="flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl bg-brand-500 text-xl font-bold text-white">
          {business.name.charAt(0)}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-gray-900">{business.name}</h3>
        {business.subcategory ? <p className="mt-0.5 text-xs font-medium text-brand-600">{business.subcategory}</p> : null}
        {business.avg_rating && business.review_count ? (
          <p className="mt-1 text-xs text-gray-500">★ {business.avg_rating.toFixed(1)} ({business.review_count})</p>
        ) : null}
        {business.description ? <p className="mt-1 line-clamp-2 text-xs text-gray-500">{business.description}</p> : null}
      </div>
      {business.slug ? <span className="self-center text-sm font-semibold text-brand-600">Book</span> : null}
    </div>
  );
  const className = 'block rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md';
  return business.slug ? <a href={`/b/${business.slug}`} className={className}>{body}</a> : <div className={className}>{body}</div>;
}
