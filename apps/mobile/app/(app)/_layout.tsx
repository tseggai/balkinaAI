import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { registerPushToken } from '@/lib/registerPushToken';

export default function AppTabsLayout() {
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const { data: customer } = await supabase
        .from('customers')
        .select('id')
        .eq('user_id', session.user.id)
        .single();
      if (customer) {
        registerPushToken({
          recipientType: 'customer',
          recipientId: (customer as { id: string }).id,
          accessToken: session.access_token,
        }).catch(() => { /* push registration is non-critical */ });
      }
    })();
  }, []);
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
