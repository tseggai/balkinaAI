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

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

export default function StaffInviteScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<'signin' | 'invite'>('signin');
  const [inviteCode, setInviteCode] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim()) { Alert.alert('Error', 'Enter your email'); return; }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (error) {
        Alert.alert('Sign In Failed', error.message);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

        <Text style={styles.title}>{mode === 'signin' ? 'Staff Sign In' : 'Join Your Team'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'signin'
            ? 'Sign in with your staff email and password.'
            : 'Enter the invite code from your manager to set up your staff account.'}
        </Text>

        {mode === 'invite' && (
          <>
            <TextInput
              style={styles.codeInput}
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="Invite Code"
              placeholderTextColor="#9ca3af"
              autoCapitalize="characters"
              maxLength={6}
              textAlign="center"
            />
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Your name (optional)"
              placeholderTextColor="#9ca3af"
            />
          </>
        )}

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email address"
          placeholderTextColor="#9ca3af"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={mode === 'invite' ? 'Create password (min 6 characters)' : 'Password'}
          placeholderTextColor="#9ca3af"
          secureTextEntry
        />

        <TouchableOpacity
          style={styles.submitBtn}
          onPress={mode === 'signin' ? handleSignIn : handleAcceptInvite}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>{mode === 'signin' ? 'Sign In' : 'Create Account'}</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.loginLink}
          onPress={() => setMode(mode === 'signin' ? 'invite' : 'signin')}
        >
          <Text style={styles.loginLinkText}>
            {mode === 'signin' ? 'New staff? Use invite code' : 'Already have an account? Sign in'}
          </Text>
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
  subtitle: { fontSize: 15, color: '#6b7280', marginBottom: 24, lineHeight: 22 },
  codeInput: {
    height: 56, borderRadius: 12, borderWidth: 2, borderColor: '#6B7FC4',
    fontSize: 24, fontWeight: '700', letterSpacing: 8, color: '#111827', marginBottom: 10,
  },
  input: {
    borderRadius: 12, backgroundColor: '#f9fafb',
    paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 10,
  },
  submitBtn: {
    backgroundColor: '#6B7FC4', paddingVertical: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 32,
  },
  submitBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  loginLink: { alignItems: 'center', marginTop: 16 },
  loginLinkText: { fontSize: 14, color: '#6B7FC4', fontWeight: '500' },
});
