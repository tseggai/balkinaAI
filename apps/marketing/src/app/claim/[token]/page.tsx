import { createClient } from '@supabase/supabase-js';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ClaimForm } from '@/components/claim/claim-form';
import { ClaimDemo } from '@/components/claim/claim-demo';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Claim your booking page — Balkina AI',
  description: 'Your Balkina booking page is ready. Claim it in one minute and start taking bookings.',
  robots: { index: false, follow: false },
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

interface ServiceRow { id: string; name: string; price: number; duration_minutes: number; hide_price: boolean | null }

async function loadClaim(token: string) {
  if (!/^[a-f0-9]{48}$/.test(token)) return { state: 'invalid' as const };
  const supabase = getSupabase();
  const { data: prospect } = await supabase
    .from('growth_prospects')
    .select('id, name, city, country, email, tenant_id, claimed_at, claim_expires_at')
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

  return {
    state: 'ready' as const,
    token,
    name: tenant.name as string,
    slug: tenant.slug as string | null,
    currency: tenant.currency as string,
    ownerName: (tenant.owner_name as string) || '',
    email: (prospect.email as string | null) ?? '',
    address: (location?.address as string | null) ?? null,
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

  return (
    <div className="mx-auto max-w-5xl px-6 py-12 md:py-20">
      <div className="grid gap-10 md:grid-cols-5">
        <div className="md:col-span-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600">Your page is ready</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-gray-900 md:text-4xl">{claim.name}</h1>
          {claim.address && <p className="mt-1 text-sm text-gray-500">{claim.address}</p>}
          <p className="mt-4 text-gray-600 leading-relaxed">
            We built a booking page for your business from public information. Claim it, check the services and hours, and share your link. Customers can book you day or night, and Balkina's AI receptionist confirms every appointment.
          </p>

          <div className="mt-6">
            <ClaimDemo businessName={claim.name} ownerName={claim.ownerName} currency={claim.currency} services={claim.services} />
          </div>

          <ul className="mt-6 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
            <li>✓ Free to start, no card needed</li>
            <li>✓ Your own booking link for Instagram and Google</li>
            <li>✓ AI receptionist answers 24/7</li>
            <li>✓ Reminders that cut no-shows</li>
          </ul>
        </div>

        <div id="claim-form" className="scroll-mt-24 md:col-span-2">
          <ClaimForm token={claim.token} businessName={claim.name} defaultOwnerName={claim.ownerName} defaultEmail={claim.email} />
          <p className="mt-4 text-xs text-gray-400">
            Not your business, or don't want this page? Reply to our email and we'll remove it. Unclaimed pages are never shown to customers.
          </p>
        </div>
      </div>
    </div>
  );
}

function Shell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-2xl px-6 py-16 md:py-24">
      <h1 className="text-3xl font-bold tracking-tight text-gray-900">{title}</h1>
      <div className="mt-4">{children}</div>
    </article>
  );
}
