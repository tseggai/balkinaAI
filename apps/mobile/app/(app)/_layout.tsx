import { useEffect } from 'react';
import { Tabs, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { registerPushToken } from '@/lib/registerPushToken';

// Configure notification handler for foreground notifications
try {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
} catch {
  // Notification handler setup may fail if native module isn't available
}

export default function AppTabsLayout() {
  const router = useRouter();

  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.log('[push-reg] no session, skipping push token registration');
          return;
        }

        // Try finding customer by user_id first, then fallback to id = auth uid
        let customerId: string | null = null;
        const { data: byUserId } = await supabase
          .from('customers')
          .select('id')
          .eq('user_id', session.user.id)
          .limit(1)
          .maybeSingle();
        if (byUserId) {
          customerId = (byUserId as { id: string }).id;
        } else {
          // Fallback: customer.id may equal auth user id directly
          const { data: byId } = await supabase
            .from('customers')
            .select('id')
            .eq('id', session.user.id)
            .limit(1)
            .maybeSingle();
          if (byId) {
            customerId = (byId as { id: string }).id;
          }
        }

        if (!customerId) {
          console.log('[push-reg] no customer record found for user', session.user.id);
          return;
        }

        console.log('[push-reg] registering push token for customer', customerId);
        registerPushToken({
          recipientType: 'customer',
          recipientId: customerId,
          accessToken: session.access_token,
        }).catch((err) => {
          console.warn('[push-reg] push token registration failed:', err);
        });
      } catch (err) {
        console.warn('[push-reg] error during push setup:', err);
      }
    })();
  }, []);

  // Listen for incoming notifications while app is in foreground
  useEffect(() => {
    let receivedSub: Notifications.Subscription | undefined;
    let responseSub: Notifications.Subscription | undefined;
    try {
      receivedSub = Notifications.addNotificationReceivedListener((notification) => {
        const data = notification.request.content.data as { type?: string } | undefined;
        console.log('[customer] notification received:', notification.request.content.title, data?.type);
      });

      responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
        const data = response.notification.request.content.data as { type?: string; appointmentId?: string } | undefined;
        if (data?.type === 'booking_approved' || data?.type === 'booking_confirmed' || data?.type === 'booking_completed') {
          router.navigate('/(app)/bookings');
        } else if (data?.type === 'booking_declined' || data?.type === 'booking_no_show') {
          // Navigate to chat for rebooking
          router.navigate('/(app)/');
        }
      });
    } catch {
      // Notifications may not be available
    }

    return () => {
      receivedSub?.remove();
      responseSub?.remove();
    };
  }, [router]);
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6B7FC4',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
          borderTopWidth: 1,
          paddingBottom: 10,
          paddingTop: 5,
          height: 70,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f3f4f6',
        },
        headerTitleStyle: {
          fontWeight: '700',
          fontSize: 18,
          color: '#111827',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Chat',
          headerShown: false,
          tabBarIcon: ({ color }) => (
            <Ionicons name="chatbubbles-outline" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color }) => (
            <Ionicons name="calendar-outline" size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => (
            <Ionicons name="person-outline" size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
