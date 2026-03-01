import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [initialized, setInitialized] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setInitialized(true);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!initialized) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/welcome');
    } else if (session && inAuthGroup) {
      router.replace('/(main)');
    }
  }, [session, initialized, segments, router]);

  return (
    <Stack screenOptions={{ headerBackTitle: 'Back' }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false }} />
      <Stack.Screen name="(main)" options={{ headerShown: false }} />
      <Stack.Screen
        name="chat"
        options={{
          title: 'Book Appointment',
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#6366f1',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        }}
      />
      <Stack.Screen
        name="businesses"
        options={{
          title: 'Browse Businesses',
          headerStyle: { backgroundColor: '#fff' },
          headerTintColor: '#6366f1',
          headerTitleStyle: { fontWeight: '700', fontSize: 17 },
        }}
      />
    </Stack>
  );
}
