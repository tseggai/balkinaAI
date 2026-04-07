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
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase, getAuthenticatedRole } from '@/lib/supabase';
import type { StaffInfo } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface StaffProfileData {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  image_url: string | null;
  profession: string | null;
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
          const { data: tenant } = await supabase
            .from('tenants').select('name').eq('id', info.tenant_id).single();
          if (tenant) setTenantName((tenant as { name: string }).name);

          const { data: staffPrefs } = await supabase
            .from('staff').select('notify_sms, notify_push').eq('id', info.id).single();
          if (staffPrefs) {
            const sp = staffPrefs as { notify_sms: boolean | null; notify_push: boolean | null };
            setNotifySms(sp.notify_sms ?? true);
            setNotifyPush(sp.notify_push ?? true);
          }

          setProfileData({
            id: info.id, name: info.name,
            email: user?.email ?? null, phone: null,
            image_url: null, profession: null,
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
          {profileData?.image_url ? (
            <Image source={{ uri: profileData.image_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <Text style={styles.nameText}>{displayName}</Text>
          {profileData?.profession ? (
            <Text style={styles.professionText}>{profileData.profession}</Text>
          ) : null}
          {email ? <Text style={styles.subtitleText}>{email}</Text> : null}
          {profileData?.phone ? <Text style={styles.subtitleText}>{profileData.phone}</Text> : null}
          {tenantName ? (
            <View style={styles.tenantBadge}>
              <Ionicons name="business-outline" size={13} color="#6B7FC4" />
              <Text style={styles.tenantBadgeText}>{tenantName}</Text>
            </View>
          ) : null}
        </View>

        {/* Edit Profile */}
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.cardRow}
            onPress={() => setEditModalVisible(true)}
            activeOpacity={0.6}
          >
            <View style={styles.cardRowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#EEF0FB' }]}>
                <Ionicons name="person-outline" size={18} color="#6B7FC4" />
              </View>
              <Text style={styles.cardRowLabel}>Edit Profile</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <View style={styles.cardRowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#F3E8FF' }]}>
                <Ionicons name="checkmark-circle-outline" size={18} color="#7C3AED" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardRowLabel}>Require Booking Approval</Text>
                <Text style={styles.cardRowSub}>New bookings need your confirmation</Text>
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
        <View style={styles.card}>
          <View style={[styles.cardRow, styles.cardRowBorder]}>
            <View style={styles.cardRowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEF3C7' }]}>
                <Ionicons name="chatbox-outline" size={18} color="#D97706" />
              </View>
              <View>
                <Text style={styles.cardRowLabel}>SMS Reminders</Text>
                <Text style={styles.cardRowSub}>Get notified about new bookings via text</Text>
              </View>
            </View>
            <Switch
              value={notifySms}
              onValueChange={(val) => { setNotifySms(val); updateNotifPref('notify_sms', val); }}
              disabled={togglingNotif}
              trackColor={{ false: '#e5e7eb', true: '#6B7FC4' }}
              thumbColor="#fff"
            />
          </View>
          <View style={styles.cardRow}>
            <View style={styles.cardRowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#DBEAFE' }]}>
                <Ionicons name="notifications-outline" size={18} color="#2563EB" />
              </View>
              <View>
                <Text style={styles.cardRowLabel}>Push Notifications</Text>
                <Text style={styles.cardRowSub}>Instant alerts for booking updates</Text>
              </View>
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
        <View style={[styles.card, { marginTop: 24 }]}>
          <TouchableOpacity style={styles.cardRow} onPress={handleSignOut} activeOpacity={0.6}>
            <View style={styles.cardRowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="log-out-outline" size={18} color="#dc2626" />
              </View>
              <Text style={[styles.cardRowLabel, { color: '#dc2626' }]}>Sign Out</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {profileData && (
        <EditStaffModal
          visible={editModalVisible}
          profile={profileData}
          onClose={() => setEditModalVisible(false)}
          onSaved={(updated) => { setProfileData(updated); setEditModalVisible(false); }}
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
  // Split existing name into first/last for editing
  const nameParts = (profile.name || '').trim().split(/\s+/);
  const [firstName, setFirstName] = useState(nameParts[0] || '');
  const [lastName, setLastName] = useState(nameParts.slice(1).join(' ') || '');
  const [profession, setProfession] = useState(profile.profession ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile.image_url ?? null);
  const [newAvatarLocal, setNewAvatarLocal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const parts = (profile.name || '').trim().split(/\s+/);
    setFirstName(parts[0] || '');
    setLastName(parts.slice(1).join(' ') || '');
    setProfession(profile.profession ?? '');
    setPhone(profile.phone ?? '');
    setAvatarUri(profile.image_url ?? null);
    setNewAvatarLocal(null);
  }, [profile]);

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setNewAvatarLocal(result.assets[0].uri);
      setAvatarUri(result.assets[0].uri);
    }
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!newAvatarLocal) return null;

    try {
      const token = await getToken();
      if (!token) return null;

      const uriParts = newAvatarLocal.split('.');
      const fileExt = uriParts[uriParts.length - 1] ?? 'jpg';

      const formData = new FormData();
      formData.append('file', {
        uri: newAvatarLocal,
        name: `avatar.${fileExt}`,
        type: `image/${fileExt === 'jpg' ? 'jpeg' : fileExt}`,
      } as unknown as Blob);

      const res = await fetch(`${API_BASE}/api/avatar`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });

      const json = await res.json();
      if (json.url) return json.url;

      console.warn('[avatar-upload] failed:', json.error);
      return null;
    } catch (err) {
      console.warn('[avatar-upload] error:', err);
      return null;
    }
  };

  const handleSave = async () => {
    if (!firstName.trim()) {
      Alert.alert('Required', 'First name is required.');
      return;
    }

    setSaving(true);
    const token = await getToken();
    if (!token) { setSaving(false); return; }

    try {
      const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

      // Only include image_url when a new image was actually picked
      const payload: Record<string, unknown> = {
        name: fullName,
        phone: phone.trim() || undefined,
        profession: profession.trim() || null,
      };

      let finalImageUrl = profile.image_url;
      if (newAvatarLocal) {
        const uploadedUrl = await uploadAvatar();
        if (uploadedUrl) {
          payload.image_url = uploadedUrl;
          finalImageUrl = uploadedUrl;
        }
      }

      const res = await fetch(`${API_BASE}/api/staff/profile`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.success) {
        onSaved({
          ...profile,
          name: fullName,
          phone: phone.trim() || null,
          profession: profession.trim() || null,
          image_url: finalImageUrl,
        });
      } else {
        Alert.alert('Error', json.error ?? 'Failed to update profile');
      }
    } catch {
      Alert.alert('Error', 'Failed to update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const currentAvatar = avatarUri;
  const initial = (firstName || profile.name || '?').charAt(0).toUpperCase();

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <KeyboardAvoidingView
        style={styles.modalContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} disabled={saving} style={styles.headerBtn}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerBtn}>
            {saving ? (
              <ActivityIndicator size="small" color="#6B7FC4" />
            ) : (
              <Text style={styles.modalSave}>Save</Text>
            )}
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.modalBody}
          contentContainerStyle={styles.modalBodyContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Profile Photo */}
          <TouchableOpacity style={styles.photoSection} onPress={handlePickImage} activeOpacity={0.7}>
            {currentAvatar ? (
              <Image source={{ uri: currentAvatar }} style={styles.photoImage} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={styles.photoPlaceholderText}>{initial}</Text>
              </View>
            )}
            <View style={styles.photoBadge}>
              <Ionicons name="camera" size={14} color="#fff" />
            </View>
          </TouchableOpacity>
          <Text style={styles.photoLabel}>Change Photo</Text>

          {/* Form Fields */}
          <View style={styles.formCard}>
            <View style={styles.formRow}>
              <Text style={styles.formLabel}>First Name</Text>
              <TextInput
                style={styles.formInput}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#c9cdd4"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.formDivider} />

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Last Name</Text>
              <TextInput
                style={styles.formInput}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#c9cdd4"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.formDivider} />

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Title</Text>
              <TextInput
                style={styles.formInput}
                value={profession}
                onChangeText={setProfession}
                placeholder="e.g. Senior Stylist"
                placeholderTextColor="#c9cdd4"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.formDivider} />

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Email</Text>
              <Text style={styles.formValueReadonly}>{profile.email ?? 'Not set'}</Text>
            </View>
            <View style={styles.formDivider} />

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Phone</Text>
              <TextInput
                style={styles.formInput}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 000-0000"
                placeholderTextColor="#c9cdd4"
                keyboardType="phone-pad"
              />
            </View>
          </View>

          <Text style={styles.formHint}>
            Email is managed by your account and cannot be changed here.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  // Main screen
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  content: { paddingBottom: 40 },

  avatarSection: { alignItems: 'center', paddingTop: 32, paddingBottom: 24 },
  avatar: {
    width: 88, height: 88, borderRadius: 44, backgroundColor: '#6B7FC4',
    justifyContent: 'center', alignItems: 'center', marginBottom: 16,
  },
  avatarImage: {
    width: 88, height: 88, borderRadius: 44, marginBottom: 16,
    borderWidth: 3, borderColor: '#EEF0FB',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  nameText: { fontSize: 22, fontWeight: '700', color: '#111827' },
  professionText: { fontSize: 14, color: '#6B7FC4', fontWeight: '500', marginTop: 2 },
  subtitleText: { fontSize: 14, color: '#6b7280', marginTop: 3 },
  tenantBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: '#EEF0FB', paddingHorizontal: 12, paddingVertical: 5,
    borderRadius: 20, marginTop: 10,
  },
  tenantBadgeText: { fontSize: 13, color: '#6B7FC4', fontWeight: '600' },

  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase',
    letterSpacing: 0.8, marginHorizontal: 20, marginTop: 28, marginBottom: 10,
  },

  card: {
    backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04,
    shadowRadius: 4, elevation: 1,
  },
  cardRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  cardRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  cardRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  iconCircle: {
    width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  cardRowLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  cardRowSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  headerBtn: { minWidth: 60 },
  modalCancel: { fontSize: 16, color: '#6b7280' },
  modalTitle: { fontSize: 17, fontWeight: '600', color: '#111827' },
  modalSave: { fontSize: 16, fontWeight: '600', color: '#6B7FC4', textAlign: 'right' },
  modalBody: { flex: 1 },
  modalBodyContent: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 40 },

  // Photo
  photoSection: { alignSelf: 'center', marginBottom: 8 },
  photoImage: {
    width: 100, height: 100, borderRadius: 50,
    borderWidth: 3, borderColor: '#EEF0FB',
  },
  photoPlaceholder: {
    width: 100, height: 100, borderRadius: 50, backgroundColor: '#6B7FC4',
    justifyContent: 'center', alignItems: 'center',
  },
  photoPlaceholderText: { color: '#fff', fontSize: 36, fontWeight: '700' },
  photoBadge: {
    position: 'absolute', bottom: 2, right: 2,
    width: 30, height: 30, borderRadius: 15, backgroundColor: '#6B7FC4',
    justifyContent: 'center', alignItems: 'center',
    borderWidth: 3, borderColor: '#f9fafb',
  },
  photoLabel: {
    textAlign: 'center', fontSize: 14, color: '#6B7FC4', fontWeight: '500', marginBottom: 24,
  },

  // Form card
  formCard: {
    backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden',
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04,
    shadowRadius: 4, elevation: 1,
  },
  formRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  formDivider: { height: 1, backgroundColor: '#f3f4f6', marginLeft: 16 },
  formLabel: { fontSize: 15, fontWeight: '500', color: '#374151', width: 100 },
  formInput: {
    flex: 1, fontSize: 15, color: '#111827', textAlign: 'right', paddingVertical: 0,
  },
  formValueReadonly: {
    flex: 1, fontSize: 15, color: '#9ca3af', textAlign: 'right',
  },
  formHint: {
    fontSize: 12, color: '#9ca3af', marginTop: 16, textAlign: 'center', paddingHorizontal: 20,
  },
});
