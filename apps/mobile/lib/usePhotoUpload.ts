import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';
import { supabase } from './supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

export async function pickAndUploadPhoto(purpose: string): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsEditing: true,
    aspect: purpose === 'logo' ? [1, 1] : [4, 3],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) return null;

  const uri = result.assets[0].uri;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { Alert.alert('Error', 'Please sign in'); return null; }

    const ext = uri.split('.').pop() ?? 'jpg';
    const formData = new FormData();
    formData.append('file', {
      uri,
      name: `${purpose}.${ext}`,
      type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    } as unknown as Blob);
    formData.append('purpose', purpose);

    const res = await fetch(`${API_BASE}/api/tenant/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: formData,
    });

    const json = await res.json();
    if (!res.ok || !json.url) {
      Alert.alert('Upload Failed', json.error ?? 'Please try again');
      return null;
    }

    return json.url;
  } catch {
    Alert.alert('Error', 'Upload failed. Check your connection.');
    return null;
  }
}
