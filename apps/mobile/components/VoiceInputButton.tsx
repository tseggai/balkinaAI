import React from 'react';
import { loadAudio } from '@/lib/voice';
import VoiceRecorder, { type VoiceInputProps } from './VoiceRecorder';

/**
 * Mic button for the chat input bar. Tap to record, tap again to stop; the recording is transcribed
 * on the server and the text is handed to `onTranscript`. Renders nothing when this build has no
 * audio module.
 */
export default function VoiceInputButton(props: VoiceInputProps) {
  const audio = loadAudio();
  if (!audio) return null;
  return <VoiceRecorder audio={audio} {...props} />;
}
