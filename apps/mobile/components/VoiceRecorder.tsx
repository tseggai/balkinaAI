import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Linking, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MAX_VOICE_SECONDS, transcribeRecording, type ExpoAudio } from '@/lib/voice';

export interface VoiceInputProps {
  /** Receives the transcript; the screen puts it in the input box for the user to review and send. */
  onTranscript: (text: string) => void;
  disabled?: boolean;
  /** Brand colour of the surrounding screen (property portals). */
  accent?: string;
}

/** The recorder behind VoiceInputButton; mounted only when the audio module is in this build. */
export default function VoiceRecorder({ audio, onTranscript, disabled, accent }: VoiceInputProps & { audio: ExpoAudio }) {
  // Speech does not need stereo or a high bitrate; this keeps a one-minute message near half a megabyte.
  const recorder = audio.useAudioRecorder({ ...audio.RecordingPresets.HIGH_QUALITY, numberOfChannels: 1, bitRate: 64000 });
  const state = audio.useAudioRecorderState(recorder, 250);
  const [busy, setBusy] = useState(false);
  const stopping = useRef(false);
  const seconds = Math.floor((state.durationMillis ?? 0) / 1000);

  const start = useCallback(async () => {
    const permission = await audio.requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone is off', 'Allow microphone access for Balkina in Settings to speak your request.', [
        { text: 'Not now', style: 'cancel' },
        { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } },
      ]);
      return;
    }
    try {
      await audio.setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
    } catch {
      Alert.alert('Voice input', 'Could not start recording. Please try again.');
    }
  }, [audio, recorder]);

  const stop = useCallback(async () => {
    if (stopping.current) return;
    stopping.current = true;
    setBusy(true);
    try {
      await recorder.stop();
      await audio.setAudioModeAsync({ allowsRecording: false }).catch(() => undefined);
      const uri = recorder.uri;
      if (!uri) { Alert.alert('Voice input', 'Nothing was recorded. Please try again.'); return; }
      const result = await transcribeRecording(uri);
      if ('error' in result) Alert.alert('Voice input', result.error);
      else onTranscript(result.text);
    } catch {
      Alert.alert('Voice input', 'Could not finish the recording. Please try again.');
    } finally {
      stopping.current = false;
      setBusy(false);
    }
  }, [audio, recorder, onTranscript]);

  // A voice message is a sentence or two: stop on our own at the limit.
  useEffect(() => {
    if (state.isRecording && seconds >= MAX_VOICE_SECONDS) void stop();
  }, [state.isRecording, seconds, stop]);

  if (busy) {
    return (
      <View style={styles.button} accessibilityLabel="Transcribing">
        <ActivityIndicator size="small" color={accent ?? '#6B7FC4'} />
      </View>
    );
  }

  if (state.isRecording) {
    return (
      <TouchableOpacity style={styles.recording} onPress={() => { void stop(); }} activeOpacity={0.7} accessibilityRole="button" accessibilityLabel="Stop recording">
        <Ionicons name="stop" size={14} color="#fff" />
        <Text style={styles.timer}>{`0:${String(Math.min(seconds, MAX_VOICE_SECONDS)).padStart(2, '0')}`}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled]}
      onPress={() => { void start(); }}
      disabled={disabled}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel="Speak your request"
    >
      <Ionicons name="mic-outline" size={20} color={accent ?? '#6B7FC4'} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  // Sits inside the text input, to the left of the send button (34 px wide at right: 8).
  button: { position: 'absolute', right: 48, bottom: 8, width: 34, height: 34, borderRadius: 17, justifyContent: 'center', alignItems: 'center' },
  recording: { position: 'absolute', right: 48, bottom: 8, height: 34, paddingHorizontal: 10, borderRadius: 17, backgroundColor: '#EF4444', flexDirection: 'row', alignItems: 'center', gap: 5 },
  timer: { color: '#fff', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  disabled: { opacity: 0.4 },
});
