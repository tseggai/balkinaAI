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
  TextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, getAuthenticatedRole } from '@/lib/supabase';
import type { StaffInfo } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

interface StaffProfileData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  tenant_name: string | null;
}

export default function StaffProfile() {
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [profileData, setProfileData] = useState<StaffProfileData | null>(null);
  const [email, setEmail] = useState('');
  const [tenantName, setTenantName] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [loading, setLoading] = useState(true);
  const [togglingApproval, setTogglingApproval] = useState(false);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [togglingNotif, setTogglingNotif] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const fetchProfile = useCallback(async () => {
    const { staffInfo: info } = await getAuthenticatedRole();
    setStaffInfo(info ?? null);

    const { data: { user } } = await supabase.auth.getUser();
    if (user) setEmail(user.email ?? '');

    if (info) {
      setRequiresApproval(info.requires_approval);

      // Fetch full profile from API
      const token = await getToken();
      if (token) {
        try {
          const res = await fetch(`${API_BASE}/api/staff/profile`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const json = await res.json();
          if (json.data) {
            setProfileData(json.data);
            setTenantName(json.data.tenant_name ?? '');
            setNotifySms(json.data.notify_sms ?? true);
            setNotifyPush(json.data.notify_push ?? true);
          }
        } catch {
          // Fallback to direct queries
          const { data: tenant } = await supabase
            .from('tenants')
            .select('name')
            .eq('id', info.tenant_id)
            .single();
          if (tenant) setTenantName((tenant as { name: string }).name);

          const { data: staffPrefs } = await supabase
            .from('staff')
            .select('notify_sms, notify_push')
            .eq('id', info.id)
            .single();
          if (staffPrefs) {
            const sp = staffPrefs as { notify_sms: boolean | null; notify_push: boolean | null };
            setNotifySms(sp.notify_sms ?? true);
            setNotifyPush(sp.notify_push ?? true);
          }

          setProfileData({
            id: info.id,
            name: info.name,
            email: user?.email ?? null,
            phone: null,
            image_url: null,
            tenant_name: (tenant as { name: string } | null)?.name ?? null,
          });
        }
      }
    }

    setLoading(false);
  }, [getToken]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const toggleApproval = useCallback(async (value: boolean) => {
    setTogglingApproval(true);
    setRequiresApproval(value);
    const token = await getToken();
    if (!token) { setTogglingApproval(false); return; }

    try {
      await fetch(`${API_BASE}/api/staff/availability`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ requires_approval: value }),
      });
    } catch {
      setRequiresApproval(!value);
    } finally {
      setTogglingApproval(false);
    }
  }, [getToken]);

  const updateNotifPref = useCallback(async (field: string, value: boolean) => {
    setTogglingNotif(true);
    const token = await getToken();
    if (!token) { setTogglingNotif(false); return; }

    try {
      await fetch(`${API_BASE}/api/staff/profile`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      if (field === 'notify_sms') setNotifySms(!value);
      if (field === 'notify_push') setNotifyPush(!value);
    } finally {
      setTogglingNotif(false);
    }
  }, [getToken]);

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }, []);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;
  }

  const displayName = profileData?.name ?? staffInfo?.name ?? 'Staff Member';
  const initial = (displayName.charAt(0) || '?').toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initial}</Text>
          </View>
          <Text style={styles.nameText}>{displayName}</Text>
          {email ? <Text style={styles.emailText}>{email}</Text> : null}
          {profileData?.phone ? <Text style={styles.emailText}>{profileData.phone}</Text> : null}
          {tenantName ? <Text style={styles.tenantText}>{tenantName}</Text> : null}
        </View>

        {/* Edit Profile */}
        <View style={styles.menuContainer}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.6}
          >
            <View style={styles.menuItemLeft}>
              <Ionicons name="create-outline" size={22} color="#374151" />
              <Text style={styles.menuItemLabel}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
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
        </View>

        {/* Notifications */}
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.menuContainer}>
          <View style={styles.menuItem}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="chatbox-outline" size={22} color="#374151" />
              <Text style={styles.menuItemLabel}>SMS reminders</Text>
            </View>
            <Switch
              value={notifySms}
              onValueChange={(val) => { setNotifySms(val); updateNotifPref('notify_sms', val); }}
              disabled={togglingNotif}
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
              onValueChange={(val) => { setNotifyPush(val); updateNotifPref('notify_push', val); }}
              disabled={togglingNotif}
              trackColor={{ false: '#e5e7eb', true: '#6B7FC4' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Sign out */}
        <View style={[styles.menuContainer, { marginTop: 16 }]}>
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut} activeOpacity={0.6}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={22} color="#dc2626" />
              <Text style={[styles.menuItemLabel, { color: '#dc2626' }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Edit Profile Modal */}
      {profileData && (
        <EditStaffModal
          visible={editModalVisible}
          profile={profileData}
          onClose={() => setEditModalVisible(false)}
          onSaved={(updated) => {
            setProfileData(updated);
            setEditModalVisible(false);
          }}
          getToken={getToken}
        />
      )}
    </View>
  );
}

// ── Edit Staff Profile Modal ─────────────────────────────────────────────────

function EditStaffModal({
  visible,
  profile,
  onClose,
  onSaved,
  getToken,
}: {
  visible: boolean;
  profile: StaffProfileData;
  onClose: () => void;
  onSaved: (updated: StaffProfileData) => void;
  getToken: () => Promise<string | null>;
}) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setName(profile.name);
    setPhone(profile.phone ?? '');
  }, [profile]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Name is required.');
      return;
    }

    setSaving(true);
    const token = await getToken();
    if (!token) { setSaving(false); return; }

    try {
      const res = await fetch(`${API_BASE}/api/staff/profile`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          phone: phone.trim() || undefined,
        }),
      });

      const json = await res.json();
      if (json.success) {
        onSaved({ ...profile, name: name.trim(), phone: phone.trim() || null });
      } else {
        Alert.alert('Error', json.error ?? 'Failed to update profile');
      }
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} disabled={saving}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving}>
            {saving ? (
              <ActivityIndicator size="small" color="#6B7FC4" />
            ) : (
              <Text style={styles.modalSave}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={styles.modalBodyContent}>
          <Text style={styles.fieldLabel}>Name *</Text>
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.fieldLabel}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="+1 (555) 000-0000"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
          />

          <Text style={styles.fieldHint}>
            Email is managed by your account and cannot be changed here.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  content: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#6B7FC4',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  nameText: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emailText: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  tenantText: { fontSize: 14, color: '#6B7FC4', marginTop: 4, fontWeight: '500' },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: 0.5, marginHorizontal: 20, marginTop: 24, marginBottom: 8,
  },
  menuContainer: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14, flex: 1 },
  menuItemLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  menuItemSub: { fontSize: 12, color: '#9ca3af', marginTop: 2 },

  // Modal styles
  modalContainer: { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#e5e7eb',
  },
  modalCancel: { fontSize: 16, color: '#6b7280' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
  modalSave: { fontSize: 16, fontWeight: '600', color: '#6B7FC4' },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20, paddingBottom: 40 },
  fieldLabel: {
    fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16,
  },
  input: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb',
  },
  fieldHint: { fontSize: 12, color: '#9ca3af', marginTop: 20, textAlign: 'center' },
});
