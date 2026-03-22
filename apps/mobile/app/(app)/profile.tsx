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
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

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

const GENDER_OPTIONS = ['Male', 'Female', 'Other', 'Prefer not to say'];

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
      // Fallback to auth user data
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata as { display_name?: string } | undefined;
        setProfile({
          id: user.id,
          display_name: meta?.display_name ?? null,
          first_name: null,
          last_name: null,
          phone: user.phone ?? null,
          email: user.email ?? null,
          date_of_birth: null,
          gender: null,
          profile_image_url: null,
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

  const handleSignOut = useCallback(() => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  }, []);

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;
  }

  const displayName = profile?.display_name ?? profile?.email ?? 'Guest';
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
          {profile?.email ? <Text style={styles.emailText}>{profile.email}</Text> : null}
          {profile?.phone ? <Text style={styles.emailText}>{profile.phone}</Text> : null}
        </View>

        {/* Menu items */}
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
          <TouchableOpacity style={styles.menuItem} onPress={handleSignOut} activeOpacity={0.6}>
            <View style={styles.menuItemLeft}>
              <Ionicons name="log-out-outline" size={22} color="#dc2626" />
              <Text style={[styles.menuItemLabel, styles.menuItemLabelDanger]}>Sign Out</Text>
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
          onSaved={(updated) => {
            setProfile(updated);
            setEditModalVisible(false);
          }}
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
  const [displayName, setDisplayName] = useState(profile.display_name ?? '');
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [dateOfBirth, setDateOfBirth] = useState(profile.date_of_birth ?? '');
  const [gender, setGender] = useState(profile.gender ?? '');
  const [saving, setSaving] = useState(false);
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);

  // Reset form when profile changes
  useEffect(() => {
    setFirstName(profile.first_name ?? '');
    setLastName(profile.last_name ?? '');
    setDisplayName(profile.display_name ?? '');
    setPhone(profile.phone ?? '');
    setDateOfBirth(profile.date_of_birth ?? '');
    setGender(profile.gender ?? '');
  }, [profile]);

  const handleSave = async () => {
    if (!displayName.trim()) {
      Alert.alert('Required', 'Display name is required.');
      return;
    }

    setSaving(true);
    const token = await getToken();
    if (!token) { setSaving(false); return; }

    try {
      const res = await fetch(`${API_BASE}/api/customers/profile`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName.trim(),
          first_name: firstName.trim() || undefined,
          last_name: lastName.trim() || undefined,
          phone: phone.trim() || undefined,
          date_of_birth: dateOfBirth.trim() || null,
          gender: gender || null,
        }),
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
          <Text style={styles.fieldLabel}>Display Name *</Text>
          <TextInput
            style={styles.input}
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How you appear to businesses"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.fieldLabel}>First Name</Text>
          <TextInput
            style={styles.input}
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor="#9ca3af"
          />

          <Text style={styles.fieldLabel}>Last Name</Text>
          <TextInput
            style={styles.input}
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
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

          <Text style={styles.fieldLabel}>Date of Birth</Text>
          <TextInput
            style={styles.input}
            value={dateOfBirth}
            onChangeText={setDateOfBirth}
            placeholder="YYYY-MM-DD"
            placeholderTextColor="#9ca3af"
            keyboardType="numbers-and-punctuation"
          />

          <Text style={styles.fieldLabel}>Gender</Text>
          <TouchableOpacity
            style={styles.input}
            onPress={() => setGenderPickerVisible(true)}
          >
            <Text style={gender ? styles.inputText : styles.placeholderText}>
              {gender || 'Select gender'}
            </Text>
          </TouchableOpacity>

          <Text style={styles.fieldHint}>
            Email cannot be changed here. Contact support if you need to update your email address.
          </Text>
        </ScrollView>

        {/* Gender Picker Modal */}
        <Modal visible={genderPickerVisible} transparent animationType="fade">
          <TouchableOpacity
            style={styles.pickerOverlay}
            activeOpacity={1}
            onPress={() => setGenderPickerVisible(false)}
          >
            <View style={styles.pickerContainer}>
              <Text style={styles.pickerTitle}>Select Gender</Text>
              {GENDER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option}
                  style={[styles.pickerOption, gender === option && styles.pickerOptionSelected]}
                  onPress={() => { setGender(option); setGenderPickerVisible(false); }}
                >
                  <Text style={[styles.pickerOptionText, gender === option && styles.pickerOptionTextSelected]}>
                    {option}
                  </Text>
                  {gender === option && <Ionicons name="checkmark" size={20} color="#6B7FC4" />}
                </TouchableOpacity>
              ))}
              <TouchableOpacity
                style={styles.pickerOption}
                onPress={() => { setGender(''); setGenderPickerVisible(false); }}
              >
                <Text style={[styles.pickerOptionText, { color: '#dc2626' }]}>Clear</Text>
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  content: { paddingBottom: 40 },
  avatarSection: { alignItems: 'center', paddingVertical: 32 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: '#6B7FC4',
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  avatarImage: { width: 80, height: 80, borderRadius: 40, marginBottom: 14 },
  avatarText: { color: '#fff', fontSize: 30, fontWeight: '700' },
  nameText: { fontSize: 20, fontWeight: '700', color: '#111827' },
  emailText: { fontSize: 14, color: '#6b7280', marginTop: 4 },
  sectionTitle: {
    fontSize: 13, fontWeight: '600', color: '#6b7280', textTransform: 'uppercase',
    letterSpacing: 0.5, marginHorizontal: 20, marginTop: 24, marginBottom: 8,
  },
  menuContainer: { backgroundColor: '#fff', marginHorizontal: 16, borderRadius: 14, overflow: 'hidden' },
  menuItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  menuItemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  menuItemLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  menuItemLabelDanger: { color: '#dc2626' },

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
  inputText: { fontSize: 16, color: '#111827' },
  placeholderText: { fontSize: 16, color: '#9ca3af' },
  fieldHint: { fontSize: 12, color: '#9ca3af', marginTop: 20, textAlign: 'center' },

  // Gender picker
  pickerOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: '#fff', borderRadius: 16, width: '80%', padding: 8, maxWidth: 320,
  },
  pickerTitle: {
    fontSize: 17, fontWeight: '600', color: '#111827', textAlign: 'center',
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
  },
  pickerOption: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  pickerOptionSelected: { backgroundColor: '#f0f2ff' },
  pickerOptionText: { fontSize: 16, color: '#111827' },
  pickerOptionTextSelected: { color: '#6B7FC4', fontWeight: '600' },
});
