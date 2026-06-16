import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, StatusBar, Linking } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import Constants from 'expo-constants';
import { SafeStripeProvider } from '@/lib/stripe';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured, getAuthenticatedRole } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { parseTenantFromUrl, setPendingDeepLinkTenant } from '@/lib/deepLink';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';
const PROPERTY_NAME = (Constants.expoConfig?.extra?.propertyName as string | undefined) ?? null;
const PROPERTY_PRIMARY = (Constants.expoConfig?.extra?.primaryColor as string | undefined) ?? '#6B7FC4';

function RootLayoutContent() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [deepLinkReady, setDeepLinkReady] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      const tenantId = parseTenantFromUrl(url);
      if (tenantId) setPendingDeepLinkTenant(tenantId);
    }).finally(() => {
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
    if (!initialized || !deepLinkReady) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inAppGroup = segments[0] === '(app)';
    const inTenantGroup = segments[0] === '(tenant)';
    const inStaffGroup = segments[0] === '(staff)';

    // White-label property apps let customers browse the storefront without
    // logging in — auth is only required at booking time.
    const isPropertyApp = !!Constants.expoConfig?.extra?.propertySlug;

    if (!supabaseConfigured && !inAuthGroup) {
      router.replace('/(auth)/email-login');
      return;
    }

    if (!session) {
      if (isPropertyApp) {
        if (!inAppGroup && !inAuthGroup) router.replace('/(app)');
      } else if (!inAuthGroup) {
        router.replace('/(auth)/email-login');
      }
    } else if (session && !inAppGroup && !inTenantGroup && !inStaffGroup) {
      getAuthenticatedRole().then(({ role }) => {
        if (role === 'tenant') {
          router.replace('/(tenant)/dashboard');
        } else if (role === 'staff') {
          router.replace('/(staff)/dashboard');
        } else {
          router.replace('/(app)');
        }
      }).catch(() => {
        router.replace('/(app)');
      });
    }
  }, [session, initialized, deepLinkReady, segments, router]);

  if (!initialized) {
    return (
      <View style={[styles.loading, PROPERTY_NAME ? { backgroundColor: PROPERTY_PRIMARY } : null]}>
        <Text style={[styles.loadingText, { color: PROPERTY_NAME ? '#fff' : PROPERTY_PRIMARY }]}>{PROPERTY_NAME ?? 'Balkina AI'}</Text>
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
        <Stack.Screen name="(staff)" options={{ headerShown: false }} />
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
