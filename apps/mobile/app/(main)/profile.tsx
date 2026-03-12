import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface CustomerProfile {
  id: string;
  display_name: string | null;
  phone: string | null;
  email: string | null;
}

export default function ProfileScreen() {
  const router = useRouter();
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  const fetchProfile = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      return;
    }

    const { data } = await supabase
      .from('customers')
      .select('id, display_name, phone, email')
      .eq('id', user.id)
      .single();

    const customer = data as CustomerProfile | null;
    if (customer) {
      setProfile(customer);
      setDisplayName(customer.display_name ?? '');
      setPhone(customer.phone ?? '');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async () => {
    if (!profile) return;
    if (!displayName.trim()) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setSaving(true);

    const { error } = await supabase
      .from('customers')
      .update({
        display_name: displayName.trim(),
        phone: phone.trim() || null,
      } as never)
      .eq('id', profile.id);

    setSaving(false);

    if (error) {
      Alert.alert('Error', error.message);
    } else {
      setProfile({
        ...profile,
        display_name: displayName.trim(),
        phone: phone.trim() || null,
      });
      setEditing(false);
      Alert.alert('Saved', 'Profile updated successfully');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut();
          router.replace('/(auth)/welcome');
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6B7FC4" />
      </View>
    );
  }

  const initials = profile?.display_name
    ? profile.display_name
        .split(' ')
        .map((n) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : '?';

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          {!editing && (
            <Text style={styles.nameDisplay}>
              {profile?.display_name ?? 'Guest'}
            </Text>
          )}
          {!editing && profile?.email && (
            <Text style={styles.emailDisplay}>{profile.email}</Text>
          )}
        </View>

        {/* Profile form */}
        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Name</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Your name"
                autoCapitalize="words"
              />
            ) : (
              <Text style={styles.value}>
                {profile?.display_name ?? 'Not set'}
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.label}>Phone</Text>
            {editing ? (
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+1 (555) 000-0000"
                keyboardType="phone-pad"
              />
            ) : (
              <Text style={styles.value}>
                {profile?.phone ?? 'Not set'}
              </Text>
            )}
          </View>

          <View style={styles.divider} />

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.value}>
              {profile?.email ?? 'Not set'}
            </Text>
          </View>
        </View>

        {/* Action buttons */}
        {editing ? (
          <View style={styles.editButtons}>
            <TouchableOpacity
              style={[styles.btn, styles.btnPrimary, saving && styles.btnDisabled]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnPrimaryText}>Save Changes</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.btn, styles.btnSecondary]}
              onPress={() => {
                setDisplayName(profile?.display_name ?? '');
                setPhone(profile?.phone ?? '');
                setEditing(false);
              }}
            >
              <Text style={styles.btnSecondaryText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.btn, styles.btnPrimary]}
            onPress={() => setEditing(true)}
          >
            <Ionicons name="create-outline" size={16} color="#fff" />
            <Text style={styles.btnPrimaryText}>Edit Profile</Text>
          </TouchableOpacity>
        )}

        {/* Sign out */}
        <TouchableOpacity style={styles.signOutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={18} color="#dc2626" />
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

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
    paddingVertical: 28,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6B7FC4',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  avatarText: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
  },
  nameDisplay: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  emailDisplay: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  form: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f3f4f6',
    marginBottom: 20,
  },
  field: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  value: {
    fontSize: 15,
    color: '#111827',
  },
  input: {
    fontSize: 15,
    color: '#111827',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    padding: 10,
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: '#f3f4f6',
    marginHorizontal: 16,
  },
  editButtons: {
    paddingHorizontal: 16,
    gap: 10,
  },
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginHorizontal: 16,
    gap: 6,
  },
  btnPrimary: {
    backgroundColor: '#6B7FC4',
  },
  btnSecondary: {
    backgroundColor: '#f3f4f6',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  btnSecondaryText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    marginHorizontal: 16,
    marginTop: 24,
    gap: 6,
  },
  signOutText: {
    color: '#dc2626',
    fontSize: 15,
    fontWeight: '600',
  },
});
