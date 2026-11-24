/* Voice input for the chat: record a short message with expo-audio, send it to
   POST /api/voice/transcribe and hand back the text. The module needs a native build that
   includes expo-audio; where it is missing (an older development build) voice input is simply
   unavailable and the mic button does not render. */
import type * as ExpoAudioModule from 'expo-audio';
import { supabase } from './supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

export type ExpoAudio = typeof ExpoAudioModule;

let cached: ExpoAudio | null | undefined;

/** expo-audio when the native module is in this build, otherwise null. */
export function loadAudio(): ExpoAudio | null {
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require('expo-audio') as ExpoAudio;
    cached = typeof mod.useAudioRecorder === 'function' ? mod : null;
  } catch {
    cached = null;
  }
  return cached;
}

/** Longest voice message the app records, in seconds. */
export const MAX_VOICE_SECONDS = 60;

export type TranscribeResult = { text: string } | { error: string };

/** Upload a finished recording and get its text. Needs a signed-in user. */
export async function transcribeRecording(uri: string): Promise<TranscribeResult> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return { error: 'Please sign in to use voice input.' };
    const ext = (uri.split('.').pop() ?? 'm4a').toLowerCase();
    const form = new FormData();
    form.append('file', { uri, name: `voice.${ext}`, type: ext === 'm4a' || ext === 'mp4' ? 'audio/m4a' : `audio/${ext}` } as unknown as Blob);
    const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: form,
    });
    const body = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
    if (!res.ok || !body.text) return { error: body.error ?? 'Could not transcribe the recording. Please try again.' };
    return { text: body.text };
  } catch {
    return { error: 'Connection error. Please try again.' };
  }
}
