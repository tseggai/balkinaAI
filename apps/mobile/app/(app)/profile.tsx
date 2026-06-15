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
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

// White-label accent: the property's primary color on property builds,
// Balkina's periwinkle everywhere else (so the Balkina app is unchanged).
const ACCENT = (Constants.expoConfig?.extra?.primaryColor as string | undefined) ?? '#6B7FC4';

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
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isTenantOwner, setIsTenantOwner] = useState(false);
  const [notifySms, setNotifySms] = useState(true);
  const [notifyPush, setNotifyPush] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);

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
    // Check if user is also a tenant owner
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (authUser) {
        const { data: tenantCheck } = await supabase.from('tenants').select('id').eq('user_id', authUser.id).maybeSingle();
        setIsTenantOwner(!!tenantCheck);
      }
    } catch {}
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
    return <View style={styles.centered}><ActivityIndicator size="large" color={ACCENT} /></View>;
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
          <TouchableOpacity style={styles.cardRow} onPress={() => setEditModalVisible(true)} activeOpacity={0.6}>
            <View style={styles.cardRowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#EEF0FB' }]}>
                <Ionicons name="person-outline" size={18} color={ACCENT} />
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
              trackColor={{ false: '#e5e7eb', true: ACCENT }}
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
              trackColor={{ false: '#e5e7eb', true: ACCENT }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>General</Text>
        <View style={styles.card}>
          <TouchableOpacity style={styles.cardRow} onPress={() => setSettingsVisible(true)} activeOpacity={0.6}>
            <View style={styles.cardRowLeft}>
              <View style={[styles.iconCircle, { backgroundColor: '#F3F4F6' }]}>
                <Ionicons name="settings-outline" size={18} color="#6b7280" />
              </View>
              <Text style={styles.cardRowLabel}>Settings</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
          </TouchableOpacity>
        </View>

        {/* Switch to Business (only if tenant owner) */}
        {isTenantOwner && (
          <View style={[styles.card, { marginTop: 24 }]}>
            <TouchableOpacity style={styles.cardRow} onPress={() => router.replace('/(tenant)/dashboard')} activeOpacity={0.6}>
              <View style={styles.cardRowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#EEF0FB' }]}>
                  <Ionicons name="swap-horizontal-outline" size={18} color={ACCENT} />
                </View>
                <View>
                  <Text style={styles.cardRowLabel}>Switch to Business</Text>
                  <Text style={styles.cardRowSub}>Manage your business</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
          </View>
        )}

        {/* Sign Out */}
        <View style={[styles.card, { marginTop: isTenantOwner ? 12 : 24 }]}>
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

      {/* Edit Profile Modal */}
      {profile && (
        <EditProfileModal
          visible={editModalVisible}
          profile={profile}
          onClose={() => setEditModalVisible(false)}
          onSaved={(updated) => { setProfile(updated); setEditModalVisible(false); }}
          getToken={getToken}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        onDeleteAccount={handleDeleteAccount}
      />
    </View>
  );
}

// ── Settings Modal ──────────────────────────────────────────────────────────

function SettingsModal({
  visible,
  onClose,
  onDeleteAccount,
}: {
  visible: boolean;
  onClose: () => void;
  onDeleteAccount: () => void;
}) {
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  // Reset state when modal closes
  useEffect(() => {
    if (!visible) {
      setDangerZoneExpanded(false);
      setDeleteConfirmText('');
    }
  }, [visible]);

  const isDeleteEnabled = deleteConfirmText.trim().toUpperCase() === 'DELETE';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
            <Ionicons name="arrow-back" size={24} color="#111827" />
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Settings</Text>
          <View style={styles.headerBtn} />
        </View>

        <ScrollView style={styles.modalBody} contentContainerStyle={{ paddingBottom: 60 }}>
          {/* Legal */}
          <Text style={[styles.sectionTitle, { marginTop: 16 }]}>Legal</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={[styles.cardRow, styles.cardRowBorder]}
              onPress={() => Linking.openURL('https://balkina.ai/terms')}
              activeOpacity={0.6}
            >
              <View style={styles.cardRowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#EEF0FB' }]}>
                  <Ionicons name="document-text-outline" size={18} color={ACCENT} />
                </View>
                <Text style={styles.cardRowLabel}>Terms of Service</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#d1d5db" />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => Linking.openURL('https://balkina.ai/privacy')}
              activeOpacity={0.6}
            >
              <View style={styles.cardRowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#EEF0FB' }]}>
                  <Ionicons name="shield-checkmark-outline" size={18} color={ACCENT} />
                </View>
                <Text style={styles.cardRowLabel}>Privacy Policy</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#d1d5db" />
            </TouchableOpacity>
          </View>

          {/* About */}
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.card}>
            <View style={[styles.cardRow, styles.cardRowBorder]}>
              <View style={styles.cardRowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#F3F4F6' }]}>
                  <Ionicons name="information-circle-outline" size={18} color="#6b7280" />
                </View>
                <Text style={styles.cardRowLabel}>App Version</Text>
              </View>
              <Text style={{ fontSize: 14, color: '#9ca3af' }}>1.0.0</Text>
            </View>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => Linking.openURL('mailto:support@balkina.ai')}
              activeOpacity={0.6}
            >
              <View style={styles.cardRowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#DBEAFE' }]}>
                  <Ionicons name="mail-outline" size={18} color="#2563EB" />
                </View>
                <Text style={styles.cardRowLabel}>Contact Support</Text>
              </View>
              <Ionicons name="open-outline" size={16} color="#d1d5db" />
            </TouchableOpacity>
          </View>

          {/* Danger Zone — collapsible */}
          <Text style={styles.sectionTitle}>Danger Zone</Text>
          <View style={styles.card}>
            <TouchableOpacity
              style={styles.cardRow}
              onPress={() => setDangerZoneExpanded(!dangerZoneExpanded)}
              activeOpacity={0.6}
            >
              <View style={styles.cardRowLeft}>
                <View style={[styles.iconCircle, { backgroundColor: '#FEF2F2' }]}>
                  <Ionicons name="warning-outline" size={18} color="#dc2626" />
                </View>
                <View>
                  <Text style={[styles.cardRowLabel, { color: '#dc2626' }]}>Delete Account</Text>
                  <Text style={styles.cardRowSub}>Permanently remove your account and data</Text>
                </View>
              </View>
              <Ionicons
                name={dangerZoneExpanded ? 'chevron-up' : 'chevron-down'}
                size={18}
                color="#d1d5db"
              />
            </TouchableOpacity>

            {dangerZoneExpanded && (
              <View style={styles.dangerZoneContent}>
                <Text style={styles.dangerZoneWarning}>
                  This action is irreversible. All your bookings, profile data, and preferences will be permanently deleted.
                </Text>
                <Text style={styles.dangerZonePrompt}>
                  Type <Text style={styles.dangerZoneDeleteWord}>DELETE</Text> to confirm:
                </Text>
                <TextInput
                  style={styles.dangerZoneInput}
                  value={deleteConfirmText}
                  onChangeText={setDeleteConfirmText}
                  placeholder="Type DELETE here"
                  placeholderTextColor="#d1d5db"
                  autoCapitalize="characters"
                  autoCorrect={false}
                />
                <TouchableOpacity
                  style={[
                    styles.dangerZoneButton,
                    !isDeleteEnabled && styles.dangerZoneButtonDisabled,
                  ]}
                  onPress={onDeleteAccount}
                  disabled={!isDeleteEnabled}
                  activeOpacity={0.6}
                >
                  <Ionicons name="trash-outline" size={16} color={isDeleteEnabled ? '#fff' : '#f9a8a8'} />
                  <Text
                    style={[
                      styles.dangerZoneButtonText,
                      !isDeleteEnabled && styles.dangerZoneButtonTextDisabled,
                    ]}
                  >
                    Delete My Account
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </Modal>
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
      return null;
    } catch {
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
      let birthdayValue: string | null = null;
      const mm = birthdayMonth.trim().padStart(2, '0');
      const dd = birthdayDay.trim().padStart(2, '0');
      if (mm && dd && parseInt(mm, 10) >= 1 && parseInt(mm, 10) <= 12 && parseInt(dd, 10) >= 1 && parseInt(dd, 10) <= 31) {
        birthdayValue = `2000-${mm}-${dd}`;
      }

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
        if (uploadedUrl) payload.profile_image_url = uploadedUrl;
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
        <View style={styles.modalHeader}>
          <TouchableOpacity onPress={onClose} disabled={saving} style={styles.headerBtn}>
            <Text style={styles.modalCancel}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.modalTitle}>Edit Profile</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.headerBtn}>
            {saving ? (
              <ActivityIndicator size="small" color={ACCENT} />
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
            <Text style={styles.photoChangeText}>Change photo</Text>
          </TouchableOpacity>

          {/* Form fields */}
          <View style={styles.formRow}>
            <View style={styles.formHalf}>
              <Text style={styles.label}>First Name *</Text>
              <TextInput
                style={styles.input}
                value={firstName}
                onChangeText={setFirstName}
                placeholder="First name"
                placeholderTextColor="#9ca3af"
              />
            </View>
            <View style={styles.formHalf}>
              <Text style={styles.label}>Last Name</Text>
              <TextInput
                style={styles.input}
                value={lastName}
                onChangeText={setLastName}
                placeholder="Last name"
                placeholderTextColor="#9ca3af"
              />
            </View>
          </View>

          <Text style={styles.label}>Phone</Text>
          <TextInput
            style={styles.input}
            value={phone}
            onChangeText={setPhone}
            placeholder="Phone number"
            placeholderTextColor="#9ca3af"
            keyboardType="phone-pad"
          />

          <Text style={styles.label}>Birthday (Month / Day)</Text>
          <View style={styles.formRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={birthdayMonth}
              onChangeText={setBirthdayMonth}
              placeholder="MM"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={2}
            />
            <Text style={styles.bdaySeparator}>/</Text>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={birthdayDay}
              onChangeText={setBirthdayDay}
              placeholder="DD"
              placeholderTextColor="#9ca3af"
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <Text style={styles.label}>Gender</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setGenderPickerVisible(!genderPickerVisible)}
            activeOpacity={0.7}
          >
            <Text style={{ color: gender ? '#111827' : '#9ca3af', fontSize: 15 }}>
              {gender ? GENDER_OPTIONS.find(g => g.value === gender)?.label ?? gender : 'Select gender'}
            </Text>
          </TouchableOpacity>
          {genderPickerVisible && (
            <View style={styles.genderPicker}>
              {GENDER_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.value}
                  style={[styles.genderOption, gender === opt.value && styles.genderOptionSelected]}
                  onPress={() => { setGender(opt.value); setGenderPickerVisible(false); }}
                >
                  <Text style={[styles.genderOptionText, gender === opt.value && styles.genderOptionTextSelected]}>
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}
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
  avatarSection: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  avatarImage: { width: 80, height: 80, borderRadius: 40 },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  nameText: { marginTop: 12, fontSize: 20, fontWeight: '700', color: '#111827' },
  subtitleText: { marginTop: 2, fontSize: 14, color: '#6b7280' },
  sectionTitle: { marginTop: 24, marginBottom: 8, marginLeft: 20, fontSize: 13, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { marginHorizontal: 16, backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6' },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  cardRowBorder: { borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  cardRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  cardRowLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  cardRowSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  iconCircle: { width: 34, height: 34, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#f9fafb' },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 16 : 12, paddingBottom: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  headerBtn: { width: 60, alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700', color: '#111827' },
  modalCancel: { fontSize: 15, color: '#6b7280' },
  modalSave: { fontSize: 15, fontWeight: '600', color: ACCENT },
  modalBody: { flex: 1 },
  modalBodyContent: { padding: 20, paddingBottom: 60 },

  // Photo
  photoSection: { alignItems: 'center', marginBottom: 24 },
  photoImage: { width: 88, height: 88, borderRadius: 44 },
  photoPlaceholder: { width: 88, height: 88, borderRadius: 44, backgroundColor: ACCENT, justifyContent: 'center', alignItems: 'center' },
  photoPlaceholderText: { fontSize: 34, fontWeight: '700', color: '#fff' },
  photoChangeText: { marginTop: 8, fontSize: 14, fontWeight: '600', color: ACCENT },

  // Form
  label: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 6, marginTop: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  formRow: { flexDirection: 'row', gap: 12 },
  formHalf: { flex: 1 },
  bdaySeparator: { fontSize: 20, color: '#9ca3af', alignSelf: 'center', marginTop: 16 },
  genderPicker: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginTop: 4, overflow: 'hidden' },
  genderOption: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  genderOptionSelected: { backgroundColor: '#EEF0FB' },
  genderOptionText: { fontSize: 15, color: '#374151' },
  genderOptionTextSelected: { color: ACCENT, fontWeight: '600' },

  // Danger Zone
  dangerZoneContent: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#FEE2E2' },
  dangerZoneWarning: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginTop: 12, marginBottom: 12 },
  dangerZonePrompt: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  dangerZoneDeleteWord: { color: '#dc2626', fontWeight: '700' },
  dangerZoneInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: '#111827', marginBottom: 12 },
  dangerZoneButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#dc2626', borderRadius: 10, paddingVertical: 12 },
  dangerZoneButtonDisabled: { backgroundColor: '#FEE2E2' },
  dangerZoneButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  dangerZoneButtonTextDisabled: { color: '#f9a8a8' },
});
