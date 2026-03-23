'use client';

import { useEffect, useState, useCallback } from 'react';

/* ─── Types ───────────────────────────────────────────────────────────────── */

interface Review {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  appointment_id: string;
  customers: { display_name: string | null } | null;
  staff: { name: string } | null;
  services: { services: { name: string } | null } | null;
}

interface StaffOption {
  id: string;
  name: string;
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */

function StarRating({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = size === 'lg' ? 'h-6 w-6' : size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sizeClass} ${star <= rating ? 'text-amber-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function RatingBar({ label, count, total }: { label: string; count: number; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 text-right text-sm font-medium text-gray-600">{label}</span>
      <div className="flex-1 overflow-hidden rounded-full bg-gray-100 h-2.5">
        <div className="h-full rounded-full bg-amber-400 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-sm text-gray-500">{count}</span>
    </div>
  );
}

/* ─── Component ───────────────────────────────────────────────────────────── */

export default function ReviewsPage() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [avgRating, setAvgRating] = useState<number | null>(null);
  const [reviewCount, setReviewCount] = useState(0);
  const [staffFilter, setStaffFilter] = useState('');
  const [ratingFilter, setRatingFilter] = useState('');
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const perPage = 20;

  // Fetch staff list for filter
  useEffect(() => {
    (async () => {
      const res = await fetch('/api/staff');
      const json = await res.json();
      const list = (json.data ?? []) as StaffOption[];
      setStaffOptions(list);
    })();
  }, []);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    setLoading(true);
    // First get tenant id
    const tenantRes = await fetch('/api/tenant');
    const tenantJson = await tenantRes.json();
    const tenantId = tenantJson.data?.id;
    if (!tenantId) {
      setLoading(false);
      return;
    }

    const params = new URLSearchParams();
    params.set('tenant_id', tenantId);
    params.set('page', String(page));
    params.set('per_page', String(perPage));
    if (staffFilter) params.set('staff_id', staffFilter);
    if (ratingFilter) params.set('min_rating', ratingFilter);

    const res = await fetch(`/api/reviews?${params}`);
    const json = await res.json();

    setReviews(json.data ?? []);
    setTotal(json.total ?? 0);
    setAvgRating(json.avg_rating ?? null);
    setReviewCount(json.review_count ?? 0);
    setLoading(false);
  }, [page, staffFilter, ratingFilter]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  /* ── Rating distribution (from current page data + totals) ─────────── */
  const ratingDist = [5, 4, 3, 2, 1].map((r) => ({
    label: `${r}`,
    count: reviews.filter((rev) => rev.rating === r).length,
  }));

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Reviews</h1>
        <p className="mt-1 text-sm text-gray-500">Customer feedback and ratings for your business.</p>
      </div>

      {loading && page === 1 ? (
        <div className="mt-8 flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-brand-600 border-t-transparent" />
        </div>
      ) : (
        <>
          {/* ── Overview Cards ─────────────────────────────────────────── */}
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Average Rating */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <p className="text-sm font-medium text-gray-500">Average Rating</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-4xl font-bold text-gray-900">
                  {avgRating !== null ? avgRating.toFixed(1) : '—'}
                </span>
                <span className="text-sm text-gray-400">/ 5</span>
              </div>
              {avgRating !== null && (
                <div className="mt-2">
                  <StarRating rating={Math.round(avgRating)} size="md" />
                </div>
              )}
            </div>

            {/* Total Reviews */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <p className="text-sm font-medium text-gray-500">Total Reviews</p>
              <p className="mt-3 text-4xl font-bold text-gray-900">{reviewCount}</p>
              <p className="mt-2 text-sm text-gray-400">All-time customer reviews</p>
            </div>

            {/* Rating Distribution */}
            <div className="rounded-xl border border-gray-200 bg-white p-6">
              <p className="mb-3 text-sm font-medium text-gray-500">Rating Distribution</p>
              <div className="space-y-2">
                {ratingDist.map((r) => (
                  <RatingBar key={r.label} label={r.label} count={r.count} total={reviews.length} />
                ))}
              </div>
            </div>
          </div>

          {/* ── Filters ───────────────────────────────────────────────── */}
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <select
              value={staffFilter}
              onChange={(e) => { setStaffFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Staff</option>
              {staffOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>

            <select
              value={ratingFilter}
              onChange={(e) => { setRatingFilter(e.target.value); setPage(1); }}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
            >
              <option value="">All Ratings</option>
              <option value="5">5 Stars</option>
              <option value="4">4+ Stars</option>
              <option value="3">3+ Stars</option>
              <option value="2">2+ Stars</option>
              <option value="1">1+ Stars</option>
            </select>

            {(staffFilter || ratingFilter) && (
              <button
                onClick={() => { setStaffFilter(''); setRatingFilter(''); setPage(1); }}
                className="text-sm font-medium text-brand-600 hover:text-brand-700"
              >
                Clear filters
              </button>
            )}
          </div>

          {/* ── Reviews List ──────────────────────────────────────────── */}
          <div className="mt-6 space-y-4">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="rounded-xl border border-gray-200 bg-white p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {/* Avatar placeholder */}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                        {(review.customers?.display_name ?? 'C').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">
                          {review.customers?.display_name ?? 'Customer'}
                        </p>
                        <p className="text-xs text-gray-400">
                          {new Date(review.created_at).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                    </div>
                    <StarRating rating={review.rating} size="sm" />
                  </div>

                  {review.comment && (
                    <p className="mt-3 text-sm text-gray-600 leading-relaxed">{review.comment}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    {review.staff?.name && (
                      <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                        {review.staff.name}
                      </span>
                    )}
                    {review.services?.services?.name && (
                      <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-medium text-purple-700">
                        {review.services.services.name}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-gray-200 bg-white px-6 py-16 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" />
                </svg>
                <p className="mt-3 text-sm font-medium text-gray-900">No reviews yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Reviews will appear here once customers leave feedback after their appointments.
                </p>
              </div>
            )}
          </div>

          {/* ── Pagination ────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Showing {(page - 1) * perPage + 1}–{Math.min(page * perPage, total)} of {total} reviews
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
