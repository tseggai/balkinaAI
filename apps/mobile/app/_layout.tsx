import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeStripeProvider } from '@/lib/stripe';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured, getAuthenticatedRole } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ErrorBoundary';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

function RootLayoutContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!supabaseConfigured) {
      setInitialized(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setInitialized(true);
    }).catch(() => {
      setInitialized(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    const inTenantGroup = segments[0] === '(tenant)';

    if (!supabaseConfigured && !inAuthGroup) {
      router.replace('/(auth)/email-login');
      return;
    }

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/email-login');
    } else if (session && !inAppGroup && !inTenantGroup) {
      getAuthenticatedRole().then(({ role }) => {
        if (role === 'tenant' || role === 'staff') {
          router.replace('/(tenant)/dashboard');
        } else {
          router.replace('/(app)');
        }
      }).catch(() => {
        router.replace('/(app)');
      });
    }
  }, [session, initialized, segments, router]);

  if (!initialized) {
    return (
      <View style={styles.loading}>
        <Text style={styles.loadingText}>Balkina AI</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      <Stack screenOptions={{ headerBackTitle: 'Back' }}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(app)" options={{ headerShown: false }} />
        <Stack.Screen name="(staff)" options={{ headerShown: false }} />
        <Stack.Screen name="(tenant)" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
      <SafeStripeProvider
        publishableKey={STRIPE_PUBLISHABLE_KEY}
        merchantIdentifier="merchant.ai.balkina.app"
      >
        <RootLayoutContent />
      </SafeStripeProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  loadingText: {
    fontSize: 24,
    fontWeight: '700',
    color: '#6B7FC4',
  },
});
