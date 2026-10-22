import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin-auth';
import { renderTemplate } from '@/lib/canva/client';

export const maxDuration = 120;

const Body = z.object({ id: z.string().uuid(), photo_url: z.string().url().optional(), lang: z.enum(['sr', 'en']).default('sr') });

const SAMPLE = {
  sr: { eyebrow: 'ZA FRIZERE I BARBERE', headline: 'Puna stolica. Bez propuštenih poziva.', subline: 'Besplatna stranica za zakazivanje za vaš salon.', url: 'balkina.ai', button: 'Napravite stranicu →', big: '24/7', step1_title: 'Aktivirajte stranicu', step1_text: 'Besplatno, za 10 sekundi.', step2_title: 'Podelite link', step2_text: 'Instagram, Google, WhatsApp.', step3_title: 'Klijenti zakazuju', step3_text: 'Vi dobijate obaveštenje.' },
  en: { eyebrow: 'FOR BARBERS AND SALONS', headline: 'Full chair. No missed calls.', subline: 'A free booking page for your salon.', url: 'balkina.ai', button: 'Create your page →', big: '24/7', step1_title: 'Activate your page', step1_text: 'Free, in 10 seconds.', step2_title: 'Share the link', step2_text: 'Instagram, Google, WhatsApp.', step3_title: 'Clients book', step3_text: 'You get a notification.' },
};
const DEFAULT_PHOTO = 'https://balkina.ai/ig/photos/barber.jpg';

// POST /api/admin/canva/templates/test — fill a registered template with sample copy + a sample photo and return the JPEG URL.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if (!auth.admin) return auth.response;
  const parsed = Body.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 });

  const { data: tpl } = await auth.supabase.from('ig_templates').select('*').eq('id', parsed.data.id).maybeSingle();
  if (!tpl) return NextResponse.json({ error: 'Template not found' }, { status: 404 });
  try {
    const r = await renderTemplate(auth.supabase, {
      brandTemplateId: tpl.brand_template_id as string,
      fields: tpl.fields as Record<string, string>,
      text: SAMPLE[parsed.data.lang],
      photoUrl: parsed.data.photo_url ?? DEFAULT_PHOTO,
      title: `Test · ${tpl.title}`,
      storagePath: `tests/${tpl.layout}-${tpl.format}-${Date.now()}.jpg`,
    });
    await auth.supabase.from('ig_templates').update({ last_render_url: r.url, updated_at: new Date().toISOString() }).eq('id', tpl.id);
    return NextResponse.json({ url: r.url, design_id: r.designId });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
