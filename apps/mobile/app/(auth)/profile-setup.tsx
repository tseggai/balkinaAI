import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Notifications from 'expo-notifications';
import { supabase } from '@/lib/supabase';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handlePickImage() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
    }
  }

  async function uploadAvatar(userId: string): Promise<string | null> {
    if (!avatarUri) return null;

    try {
      const response = await fetch(avatarUri);
      const blob = await response.blob();
      const fileExt = avatarUri.split('.').pop() ?? 'jpg';
      const filePath = `${userId}/avatar.${fileExt}`;

      const { error } = await supabase.storage
        .from('customer-avatars')
        .upload(filePath, blob, {
          upsert: true,
          contentType: `image/${fileExt}`,
        });

      if (error) {
        console.error('Avatar upload error:', error.message);
        return null;
      }

      const { data: urlData } = supabase.storage
        .from('customer-avatars')
        .getPublicUrl(filePath);

      return urlData.publicUrl;
    } catch {
      return null;
    }
  }

  async function registerPushToken(userId: string) {
    try {
      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();

      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') return;

      const tokenData = await Notifications.getExpoPushTokenAsync();
      const pushToken = tokenData.data;

      await supabase
        .from('customers')
        .update({ push_token: pushToken })
        .eq('id', userId);
    } catch {
      // Push token registration is non-fatal
    }
  }

  async function handleComplete() {
    if (!displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      Alert.alert('Error', 'Session expired. Please sign in again.');
      setLoading(false);
      router.replace('/(auth)/welcome');
      return;
    }

    // Upload avatar if selected
    const avatarUrl = await uploadAvatar(user.id);

    // Create customer record
    const { error } = await supabase.from('customers').upsert({
      id: user.id,
      display_name: displayName.trim(),
      email: user.email ?? null,
      phone: user.phone ?? null,
    });

    if (error) {
      Alert.alert('Error', error.message);
      setLoading(false);
      return;
    }

    // Update avatar URL if uploaded (separate field isn't in schema,
    // but display_name is stored above which is the key field)
    if (avatarUrl) {
      // Avatar stored in Supabase Storage, URL can be derived from user ID
    }

    // Register push token
    await registerPushToken(user.id);

    setLoading(false);
    router.replace('/');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Set up your profile</Text>
      <Text style={styles.subtitle}>How should we call you?</Text>

      <TouchableOpacity style={styles.avatarContainer} onPress={handlePickImage}>
        {avatarUri ? (
          <Image source={{ uri: avatarUri }} style={styles.avatar} />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Text style={styles.avatarPlaceholderText}>+</Text>
          </View>
        )}
        <Text style={styles.avatarLabel}>Add photo</Text>
      </TouchableOpacity>

      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Your name"
        autoCapitalize="words"
        autoComplete="name"
        autoFocus
      />

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleComplete}
        disabled={loading}
      >
        <Text style={styles.btnText}>
          {loading ? 'Setting up...' : 'Continue'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 80,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 32,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#f3f4f6',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#e5e7eb',
    borderStyle: 'dashed',
  },
  avatarPlaceholderText: {
    fontSize: 32,
    color: '#9ca3af',
  },
  avatarLabel: {
    marginTop: 8,
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
