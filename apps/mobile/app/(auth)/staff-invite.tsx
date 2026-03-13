import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

export default function StaffInviteScreen() {
  const router = useRouter();
  const [step, setStep] = useState<'code' | 'signup'>('code');
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleAcceptInvite = async () => {
    if (!inviteCode.trim()) { Alert.alert('Error', 'Enter your invite code'); return; }
    if (!email.trim()) { Alert.alert('Error', 'Enter your email'); return; }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }

    setLoading(true);

    try {
      // Accept invite via API
      const res = await fetch(`${API_BASE}/api/staff/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: inviteCode.trim().toUpperCase(),
          email: email.trim().toLowerCase(),
          password,
          name: name.trim() || undefined,
        }),
      });

      const json = await res.json() as { data: { message: string } | null; error: { message: string } | null };

      if (json.error) {
        Alert.alert('Error', json.error.message);
        setLoading(false);
        return;
      }

      // Sign in with the new credentials
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });

      if (signInErr) {
        Alert.alert('Account Created', 'Your account was created. Please sign in with your email and password.');
        router.replace('/(auth)/email-login');
      }
      // If sign-in succeeded, the auth state listener in root layout will redirect to /(staff)/dashboard
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Text style={styles.backText}>Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Join your team</Text>
        <Text style={styles.subtitle}>
          Enter the invite code from your manager to set up your staff account.
        </Text>

        {/* Invite code */}
        <Text style={styles.label}>Invite Code</Text>
        <TextInput
          style={styles.codeInput}
          value={inviteCode}
          onChangeText={setInviteCode}
          placeholder="XXXXXX"
          autoCapitalize="characters"
          maxLength={6}
          textAlign="center"
        />

        {/* Email */}
        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="your@email.com"
          keyboardType="email-address"
          autoCapitalize="none"
        />

        {/* Name (optional) */}
        <Text style={styles.label}>Name (optional)</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Your name"
        />

        {/* Password */}
        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Min 6 characters"
          secureTextEntry
        />

        <TouchableOpacity style={styles.submitBtn} onPress={handleAcceptInvite} disabled={loading}>
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>Create Account</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => router.push('/(auth)/email-login')}
        >
          <Text style={styles.loginLinkText}>Already have an account? Sign in</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 24, paddingTop: 60 },
  backBtn: { marginBottom: 24 },
  backText: { fontSize: 16, color: '#6B7FC4', fontWeight: '500' },
  title: { fontSize: 28, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 32, lineHeight: 22 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  codeInput: {
    height: 56, borderRadius: 12, borderWidth: 2, borderColor: '#6B7FC4',
    fontSize: 24, fontWeight: '700', letterSpacing: 8, color: '#111827',
  },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb',
    paddingHorizontal: 16, fontSize: 16, backgroundColor: '#f9fafb',
  },
  submitBtn: {
    backgroundColor: '#6B7FC4', paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 32,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loginLink: { alignItems: 'center', marginTop: 16 },
  loginLinkText: { fontSize: 14, color: '#6B7FC4', fontWeight: '500' },
});
