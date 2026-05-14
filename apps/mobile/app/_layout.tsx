import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Linking } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { SafeStripeProvider } from '@/lib/stripe';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured, getAuthenticatedRole } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { parseTenantFromUrl, setPendingDeepLinkTenant } from '@/lib/deepLink';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

function RootLayoutContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [deepLinkReady, setDeepLinkReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    console.log('[root-layout] calling Linking.getInitialURL()...');
    Linking.getInitialURL().then((url) => {
      console.log('[root-layout] getInitialURL resolved:', url);
      const tenantId = parseTenantFromUrl(url);
      if (tenantId) setPendingDeepLinkTenant(tenantId);
    }).catch((err) => {
      console.log('[root-layout] getInitialURL error:', err);
    }).finally(() => {
      console.log('[root-layout] deepLinkReady = true');
      setDeepLinkReady(true);
    });
  }, []);

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
    console.log('[root-layout] routing check — initialized:', initialized, 'deepLinkReady:', deepLinkReady, 'session:', !!session, 'segments:', segments);
    if (!initialized || !deepLinkReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    const inTenantGroup = segments[0] === '(tenant)';

    if (!supabaseConfigured && !inAuthGroup) {
      console.log('[root-layout] routing to auth (no supabase config)');
      router.replace('/(auth)/email-login');
      return;
    }

    if (!session && !inAuthGroup) {
      console.log('[root-layout] routing to auth (no session)');
      router.replace('/(auth)/email-login');
    } else if (session && !inAppGroup && !inTenantGroup) {
      console.log('[root-layout] routing to app/tenant...');
      getAuthenticatedRole().then(({ role }) => {
        if (role === 'tenant' || role === 'staff') {
          console.log('[root-layout] routing to /(tenant)/dashboard');
          router.replace('/(tenant)/dashboard');
        } else {
          console.log('[root-layout] routing to /(app)');
          router.replace('/(app)');
        }
      }).catch(() => {
        console.log('[root-layout] role check failed, routing to /(app)');
        router.replace('/(app)');
      });
    }
  }, [session, initialized, deepLinkReady, segments, router]);

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
