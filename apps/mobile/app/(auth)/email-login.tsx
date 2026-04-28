import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

export default function EmailLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [isStaffInvite, setIsStaffInvite] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [resetSent, setResetSent] = useState(false);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Sign In Failed', error.message);
    }
    // On success, onAuthStateChange in _layout.tsx handles redirect to /(main)
  }

  async function handleSignUp() {
    if (!email.trim() || !password) {
      Alert.alert('Error', 'Please enter your email and password');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    if (!name.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: name.trim(),
          phone: phone.trim() || undefined,
        },
      },
    });

    if (error) {
      setLoading(false);
      Alert.alert('Sign Up Failed', error.message);
      return;
    }

    // Create or update customer record — preserve existing phone/email if already set by tenant
    if (data.user) {
      const { data: existing } = await supabase
        .from('customers')
        .select('phone, email')
        .eq('id', data.user.id)
        .single();
      const cur = existing as { phone: string | null; email: string | null } | null;
      const { error: upsertErr } = await supabase.from('customers').upsert({
        id: data.user.id,
        user_id: data.user.id,
        display_name: name.trim(),
        email: email.trim() || cur?.email || null,
        phone: phone.trim() || cur?.phone || null,
      });
      if (upsertErr) {
        console.warn('[email-login] customer upsert failed (will auto-create on profile load):', upsertErr.message);
      }
    }

    setLoading(false);
  }

  async function handleStaffInvite() {
    if (!inviteCode.trim()) { Alert.alert('Error', 'Enter your invite code'); return; }
    if (!email.trim()) { Alert.alert('Error', 'Enter your email'); return; }
    if (password.length < 6) { Alert.alert('Error', 'Password must be at least 6 characters'); return; }

    setLoading(true);
    try {
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
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      });
      if (signInErr) {
        Alert.alert('Account Created', 'Your staff account was created. Please sign in.');
        setIsStaffInvite(false);
        setIsSignUp(false);
      }
    } catch {
      Alert.alert('Error', 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    if (!email.trim()) {
      Alert.alert('Enter your email', 'Please type your email address above, then tap "Forgot password?" again.');
      return;
    }

    setLoading(true);

    // Redirect directly to the web app's reset-password page.
    // The mobile Supabase client doesn't use PKCE, so Supabase redirects with
    // hash fragments (#access_token=...&type=recovery). A server-side callback
    // can't read hash fragments, so we skip it and let the client-side page
    // handle the tokens via @supabase/ssr's automatic hash detection.
    const webUrl = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${webUrl}/auth/reset-password`,
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    setResetSent(true);
  }

  if (resetSent) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Check your email</Text>
        <Text style={styles.subtitle}>
          We sent a password reset link to{' '}
          <Text style={styles.bold}>{email}</Text>.
          {'\n\n'}
          Follow the link in the email to set a new password, then come back and sign in.
        </Text>
        <TouchableOpacity
          style={styles.btn}
          onPress={() => setResetSent(false)}
        >
          <Text style={styles.btnText}>Back to sign in</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
        </View>

        <Text style={styles.title}>
          {isStaffInvite ? 'Join your team' : isSignUp ? 'Create your account' : 'Welcome back'}
        </Text>
        <Text style={styles.subtitle}>
          {isStaffInvite
            ? 'Enter your invite code to set up your staff account.'
            : isSignUp
              ? 'Sign up to start booking appointments.'
              : 'Sign in with your email and password.'}
        </Text>

        {/* Staff invite code field */}
        {isStaffInvite && (
          <TextInput
            style={[styles.input, { textAlign: 'center', fontSize: 20, fontWeight: '700', letterSpacing: 6, borderWidth: 2, borderColor: '#6B7FC4' }]}
            value={inviteCode}
            onChangeText={setInviteCode}
            placeholder="INVITE CODE"
            placeholderTextColor="#9ca3af"
            autoCapitalize="characters"
            maxLength={6}
          />
        )}

        {/* Name + phone for customer sign-up and staff invite */}
        {(isSignUp || isStaffInvite) && (
          <>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Full name"
              placeholderTextColor="#9ca3af"
              autoCapitalize="words"
              autoComplete="name"
            />
            {isSignUp && !isStaffInvite && (
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="Phone number (optional)"
                placeholderTextColor="#9ca3af"
                keyboardType="phone-pad"
                autoComplete="tel"
              />
            )}
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
          autoComplete="email"
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder={(isSignUp || isStaffInvite) ? 'Create password (min 6 characters)' : 'Password'}
          placeholderTextColor="#9ca3af"
          secureTextEntry
          autoComplete={(isSignUp || isStaffInvite) ? 'new-password' : 'current-password'}
        />

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={isStaffInvite ? handleStaffInvite : isSignUp ? handleSignUp : handleSignIn}
          disabled={loading}
        >
          <Text style={styles.btnText}>
            {loading
              ? isStaffInvite ? 'Joining...' : isSignUp ? 'Creating account...' : 'Signing in...'
              : isStaffInvite ? 'Join Team' : isSignUp ? 'Create account' : 'Sign in'}
          </Text>
        </TouchableOpacity>

        {!isSignUp && !isStaffInvite && (
          <TouchableOpacity
            style={styles.forgotBtn}
            onPress={handleForgotPassword}
            disabled={loading}
          >
            <Text style={styles.forgotText}>Forgot password?</Text>
          </TouchableOpacity>
        )}

        {/* Toggle between sign in / sign up */}
        {!isStaffInvite && (
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => { setIsSignUp(!isSignUp); setIsStaffInvite(false); }}
          >
            <Text style={styles.switchText}>
              {isSignUp
                ? 'Already have an account? Sign in'
                : "Don't have an account? Sign up"}
            </Text>
          </TouchableOpacity>
        )}

        {/* Staff invite toggle */}
        {isSignUp && !isStaffInvite && (
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => setIsStaffInvite(true)}
          >
            <Text style={[styles.switchText, { color: '#6B7FC4' }]}>Have a staff invite code?</Text>
          </TouchableOpacity>
        )}

        {isStaffInvite && (
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => { setIsStaffInvite(false); setInviteCode(''); }}
          >
            <Text style={styles.switchText}>Back to sign up</Text>
          </TouchableOpacity>
        )}

        {/* Terms */}
        <Text style={styles.terms}>
          By continuing, you agree to our{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://balkina.ai/terms')}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.termsLink} onPress={() => Linking.openURL('https://balkina.ai/privacy')}>Privacy Policy</Text>.
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#fff',
  },
  container: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingVertical: 40,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 56,
    height: 56,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 28,
    lineHeight: 22,
  },
  bold: {
    fontWeight: '600',
    color: '#111827',
  },
  input: {
    backgroundColor: '#f3f4f6',
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 15,
    fontSize: 16,
    color: '#111827',
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#6B7FC4',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotBtn: {
    alignItems: 'center',
    marginTop: 16,
  },
  forgotText: {
    color: '#9ca3af',
    fontSize: 14,
    fontWeight: '500',
  },
  switchBtn: {
    alignItems: 'center',
    marginTop: 14,
  },
  switchText: {
    color: '#6B7FC4',
    fontSize: 14,
    fontWeight: '500',
  },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    color: '#d1d5db',
    lineHeight: 18,
    marginTop: 32,
  },
  termsLink: {
    color: '#6B7FC4',
    textDecorationLine: 'underline' as const,
  },
});
