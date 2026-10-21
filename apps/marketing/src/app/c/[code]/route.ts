import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * Short claim link: /c/<first 12 hex chars of the claim token>?c=wa
 * Redirects to the full /claim/<token> page, keeping the channel tag. Used in
 * outreach messages so the URL stays short in WhatsApp / Instagram.
 */
export async function GET(request: Request, { params }: { params: { code: string } }) {
  const url = new URL(request.url);
  const code = params.code.toLowerCase();
  const channel = url.searchParams.get('c');
  const suffix = channel ? `?c=${encodeURIComponent(channel)}` : '';

  if (/^[a-f0-9]{48}$/.test(code)) return NextResponse.redirect(new URL(`/claim/${code}${suffix}`, url.origin), 302);
  if (!/^[a-f0-9]{10,47}$/.test(code)) return NextResponse.redirect(new URL('/claim/invalid', url.origin), 302);

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }) },
  });
  const { data } = await supabase.from('growth_prospects').select('claim_token').ilike('claim_token', `${code}%`).limit(2);
  const token = data?.length === 1 ? (data[0]?.claim_token as string | null) : null;
  return NextResponse.redirect(new URL(token ? `/claim/${token}${suffix}` : '/claim/invalid', url.origin), 302);
}
