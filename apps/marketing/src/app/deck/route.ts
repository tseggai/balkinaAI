import { createClient } from '@supabase/supabase-js';
import { buildDeckHtml, type SlideRow } from '@/lib/deck';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const { data, error } = await supabase
      .from('deck_slides')
      .select('id, deck, position, template, content')
      .eq('deck', 'whitelabel')
      .order('position', { ascending: true });
    if (error) throw error;
    const html = buildDeckHtml('whitelabel', (data ?? []) as SlideRow[]);
    return new Response(html, {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' },
    });
  } catch (err) {
    console.error('deck render error:', err);
    return new Response('Deck temporarily unavailable.', { status: 500 });
  }
}
