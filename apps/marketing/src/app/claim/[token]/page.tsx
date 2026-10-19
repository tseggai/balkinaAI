import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClaimPage as ClaimPageView } from '@/components/claim/claim-page';
import { cleanBusinessName, guessOwnerName, firstName } from '@/lib/claim/names';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Claim your booking page — Balkina AI',
  description: 'Your Balkina booking page is ready. Claim it in one minute and start taking bookings.',
  robots: { index: false, follow: false },
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
    // Next's Data Cache must never serve a pre-claim snapshot of the prospect.
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
}

interface ServiceRow { id: string; name: string; price: number; duration_minutes: number; hide_price: boolean | null }

async function loadClaim(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return { state: 'invalid' as const };
  const supabase = getSupabase();
  const { data: prospect } = await supabase
    .from('growth_prospects')
    .select('id, name, city, country, email, tenant_id, claimed_at, claim_expires_at, google_rating, google_review_count, enrichment')
    .eq('claim_token', token)
    .maybeSingle();
  if (!prospect || !prospect.tenant_id) return { state: 'invalid' as const };
  if (prospect.claimed_at) return { state: 'claimed' as const, name: prospect.name as string };
  if (prospect.claim_expires_at && new Date(prospect.claim_expires_at) < new Date()) return { state: 'expired' as const, name: prospect.name as string };

  const [{ data: tenant }, { data: services }, { data: location }] = await Promise.all([
    supabase.from('tenants').select('id, name, slug, status, currency, owner_name').eq('id', prospect.tenant_id).maybeSingle(),
    supabase.from('services').select('id, name, price, duration_minutes, hide_price').eq('tenant_id', prospect.tenant_id).order('name'),
    supabase.from('tenant_locations').select('address, city').eq('tenant_id', prospect.tenant_id).limit(1).maybeSingle(),
  ]);
  if (!tenant || tenant.status !== 'unclaimed') return { state: 'claimed' as const, name: prospect.name as string };

  const fullName = tenant.name as string;
  const enrichment = (prospect.enrichment ?? {}) as { owner_name?: string | null };
  const ownerName = guessOwnerName(fullName, enrichment.owner_name || (tenant.owner_name as string | null));
  return {
    state: 'ready' as const,
    token,
    fullName,
    displayName: cleanBusinessName(fullName),
    ownerName: ownerName ?? '',
    ownerFirstName: firstName(ownerName),
    slug: tenant.slug as string | null,
    currency: tenant.currency as string,
    email: (prospect.email as string | null) ?? '',
    address: (location?.address as string | null) ?? null,
    googleRating: prospect.google_rating != null ? Number(prospect.google_rating) : null,
    googleReviewCount: (prospect.google_review_count as number | null) ?? null,
    claimExpiresAt: (prospect.claim_expires_at as string | null) ?? null,
    supportWhatsApp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP || null,
    services: (services ?? []) as ServiceRow[],
  };
}

export default async function ClaimPage({ params }: { params: { token: string } }) {
  const claim = await loadClaim(params.token);

  if (claim.state === 'invalid') {
    return (
      <Shell title="This link isn't valid">
        <p className="text-gray-600">We couldn't find a booking page for this link. If you got it from us, reply to our email and we'll send a fresh one.</p>
        <Link href="/join" className="mt-6 inline-block text-brand-600 hover:underline">Or create your Balkina page from scratch →</Link>
      </Shell>
    );
  }
  if (claim.state === 'claimed') {
    return (
      <Shell title={`${claim.name} is already on Balkina`}>
        <p className="text-gray-600">This page has been claimed. If that was you, log in to manage your bookings.</p>
        <a href="https://app.balkina.ai/auth/login" className="mt-6 inline-block rounded-xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800">Log in</a>
      </Shell>
    );
  }
  if (claim.state === 'expired') {
    return (
      <Shell title="This claim link has expired">
        <p className="text-gray-600">The page we prepared for {claim.name} is still here. Reply to our email and we'll send a new link, or create your page now.</p>
        <Link href="/join" className="mt-6 inline-block text-brand-600 hover:underline">Create your Balkina page →</Link>
      </Shell>
    );
  }

  return <ClaimPageView data={claim} />;
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
      <div className="mt-4">{children}</div>
    </article>
  );
}
