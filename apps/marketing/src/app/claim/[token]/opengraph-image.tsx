import { ImageResponse } from 'next/og';
import { createClient } from '@supabase/supabase-js';
import { cleanBusinessName } from '@/lib/claim/names';

export const runtime = 'edge';
export const alt = 'Your Balkina booking page is ready';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

/**
 * Link preview for claim links shared on WhatsApp / Instagram: the business
 * name on a clean brand card, instead of the site's generic logo image.
 */
export default async function Image({ params }: { params: { token: string } }) {
  let name = 'Your business';
  if (/^[a-f0-9]{48}$/.test(params.token)) {
    try {
      const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data } = await supabase.from('growth_prospects').select('name').eq('claim_token', params.token).maybeSingle();
      if (data?.name) name = cleanBusinessName(data.name as string);
    } catch {
      /* fall back to the generic card */
    }
  }
  const nameSize = name.length > 28 ? 56 : name.length > 18 ? 68 : 80;

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '72px 80px',
          background: 'linear-gradient(135deg, #eef2ff 0%, #ffffff 60%)',
          fontFamily: 'Helvetica, Arial, sans-serif',
          color: '#111827',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div style={{ width: 44, height: 44, borderRadius: 22, background: '#6B7FC4' }} />
          <div style={{ fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>balkina</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div style={{ fontSize: 26, fontWeight: 600, color: '#6B7FC4', textTransform: 'uppercase', letterSpacing: 3 }}>Your booking page is ready</div>
          <div style={{ fontSize: nameSize, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2 }}>{name}</div>
          <div style={{ fontSize: 32, color: '#4b5563', marginTop: 8 }}>Bookable instantly, 24/7 · Test it, love it, activate it for free</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 26, color: '#6b7280' }}>
          <div>balkina.ai</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, background: '#6B7FC4', color: '#fff', borderRadius: 999, padding: '14px 32px', fontWeight: 600 }}>Activate — free</div>
        </div>
      </div>
    ),
    size,
  );
}
