import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Membership {
  member_type: string;
  unit: string | null;
}

interface Props {
  visible: boolean;
  accent: string;
  propertyName: string;
  propertySlug: string;
  apiBase: string;
  /** Existing membership, if re-verifying / updating. */
  current?: Membership | null;
  onClose: () => void;
  onVerified: (membership: Membership) => void;
}

export default function PropertyMemberVerifyModal({
  visible, accent, propertyName, propertySlug, apiBase, current, onClose, onVerified,
}: Props) {
  const [code, setCode] = useState('');
  const [unit, setUnit] = useState(current?.unit ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reset = () => { setCode(''); setUnit(current?.unit ?? ''); setError(null); setSuccess(null); setLoading(false); };
  const close = () => { reset(); onClose(); };

  const submit = async () => {
    if (!code.trim()) { setError('Enter the code your property gave you.'); return; }
    setLoading(true);
    setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setError('Please sign in first.'); setLoading(false); return; }
      const res = await fetch(`${apiBase}/api/member/redeem`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ slug: propertySlug, code: code.trim(), unit: unit.trim() || null }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) { setError(json.error ?? 'Could not verify. Please try again.'); setLoading(false); return; }
      const m = json.data as Membership;
      setSuccess(json.message ?? "You're verified.");
      setLoading(false);
      onVerified({ member_type: m.member_type, unit: m.unit });
    } catch {
      setError('Network error. Please try again.');
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        <View style={styles.card}>
          <TouchableOpacity style={styles.closeBtn} onPress={close} hitSlop={10}>
            <Ionicons name="close" size={22} color="#6B655C" />
          </TouchableOpacity>

          {success ? (
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <View style={[styles.badge, { backgroundColor: accent }]}>
                <Ionicons name="checkmark" size={30} color="#fff" />
              </View>
              <Text style={styles.title}>You're verified</Text>
              <Text style={styles.subtitle}>{success}</Text>
              <TouchableOpacity style={[styles.submit, { backgroundColor: accent, marginTop: 20 }]} onPress={close} activeOpacity={0.9}>
                <Text style={styles.submitText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.title}>Verify your residence</Text>
              <Text style={styles.subtitle}>
                Enter the code {propertyName} gave you to unlock resident announcements and access.
              </Text>

              <Text style={styles.label}>Code</Text>
              <TextInput
                value={code}
                onChangeText={(t) => setCode(t.toUpperCase())}
                placeholder="e.g. PORTONOVI-OWNER-X3K9"
                placeholderTextColor="#B8B1A6"
                autoCapitalize="characters"
                autoCorrect={false}
                style={styles.input}
              />

              <Text style={styles.label}>Unit <Text style={{ color: '#B8B1A6' }}>(optional)</Text></Text>
              <TextInput
                value={unit}
                onChangeText={setUnit}
                placeholder="e.g. Villa 12"
                placeholderTextColor="#B8B1A6"
                style={styles.input}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.submit, { backgroundColor: accent }, loading && { opacity: 0.7 }]}
                onPress={submit}
                disabled={loading}
                activeOpacity={0.9}
              >
                {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>Verify</Text>}
              </TouchableOpacity>
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.45)', padding: 24 },
  card: { width: '100%', maxWidth: 400, backgroundColor: '#FBF9F5', borderRadius: 20, padding: 22, paddingTop: 26 },
  closeBtn: { position: 'absolute', top: 12, right: 12, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', zIndex: 2 },
  badge: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 20, fontWeight: '700', color: '#1A1A1A', textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#6B655C', textAlign: 'center', marginTop: 8, lineHeight: 20 },
  label: { fontSize: 13, fontWeight: '600', color: '#1A1A1A', marginTop: 18, marginBottom: 6 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#ECE7DE', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#1A1A1A' },
  error: { color: '#dc2626', fontSize: 13, marginTop: 12 },
  submit: { borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginTop: 20 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
