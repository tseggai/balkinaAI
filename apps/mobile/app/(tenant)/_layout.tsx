import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { registerPushToken } from '@/lib/registerPushToken';

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
} catch {}

export default function TenantTabsLayout() {
  useEffect(() => {
    if (!supabaseConfigured) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;
        registerPushToken({
          recipientType: 'customer',
          recipientId: session.user.id,
          accessToken: session.access_token,
        }).catch(() => {});
      } catch {}
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
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
        headerStyle: {
          backgroundColor: '#fff',
          shadowColor: 'transparent',
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: '#f3f4f6',
        },
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: '#111827' },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <Ionicons name="grid-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="appointments"
        options={{
          title: 'Bookings',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color }) => <Ionicons name="briefcase-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Settings',
          tabBarIcon: ({ color }) => <Ionicons name="settings-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
