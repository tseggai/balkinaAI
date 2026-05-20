import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Linking, Platform, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? '';
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? '';

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [socialLoading, setSocialLoading] = useState(false);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  const [, , googlePromptAsync] = Google.useAuthRequest({
    iosClientId: GOOGLE_CLIENT_ID_IOS,
    webClientId: GOOGLE_CLIENT_ID_WEB,
  });

  const handleGoogleSignIn = async () => {
    try {
      setSocialLoading(true);
      const result = await googlePromptAsync();
      if (result?.type === 'success' && result.authentication?.idToken) {
        const { error } = await supabase.auth.signInWithIdToken({
          provider: 'google',
          token: result.authentication.idToken,
        });
        if (error) throw error;
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert('Sign in failed', e.message ?? 'Please try again');
    } finally {
      setSocialLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setSocialLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
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
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>Book appointments with AI</Text>
      </View>

      <View style={styles.buttons}>
        {Platform.OS === 'ios' && (
          <TouchableOpacity
            style={styles.btnApple}
            onPress={handleAppleSignIn}
            disabled={socialLoading}
          >
            <Text style={styles.btnAppleText}> Continue with Apple</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={styles.btnGoogle}
          onPress={handleGoogleSignIn}
          disabled={socialLoading}
        >
          <Text style={styles.btnGoogleText}>G  Continue with Google</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push('/(auth)/email-login')}
        >
          <Text style={styles.btnPrimaryText}>Continue with email</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.terms}>
        By continuing, you agree to our{' '}
        <Text style={styles.link} onPress={() => Linking.openURL('https://balkina.ai/terms')}>Terms of Service</Text>
        {' '}and{' '}
        <Text style={styles.link} onPress={() => Linking.openURL('https://balkina.ai/privacy')}>Privacy Policy</Text>.
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 120,
    paddingBottom: 48,
  },
  hero: {
    alignItems: 'center',
  },
  logoImage: {
    width: 180,
    height: 180,
    marginBottom: 12,
  },
  tagline: {
    fontSize: 18,
    color: '#6b7280',
  },
  buttons: {
    gap: 12,
  },
  btnApple: {
    backgroundColor: '#000',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnAppleText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnGoogle: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnGoogleText: {
    color: '#374151',
    fontSize: 16,
    fontWeight: '600',
  },
  btnPrimary: {
    backgroundColor: '#6B7FC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  btnStaff: {
    borderWidth: 1,
    borderColor: '#6B7FC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnStaffText: {
    color: '#6B7FC4',
    fontSize: 16,
    fontWeight: '600',
  },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
  link: {
    color: '#6B7FC4',
    textDecorationLine: 'underline' as const,
  },
});
