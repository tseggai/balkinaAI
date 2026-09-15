// Translates deck copy between EN and SR (Montenegrin/Serbian, Latin script)
// with the Anthropic API. Key-gated like the other deck editing endpoints.

export const dynamic = 'force-dynamic';

const LANG_NAMES: Record<string, string> = {
  en: 'English',
  sr: 'Serbian/Montenegrin (Latin script, ekavian, as used in existing Balkina marketing copy)',
};

const MODEL = process.env.DECK_TRANSLATE_MODEL || 'claude-sonnet-5';

export async function POST(request: Request) {
  const configured = process.env.DECK_UPLOAD_KEY;
  if (!configured) return Response.json({ error: 'Editing not configured.' }, { status: 503 });
  if (request.headers.get('x-deck-key') !== configured) {
    return Response.json({ error: 'Invalid editor key.' }, { status: 401 });
  }
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return Response.json({ error: 'ANTHROPIC_API_KEY is not set in the marketing project.' }, { status: 503 });
  }

  try {
    const { texts, from, to } = await request.json();
    if (!Array.isArray(texts) || !LANG_NAMES[from] || !LANG_NAMES[to] || from === to) {
      return Response.json({ error: 'texts, from and to are required.' }, { status: 400 });
    }
    const clean = texts.map((t) => String(t ?? '').slice(0, 2000));
    if (clean.every((t) => !t.trim())) return Response.json({ texts: clean });

    const system =
      `You translate marketing copy for Balkina AI, an AI booking platform for salons, restaurants and local businesses in Montenegro. ` +
      `Translate from ${LANG_NAMES[from]} to ${LANG_NAMES[to]}. Keep the tone concise and confident, use the formal "vi" register, ` +
      `keep product names (Balkina, Google Calendar, Bokun, Viator, App Store), numbers, prices, punctuation marks such as "·", "—" and ":" exactly as they are, ` +
      `and preserve any leading/trailing colon or dash. Empty strings stay empty. ` +
      `Return ONLY a JSON array of strings with the same length and order as the input — no commentary.`;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4000,
        system,
        messages: [{ role: 'user', content: JSON.stringify(clean) }],
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('deck-translate upstream error:', res.status, detail.slice(0, 300));
      return Response.json({ error: `Translation service error (${res.status}).` }, { status: 502 });
    }
    const data = await res.json();
    const raw: string = (data.content ?? []).map((c: { text?: string }) => c.text ?? '').join('');
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    const parsed = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed) || parsed.length !== clean.length) {
      return Response.json({ error: 'Translation came back malformed — try again.' }, { status: 502 });
    }
    return Response.json({ texts: parsed.map((t) => String(t ?? '')) });
  } catch (err) {
    console.error('deck-translate error:', err);
    return Response.json({ error: 'Translation failed.' }, { status: 500 });
  }
}
