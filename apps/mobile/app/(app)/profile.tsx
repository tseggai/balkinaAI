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
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

// ── Types ────────────────────────────────────────────────────────────────────

interface CustomerProfile {
  id: string;
  display_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
  date_of_birth: string | null;
  gender: string | null;
  profile_image_url: string | null;
}

const GENDER_OPTIONS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'non-binary', label: 'Non-binary' },
  { value: 'prefer-not-to-say', label: 'Prefer not to say' },
];

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);

  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }, []);

  const fetchProfile = useCallback(async () => {
    const token = await getToken();
    if (!token) { setLoading(false); return; }

    try {
      const res = await fetch(`${API_BASE}/api/customers/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (json.data) {
        setProfile(json.data);
        setNotifySms(json.data.notify_sms ?? true);
        setNotifyPush(json.data.notify_push ?? true);
      }
    } catch {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata as { display_name?: string } | undefined;
        setProfile({
          id: user.id,
          display_name: meta?.display_name ?? null,
          first_name: null, last_name: null,
          phone: user.phone ?? null,
          email: user.email ?? null,
          date_of_birth: null, gender: null, profile_image_url: null,
        });
      }
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const updatePreference = useCallback(async (field: string, value: boolean) => {
    setToggling(true);
    const token = await getToken();
    if (!token) { setToggling(false); return; }

    try {
      await fetch(`${API_BASE}/api/customers/preferences`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: value }),
      });
    } catch {
      if (field === 'notify_sms') setNotifySms(!value);
      if (field === 'notify_push') setNotifyPush(!value);
    } finally {
      setToggling(false);
    }
  }, [getToken]);

  const handleDeleteAccount = useCallback(() => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account and all your data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) {
                Alert.alert('Error', 'Please sign in again to delete your account.');
                return;
              }
              const res = await fetch(`${API_BASE}/api/customers/profile`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                Alert.alert('Error', (data as { error?: string }).error || 'Failed to delete account. Please try again.');
                return;
              }
              await supabase.auth.signOut();
              Alert.alert('Account Deleted', 'Your account and data have been permanently deleted.');
            } catch {
              Alert.alert('Error', 'Network error. Please try again.');
            }
          },
        },
      ],
    );
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

  const fullName = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ');
  const displayName = fullName || profile?.display_name || profile?.email || 'Guest';
  const initial = (displayName.charAt(0) || '?').toUpperCase();

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar section */}
        <View style={styles.avatarSection}>
          {profile?.profile_image_url ? (
            <Image source={{ uri: profile.profile_image_url }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{initial}</Text>
            </View>
          )}
          <Text style={styles.nameText}>{displayName}</Text>
          {profile?.email ? <Text style={styles.subtitleText}>{profile.email}</Text> : null}
          {profile?.phone ? <Text style={styles.subtitleText}>{profile.phone}</Text> : null}
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
                <Text style={styles.cardRowSub}>Receive booking reminders via text</Text>
              </View>
            </View>
            <Switch
              value={notifySms}
              onValueChange={(val) => { setNotifySms(val); updatePreference('notify_sms', val); }}
              disabled={toggling}
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
                <Text style={styles.cardRowSub}>Get notified about booking updates</Text>
              </View>
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

        {/* Account actions */}
        <View style={[styles.card, { marginTop: 24 }]}>
          <TouchableOpacity style={styles.cardRow} onPress={handleDeleteAccount} activeOpacity={0.6}>
            <View style={styles.cardRowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#FEE2E2' }]}>
                <Ionicons name="trash-outline" size={18} color="#dc2626" />
              </View>
              <Text style={[styles.cardRowLabel, { color: '#dc2626' }]}>Delete Account</Text>
            </View>
          </TouchableOpacity>
          <View style={styles.separator} />
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

      {profile && (
        <EditProfileModal
          visible={editModalVisible}
          profile={profile}
          onClose={() => setEditModalVisible(false)}
          onSaved={(updated) => { setProfile(updated); setEditModalVisible(false); }}
          getToken={getToken}
        />
      )}
    </View>
  );
}

// ── Edit Profile Modal ───────────────────────────────────────────────────────

function EditProfileModal({
  visible,
  profile,
  onClose,
  onSaved,
  getToken,
}: {
  visible: boolean;
  profile: CustomerProfile;
  onClose: () => void;
  onSaved: (updated: CustomerProfile) => void;
  getToken: () => Promise<string | null>;
}) {
  const [firstName, setFirstName] = useState(profile.first_name ?? '');
  const [lastName, setLastName] = useState(profile.last_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [birthdayMonth, setBirthdayMonth] = useState('');
  const [birthdayDay, setBirthdayDay] = useState('');
  const [gender, setGender] = useState(profile.gender ?? '');
  const [avatarUri, setAvatarUri] = useState<string | null>(profile.profile_image_url ?? null);
  const [newAvatarLocal, setNewAvatarLocal] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);

  useEffect(() => {
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setPhone(profile.phone ?? '');
    // Parse date_of_birth (YYYY-MM-DD) into month/day
    if (profile.date_of_birth) {
      const parts = profile.date_of_birth.split('T')[0].split('-');
      setBirthdayMonth(parts[1] ?? '');
      setBirthdayDay(parts[2] ?? '');
    } else {
      setBirthdayMonth('');
      setBirthdayDay('');
    }
    setGender(profile.gender ?? '');
    setAvatarUri(profile.profile_image_url ?? null);
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

      // Build FormData with the image file
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
      const displayName = [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');

      // Build birthday as YYYY-MM-DD (using 2000 as placeholder year)
      let birthdayValue: string | null = null;
      const mm = birthdayMonth.trim().padStart(2, '0');
      const dd = birthdayDay.trim().padStart(2, '0');
      if (mm && dd && parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12 && parseInt(dd, 10) >= 1 && parseInt(dd, 10) <= 31) {
        birthdayValue = `2000-${mm}-${dd}`;
      }

      // Only include profile_image_url when a new image was actually picked
      const payload: Record<string, unknown> = {
        display_name: displayName,
        first_name: firstName.trim(),
        last_name: lastName.trim() || undefined,
        phone: phone.trim() || undefined,
        date_of_birth: birthdayValue,
        gender: gender || null,
      };

      if (newAvatarLocal) {
        const uploadedUrl = await uploadAvatar();
        if (uploadedUrl) {
          payload.profile_image_url = uploadedUrl;
        }
      }

      const res = await fetch(`${API_BASE}/api/customers/profile`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (json.data) {
        onSaved(json.data);
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
  const initial = ((profile.first_name ?? profile.display_name ?? profile.email ?? '?').charAt(0) || '?').toUpperCase();

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
            <View style={styles.formDivider} />

            <View style={styles.formRow}>
              <Text style={styles.formLabel}>Birthday</Text>
              <View style={styles.birthdayRow}>
                <TextInput
                  style={styles.birthdayInput}
                  value={birthdayMonth}
                  onChangeText={(t) => setBirthdayMonth(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  placeholder="MM"
                  placeholderTextColor="#c9cdd4"
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text style={styles.birthdaySep}>/</Text>
                <TextInput
                  style={styles.birthdayInput}
                  value={birthdayDay}
                  onChangeText={(t) => setBirthdayDay(t.replace(/[^0-9]/g, '').slice(0, 2))}
                  placeholder="DD"
                  placeholderTextColor="#c9cdd4"
                  keyboardType="number-pad"
                  maxLength={2}
                />
              </View>
            </View>
            <View style={styles.formDivider} />

            <TouchableOpacity style={styles.formRow} onPress={() => setGenderPickerVisible(true)}>
              <Text style={styles.formLabel}>Gender</Text>
              <View style={styles.formSelectRow}>
                <Text style={gender ? styles.formSelectText : styles.formSelectPlaceholder}>
                  {GENDER_OPTIONS.find((o) => o.value === gender)?.label || 'Select'}
                </Text>
                <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
              </View>
            </TouchableOpacity>
          </View>

          <Text style={styles.formHint}>
            Email is linked to your account and cannot be changed here.
          </Text>
        </ScrollView>

        {/* Gender Picker */}
        <Modal visible={genderPickerVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setGenderPickerVisible(false)}
          >
            <View style={styles.pickerSheet}>
              <View style={styles.pickerHandle} />
              <Text style={styles.pickerTitle}>Select Gender</Text>
              {GENDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[styles.pickerOption, gender === option.value && styles.pickerOptionActive]}
                  onPress={() => { setGender(option.value); setGenderPickerVisible(false); }}
                >
                  <Text style={[styles.pickerOptionText, gender === option.value && styles.pickerOptionTextActive]}>
                    {option.label}
                  </Text>
                  {gender === option.value && <Ionicons name="checkmark-circle" size={22} color="#6B7FC4" />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={[styles.pickerOption, { marginTop: 4 }]}
                onPress={() => { setGender(''); setGenderPickerVisible(false); }}
              >
                <Text style={[styles.pickerOptionText, { color: '#9ca3af' }]}>Clear Selection</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
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
  subtitleText: { fontSize: 14, color: '#6b7280', marginTop: 3 },

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
  birthdayRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  birthdayInput: {
    width: 42, fontSize: 15, color: '#111827', textAlign: 'center', paddingVertical: 0,
  },
  birthdaySep: { fontSize: 15, color: '#9ca3af' },
  formSelectRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  formSelectText: { fontSize: 15, color: '#111827' },
  formSelectPlaceholder: { fontSize: 15, color: '#c9cdd4' },
  formHint: {
    fontSize: 12, color: '#9ca3af', marginTop: 16, textAlign: 'center', paddingHorizontal: 20,
  },

  // Gender picker
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end',
  },
  pickerSheet: {
    backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 24, paddingHorizontal: 8,
  },
  pickerHandle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#e5e7eb',
    alignSelf: 'center', marginTop: 10, marginBottom: 12,
  },
  pickerTitle: {
    fontSize: 17, fontWeight: '600', color: '#111827', textAlign: 'center',
    paddingVertical: 12, marginBottom: 4,
  },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 14, marginHorizontal: 8, borderRadius: 12,
  },
  pickerOptionActive: { backgroundColor: '#F0F2FF' },
  pickerOptionText: { fontSize: 16, color: '#111827' },
  pickerOptionTextActive: { color: '#6B7FC4', fontWeight: '600' },
});
