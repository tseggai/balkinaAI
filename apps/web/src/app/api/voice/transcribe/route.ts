/**
 * POST /api/voice/transcribe — turn a short voice message from the chat into text.
 *
 * The mobile app records up to a minute of audio, uploads it here and puts the returned text into
 * the chat input for the user to review and send. Nothing is booked from this endpoint and the audio
 * is not stored. Signed-in users only (bearer token), size-capped and rate-limited per user.
 */
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/server';

export const maxDuration = 60;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

const MAX_BYTES = 4 * 1024 * 1024;   // about four minutes of the app's 64 kbps recordings; the app stops at one
const PER_HOUR = 40;
const PER_DAY = 200;

const Upload = z.object({
  size: z.number().int().positive().max(MAX_BYTES),
  name: z.string().regex(/\.(m4a|mp4|webm|wav|mp3|ogg|flac)$/i),
});

// Names the model would otherwise mishear; it also tells it which languages to expect.
const HINT =
  'A booking request spoken to the Balkina app, in Montenegrin, Serbian or English. ' +
  'Places: Porto Montenegro, Portonovi, Luštica Bay, Tivat, Budva, Kotor, Herceg Novi, Podgorica, Beograd.';

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status, headers: CORS_HEADERS });

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return json({ error: 'Voice input is not configured' }, 503);

  const admin = createAdminClient();
  const token = request.headers.get('Authorization')?.replace(/^Bearer\s+/i, '').trim();
  if (!token) return json({ error: 'Sign in to use voice input' }, 401);
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return json({ error: 'Sign in to use voice input' }, 401);

  const form = await request.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) return json({ error: 'No audio received' }, 400);
  const parsed = Upload.safeParse({ size: file.size, name: file.name });
  if (!parsed.success) return json({ error: file.size > MAX_BYTES ? 'That recording is too long' : 'Unsupported audio' }, 400);

  const now = Date.now();
  const [{ count: lastHour }, { count: lastDay }] = await Promise.all([
    admin.from('voice_usage').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(now - 3600_000).toISOString()),
    admin.from('voice_usage').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(now - 86_400_000).toISOString()),
  ]);
  if ((lastHour ?? 0) >= PER_HOUR || (lastDay ?? 0) >= PER_DAY) return json({ error: 'Too many voice messages. Please type for now.' }, 429);

  try {
    const openai = new OpenAI({ apiKey });
    const result = await openai.audio.transcriptions.create({
      file,
      model: process.env.VOICE_TRANSCRIBE_MODEL ?? 'gpt-4o-mini-transcribe',
      prompt: HINT,
    });
    await admin.from('voice_usage').insert({ user_id: user.id, bytes: file.size });
    const text = (result.text ?? '').trim();
    if (!text) return json({ error: "I didn't catch that. Please try again." }, 422);
    return json({ text });
  } catch (err) {
    console.error('[voice/transcribe]', err instanceof Error ? err.message : err);
    return json({ error: 'Could not transcribe the recording. Please try again.' }, 502);
  }
}
