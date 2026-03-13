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
import { supabase, getAuthenticatedRole } from '@/lib/supabase';
import type { StaffInfo } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

export default function StaffProfile() {
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [email, setEmail] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [togglingApproval, setTogglingApproval] = useState(false);

  const fetchProfile = useCallback(async () => {
    const { staffInfo: info } = await getAuthenticatedRole();
    setStaffInfo(info ?? null);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) setEmail(user.email ?? '');

    if (info) {
      // Get tenant name
      const { data: tenant } = await supabase
        .from('tenants')
        .select('name')
        .eq('id', info.tenant_id)
        .single();
      if (tenant) setTenantName((tenant as { name: string }).name);

      setRequiresApproval(info.requires_approval);
    }

    setLoading(false);
  }, []);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const toggleApproval = useCallback(async (value: boolean) => {
    setTogglingApproval(true);
    setRequiresApproval(value);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setTogglingApproval(false); return; }

    try {
      await fetch(`${API_BASE}/api/staff/availability`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ requires_approval: value }),
      });
    } catch {
      setRequiresApproval(!value); // Revert on failure
    } finally {
      setTogglingApproval(false);
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

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;
  }

  const initial = (staffInfo?.name?.charAt(0) ?? '?').toUpperCase();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar section */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initial}</Text>
        </View>
        <Text style={styles.nameText}>{staffInfo?.name ?? 'Staff Member'}</Text>
        {email ? <Text style={styles.emailText}>{email}</Text> : null}
        {tenantName ? <Text style={styles.tenantText}>{tenantName}</Text> : null}
      </View>

      {/* Settings */}
      <View style={styles.menuContainer}>
        <View style={styles.menuItem}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="checkmark-circle-outline" size={22} color="#374151" />
            <View>
              <Text style={styles.menuItemLabel}>Require booking approval</Text>
              <Text style={styles.menuItemSub}>New bookings need your confirmation</Text>
            </View>
          </View>
          <Switch
            value={requiresApproval}
            onValueChange={toggleApproval}
            disabled={togglingApproval}
            trackColor={{ false: '#e5e7eb', true: '#6B7FC4' }}
            thumbColor="#fff"
          />
        </View>

        <TouchableOpacity style={styles.menuItem} onPress={handleSignOut} activeOpacity={0.6}>
          <View style={styles.menuItemLeft}>
            <Ionicons name="log-out-outline" size={22} color="#dc2626" />
            <Text style={[styles.menuItemLabel, { color: '#dc2626' }]}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  content: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center', marginBottom: 14 },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  nameText: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emailText: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  tenantText: { fontSize: 14, color: '#6B7FC4', marginTop: 4, fontWeight: '500' },
  menuContainer: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuItemLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  menuItemSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
});
