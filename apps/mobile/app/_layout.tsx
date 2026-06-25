import { useEffect, useState } from 'react';
import { StatusBar, Linking } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import Constants from 'expo-constants';
import * as SplashScreen from 'expo-splash-screen';
import { SafeStripeProvider } from '@/lib/stripe';
import type { Session } from '@supabase/supabase-js';
import { supabase, supabaseConfigured, getAuthenticatedRole } from '@/lib/supabase';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { BootSplash } from '@/lib/bootSplash';
import { parseTenantFromUrl, setPendingDeepLinkTenant } from '@/lib/deepLink';

const STRIPE_PUBLISHABLE_KEY = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? '';

// Landing groups that own their own native-splash hide. The (app) landing
// (storefront / chat) keeps the splash up behind its BootSplash bridge until
// its data is ready, so the root layout must NOT hide the splash on the way
// there — only when routing settles on a different terminal group.
const SPLASH_HIDE_GROUPS = ['(auth)', '(tenant)', '(staff)'];

// Keep the native splash up until the first real screen is painted, so the app
// goes splash → first screen without flashing the intermediate JS loaders.
// On property builds the storefront screen hides it once its data is ready
// (see (app)/index.tsx); other flows hide it here.
SplashScreen.preventAutoHideAsync().catch(() => {});
// Cross-fade the splash → landing hand-off instead of an instant cut. Applies to
// every hideAsync() call below (property storefront and base chat alike). The
// fade is iOS-only in expo-splash-screen; Android keeps the instant hide.
try {
  SplashScreen.setOptions({ duration: 450, fade: true });
} catch {
  /* older runtimes without setOptions — fall back to instant hide */
}

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

  // Hide the native splash. The (app) landing (storefront / chat) hides it
  // itself once its BootSplash bridge is painted and its data is ready; every
  // other destination (auth / tenant / staff) hides it here once routing
  // settles there. A failsafe ensures it never gets stuck.
  useEffect(() => {
    const failsafe = setTimeout(() => { SplashScreen.hideAsync().catch(() => {}); }, 5000);
    return () => clearTimeout(failsafe);
  }, []);
  useEffect(() => {
    if (!initialized || !deepLinkReady) return;
    if (SPLASH_HIDE_GROUPS.includes(segments[0] as string)) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [initialized, deepLinkReady, segments]);

  // Before init settles the native splash is still up; render the matching
  // BootSplash underneath so any reveal is an identical frame, never a flash.
  if (!initialized) {
    return <BootSplash />;
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
