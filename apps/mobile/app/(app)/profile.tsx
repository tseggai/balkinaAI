import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import type { User } from '@supabase/supabase-js';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

// ── Types ────────────────────────────────────────────────────────────────────

interface MenuItem {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [toggling, setToggling] = useState(false);

  const fetchUser = useCallback(async () => {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    setUser(authUser);

    // Fetch notification preferences
    if (authUser) {
      const { data: customer } = await supabase
        .from('customers')
        .select('notify_sms, notify_push')
        .eq('user_id', authUser.id)
        .single();
      if (customer) {
        const c = customer as { notify_sms: boolean | null; notify_push: boolean | null };
        setNotifySms(c.notify_sms ?? true);
        setNotifyPush(c.notify_push ?? true);
      }
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const updatePreference = useCallback(async (field: string, value: boolean) => {
    setToggling(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setToggling(false); return; }

    try {
      await fetch(`${API_BASE}/api/customers/preferences`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      // Revert on failure
      if (field === 'notify_sms') setNotifySms(!value);
      if (field === 'notify_push') setNotifyPush(!value);
    } finally {
      setToggling(false);
    }
  }, []);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
        },
      },
    ]);
  }, []);

  const menuItems: MenuItem[] = [
    {
      icon: 'create-outline',
      label: 'Edit Profile',
      onPress: () => {
        Alert.alert(
          'Edit Profile',
          'Profile editing will be available soon.',
        );
      },
    },
    {
      icon: 'card-outline',
      label: 'Payment Methods',
      onPress: () => {
        Alert.alert('Coming soon', 'Payment methods will be available soon.');
      },
    },
  ];

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6B7FC4" />
      </View>
    );
  }

  // Derive display info from user metadata or email
  const meta = user?.user_metadata as
    | { display_name?: string }
    | undefined;
  const displayName = meta?.display_name ?? user?.email ?? 'Guest';
  const email = user?.email ?? '';
  const initial = (displayName.charAt(0) || '?').toUpperCase();

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      {/* Avatar section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.nameText}>{displayName}</Text>
        {email ? <Text style={styles.emailText}>{email}</Text> : null}
      </View>

      {/* Menu items */}
      <View style={styles.menuContainer}>
        {menuItems.map((item) => (
          <TouchableOpacity
            key={item.label}
            style={styles.menuItem}
            onPress={item.onPress}
            activeOpacity={0.6}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name={item.icon} size={22} color="#374151" />
              <Text style={styles.menuItemLabel}>{item.label}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        ))}
      </View>

      {/* Notifications section */}
      <Text style={styles.sectionTitle}>Notifications</Text>
      <View style={styles.menuContainer}>
        <View style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="chatbox-outline" size={22} color="#374151" />
            <Text style={styles.menuItemLabel}>SMS reminders</Text>
          </View>
          <Switch
            value={notifySms}
            onValueChange={(val) => { setNotifySms(val); updatePreference('notify_sms', val); }}
            disabled={toggling}
            trackColor={{ false: '#e5e7eb', true: '#6B7FC4' }}
            thumbColor="#fff"
          />
        </View>
        <View style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="notifications-outline" size={22} color="#374151" />
            <Text style={styles.menuItemLabel}>Push notifications</Text>
          </View>
          <Switch
            value={notifyPush}
            onValueChange={(val) => { setNotifyPush(val); updatePreference('notify_push', val); }}
            disabled={toggling}
            trackColor={{ false: '#e5e7eb', true: '#6B7FC4' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Sign out */}
      <View style={[styles.menuContainer, { marginTop: 16 }]}>
        <TouchableOpacity
          style={styles.menuItem}
          onPress={handleSignOut}
          activeOpacity={0.6}
        >
          <View style={styles.menuItemLeft}>
            <Ionicons name="log-out-outline" size={22} color="#dc2626" />
            <Text style={[styles.menuItemLabel, styles.menuItemLabelDanger]}>
              Sign Out
            </Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  content: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6B7FC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 14,
  },
  avatarText: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
  },
  nameText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  emailText: {
    fontSize: 14,
    color: '#6b7280',
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 8,
  },
  menuContainer: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 14,
    overflow: 'hidden',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuItemLabel: {
    fontSize: 15,
    fontWeight: '500',
    color: '#111827',
  },
  menuItemLabelDanger: {
    color: '#dc2626',
  },
});
