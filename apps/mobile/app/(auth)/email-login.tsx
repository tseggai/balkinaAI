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
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';
import { useGoogleAuth, googleAvailable, handleGoogleResult } from '@/lib/googleAuth';

// White-label: property color/name on property builds, Balkina defaults otherwise.
const ACCENT = (Constants.expoConfig?.extra?.primaryColor as string | undefined) ?? '#6B7FC4';
const PROPERTY_NAME = (Constants.expoConfig?.extra?.propertyName as string | undefined) ?? null;

let AppleAuthentication: { signInAsync?: (opts: unknown) => Promise<{ identityToken?: string | null }>; AppleAuthenticationScope?: { FULL_NAME: number; EMAIL: number } } | null = null;
try { AppleAuthentication = require('expo-apple-authentication'); } catch {}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

export default function EmailLoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
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

  const { promptAsync: googlePromptAsync } = useGoogleAuth();

  async function handleGoogleSignIn() {
    if (!googlePromptAsync) {
      Alert.alert('Not available', 'Google Sign-In requires a development build.');
      return;
    }
    try {
      setSocialLoading(true);
      const result = await googlePromptAsync();
      await handleGoogleResult(result, supabase.auth.signInWithIdToken.bind(supabase.auth));
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert('Sign in failed', e.message ?? 'Please try again');
    } finally {
      setSocialLoading(false);
    }
  }

  async function handleAppleSignIn() {
    if (!AppleAuthentication?.signInAsync) {
      Alert.alert('Not available', 'Apple Sign-In requires a development build.');
      return;
    }
    try {
      setSocialLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope?.FULL_NAME ?? 0,
          AppleAuthentication.AppleAuthenticationScope?.EMAIL ?? 1,
        ],
      });
      if (!credential.identityToken) throw new Error('No identity token');
      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });
      if (error) throw error;
    } catch (err: unknown) {
      const e = err as { code?: string; message?: string };
      if (e.code !== 'ERR_REQUEST_CANCELED') {
        Alert.alert('Sign in failed', e.message ?? 'Please try again');
      }
    } finally {
      setSocialLoading(false);
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
      {router.canGoBack() && (
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={10}>
          <Ionicons name="arrow-back" size={22} color="#111827" />
        </TouchableOpacity>
      )}
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Logo / brand */}
        <View style={styles.logoContainer}>
          {PROPERTY_NAME ? (
            <View style={[styles.brandCircle, { backgroundColor: ACCENT }]}>
              <Text style={styles.brandInitial}>{PROPERTY_NAME.charAt(0)}</Text>
            </View>
          ) : (
            <Image source={require('../../assets/logo.png')} style={styles.logo} resizeMode="contain" />
          )}
        </View>

        <Text style={styles.title}>
          {isStaffInvite ? 'Join your team'
            : isSignUp ? (PROPERTY_NAME ? `Join ${PROPERTY_NAME}` : 'Create your account')
            : (PROPERTY_NAME ? `Sign in to ${PROPERTY_NAME}` : 'Welcome back')}
        </Text>
        <Text style={styles.subtitle}>
          {isStaffInvite
            ? 'Enter your invite code to set up your staff account.'
            : isSignUp
              ? 'Sign up to start booking appointments.'
              : 'Sign in with your email and password.'}
        </Text>

        {/* Social Sign-In — not for staff invite flow */}
        {!isStaffInvite && (
          <>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[styles.btnApple, socialLoading && styles.btnDisabled]}
                onPress={handleAppleSignIn}
                disabled={socialLoading || loading}
              >
                <Text style={styles.btnAppleText}> Continue with Apple</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.btnGoogle, socialLoading && styles.btnDisabled]}
              onPress={handleGoogleSignIn}
              disabled={socialLoading || loading}
            >
              <Text style={styles.btnGoogleText}>G  Continue with Google</Text>
            </TouchableOpacity>

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>
          </>
        )}

        {/* Staff invite code field */}
        {isStaffInvite && (
          <TextInput
            style={[styles.input, { textAlign: 'center', fontSize: 20, fontWeight: '700', letterSpacing: 6, borderWidth: 2, borderColor: ACCENT }]}
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
            <Text style={[styles.switchText, { color: ACCENT }]}>Have a staff invite code?</Text>
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
  backBtn: {
    position: 'absolute', top: 56, left: 16, zIndex: 10,
    width: 40, height: 40, borderRadius: 20, backgroundColor: '#f3f4f6',
    alignItems: 'center', justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 56,
    height: 56,
  },
  brandCircle: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  brandInitial: { color: '#fff', fontSize: 30, fontWeight: '700' },
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
    backgroundColor: ACCENT,
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnGoogle: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  btnGoogleText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
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
    color: ACCENT,
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
    color: ACCENT,
    textDecorationLine: 'underline' as const,
  },
  btnApple: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
  },
  btnAppleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#e5e7eb',
  },
  dividerText: {
    marginHorizontal: 12,
    fontSize: 14,
    color: '#9ca3af',
  },
});
