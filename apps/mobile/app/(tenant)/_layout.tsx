import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Notifications from 'expo-notifications';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { registerPushToken } from '@/lib/registerPushToken';
import { TenantPermissionsProvider, useTenantPermissions } from '@/lib/tenantPermissions';

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

function TenantTabs() {
  const perms = useTenantPermissions();

  useEffect(() => {
    if (!supabaseConfigured || perms.loading) return;
    (async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        if (perms.staffId) {
          registerPushToken({
            recipientType: 'staff',
            recipientId: perms.staffId,
            accessToken: session.access_token,
          }).catch(() => {});
        } else {
          registerPushToken({
            recipientType: 'customer',
            recipientId: session.user.id,
            accessToken: session.access_token,
          }).catch(() => {});
        }
      } catch {}
    })();
  }, [perms.loading, perms.staffId]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#6B7FC4',
        tabBarInactiveTintColor: '#9ca3af',
        tabBarStyle: {
          backgroundColor: '#fff',
          borderTopColor: '#e5e7eb',
          borderTopWidth: 1,
          paddingBottom: 20,
          paddingTop: 8,
          height: 85,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
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
          title: 'Home',
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
        options={{ title: 'Services', href: null }}
      />
      <Tabs.Screen
        name="staff"
        options={{ title: 'Staff', href: null }}
      />
      <Tabs.Screen
        name="locations"
        options={{ title: 'Locations', href: null }}
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

export default function TenantTabsLayout() {
  return (
    <TenantPermissionsProvider>
      <TenantTabs />
    </TenantPermissionsProvider>
  );
}
