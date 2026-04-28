import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { pickAndUploadPhoto } from '@/lib/usePhotoUpload';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface Location {
  id: string;
  name: string;
  address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  phone: string | null;
  timezone: string;
  image_url: string | null;
  gallery_count: number;
}

export default function TenantLocations() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Location | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formAddress, setFormAddress] = useState('');
  const [formCity, setFormCity] = useState('');
  const [formState, setFormState] = useState('');
  const [formCountry, setFormCountry] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLat, setFormLat] = useState<number | null>(null);
  const [formLng, setFormLng] = useState<number | null>(null);
  const [formTimezone, setFormTimezone] = useState('');
  const [geocoding, setGeocoding] = useState(false);
  const [locationImageUrl, setLocationImageUrl] = useState<string | null>(null);
  const [galleryPhotos, setGalleryPhotos] = useState<{ id: string; image_url: string }[]>([]);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const fetchLocations = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/tenant/locations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setLocations(json.data ?? []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const openAdd = () => {
    setEditing(null);
    setFormName(''); setFormAddress(''); setFormCity(''); setFormState(''); setFormCountry(''); setFormPhone('');
    setFormLat(null); setFormLng(null); setFormTimezone('');
    setLocationImageUrl(null); setGalleryPhotos([]);
    setModalVisible(true);
  };

  const openEdit = (loc: Location) => {
    setEditing(loc);
    setFormName(loc.name); setFormAddress(loc.address); setFormCity(loc.city ?? ''); setFormState(loc.state ?? ''); setFormCountry(loc.country ?? ''); setFormPhone(loc.phone ?? '');
    setLocationImageUrl(loc.image_url);
    setGalleryPhotos([]);
    fetchGallery(loc.id);
    setModalVisible(true);
  };

  const fetchGallery = async (locationId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/tenant/gallery?locationId=${locationId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setGalleryPhotos(json.photos ?? []);
    } catch { setGalleryPhotos([]); }
  };

  const handleUploadGalleryPhoto = async () => {
    if (!editing) return;
    setUploadingPhoto(true);
    try {
      const token = await getToken();
      if (!token) { setUploadingPhoto(false); return; }

      // Use ImagePicker directly and upload via gallery API
      const ImagePicker = require('expo-image-picker');
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]) { setUploadingPhoto(false); return; }

      const uri = result.assets[0].uri;
      const ext = uri.split('.').pop() ?? 'jpg';
      const formData = new FormData();
      formData.append('file', {
        uri,
        name: `gallery.${ext}`,
        type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
      } as unknown as Blob);
      formData.append('locationId', editing.id);

      const res = await fetch(`${API_BASE}/api/tenant/gallery`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      });
      const json = await res.json();
      if (res.ok && json.photo) {
        setGalleryPhotos(prev => [...prev, json.photo]);
      } else {
        Alert.alert('Error', json.error ?? 'Upload failed');
      }
    } catch { Alert.alert('Error', 'Upload failed'); }
    finally { setUploadingPhoto(false); }
  };

  const handleDeleteGalleryPhoto = async (photoId: string) => {
    try {
      const token = await getToken();
      if (!token) return;
      await fetch(`${API_BASE}/api/tenant/gallery?id=${photoId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      setGalleryPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch { Alert.alert('Error', 'Delete failed'); }
  };

  const handleGeocode = async () => {
    if (!formAddress.trim()) { Alert.alert('Error', 'Enter an address to search'); return; }
    setGeocoding(true);
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/tenant/geocode?address=${encodeURIComponent(formAddress.trim())}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setFormAddress(json.formatted_address ?? formAddress);
        if (json.city) setFormCity(json.city);
        if (json.state) setFormState(json.state);
        if (json.country) setFormCountry(json.country);
        setFormLat(json.latitude);
        setFormLng(json.longitude);
        setFormTimezone(json.timezone ?? '');
      } else {
        Alert.alert('Not Found', json.error ?? 'Address not found');
      }
    } catch { Alert.alert('Error', 'Search failed'); }
    finally { setGeocoding(false); }
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Error', 'Location name is required'); return; }
    if (!formLat && !editing) {
      Alert.alert('Address Required', 'Please search and select an address to set the correct timezone and coordinates.');
      return;
    }
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const method = editing ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = {
        name: formName.trim(), address: formAddress.trim(),
        city: formCity.trim() || null, state: formState.trim() || null,
        country: formCountry.trim() || null, phone: formPhone.trim() || null,
        latitude: formLat, longitude: formLng,
        timezone: formTimezone || null,
      };
      if (editing) body.id = editing.id;

      const res = await fetch(`${API_BASE}/api/tenant/locations`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setModalVisible(false); fetchLocations(); }
      else { const j = await res.json(); Alert.alert('Error', j.error ?? 'Failed to save'); }
    } catch { Alert.alert('Error', 'Connection error'); }
    finally { setSaving(false); }
  };

  const handleDelete = (loc: Location) => {
    Alert.alert('Delete Location', `Delete "${loc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await fetch(`${API_BASE}/api/tenant/locations?id=${loc.id}`, {
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
          });
          fetchLocations();
        },
      },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
        <Ionicons name="location" size={20} color="#fff" />
        <Text style={styles.addBtnText}>Add Location</Text>
      </TouchableOpacity>

      <FlatList
        data={locations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchLocations(); }} tintColor="#6B7FC4" />}
        ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyText}>No locations yet</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
            <View style={styles.cardRow}>
              <View style={styles.iconCircle}><Ionicons name="location-outline" size={20} color="#6B7FC4" /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.locName}>{item.name}</Text>
                <Text style={styles.locAddress}>{item.city ? [item.city, item.state, item.country].filter(Boolean).join(', ') : item.address}</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
                  <Text style={styles.badge}>{item.timezone}</Text>
                  {item.gallery_count > 0 && <Text style={styles.badge}>{item.gallery_count} photos</Text>}
                </View>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Ionicons name="trash-outline" size={18} color="#d1d5db" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet">
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f9fafb' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Text style={{ fontSize: 16, color: '#6b7280' }}>Cancel</Text></TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700' }}>{editing ? 'Edit Location' : 'New Location'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}><Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7FC4' }}>{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Location name *" placeholderTextColor="#9ca3af" />

            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={formAddress} onChangeText={setFormAddress} placeholder="Search address..." placeholderTextColor="#9ca3af" />
              <TouchableOpacity style={styles.geocodeBtn} onPress={handleGeocode} disabled={geocoding}>
                {geocoding ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Ionicons name="search" size={18} color="#fff" />
                )}
              </TouchableOpacity>
            </View>
            {formTimezone ? (
              <Text style={styles.tzBadge}>Timezone: {formTimezone}</Text>
            ) : (
              <Text style={[styles.formHint, { color: '#dc2626' }]}>Enter address and tap search to verify location *</Text>
            )}

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={formCity} onChangeText={setFormCity} placeholder="City" placeholderTextColor="#9ca3af" />
              <TextInput style={[styles.input, { flex: 1 }]} value={formState} onChangeText={setFormState} placeholder="State" placeholderTextColor="#9ca3af" />
            </View>
            <TextInput style={styles.input} value={formCountry} onChangeText={setFormCountry} placeholder="Country" placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} value={formPhone} onChangeText={setFormPhone} placeholder="Phone number" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />

            {/* Location Photo */}
            <Text style={styles.sectionLabel}>Location Photo</Text>
            <TouchableOpacity style={styles.photoPicker} onPress={async () => {
              if (!editing) { Alert.alert('Save First', 'Save the location before adding a photo.'); return; }
              const url = await pickAndUploadPhoto('location');
              if (url) {
                setLocationImageUrl(url);
                const token = await getToken();
                if (token) {
                  await fetch(`${API_BASE}/api/tenant/locations`, {
                    method: 'PATCH',
                    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: editing.id, image_url: url }),
                  });
                  fetchLocations();
                }
              }
            }}>
              {locationImageUrl ? (
                <Image source={{ uri: locationImageUrl }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={28} color="#9ca3af" />
                  <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>{editing ? 'Add Photo' : 'Save location first'}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Gallery Photos */}
            {editing && (
              <>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
                  <Text style={styles.sectionLabel}>Gallery Photos ({galleryPhotos.length}/15)</Text>
                  <TouchableOpacity onPress={handleUploadGalleryPhoto} disabled={uploadingPhoto || galleryPhotos.length >= 15}>
                    {uploadingPhoto ? (
                      <ActivityIndicator size="small" color="#6B7FC4" />
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                        <Ionicons name="add-circle" size={20} color={galleryPhotos.length >= 15 ? '#d1d5db' : '#6B7FC4'} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: galleryPhotos.length >= 15 ? '#d1d5db' : '#6B7FC4' }}>Add</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                </View>
                <Text style={styles.formHint}>Photos are shown to customers during discovery.</Text>
                {galleryPhotos.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                    {galleryPhotos.map((photo) => (
                      <View key={photo.id} style={styles.galleryThumb}>
                        <Image source={{ uri: photo.image_url }} style={styles.galleryImg} />
                        <TouchableOpacity
                          style={styles.galleryDelete}
                          onPress={() => Alert.alert('Delete Photo', 'Remove this photo?', [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => handleDeleteGalleryPhoto(photo.id) },
                          ])}
                        >
                          <Ionicons name="close-circle" size={22} color="#ef4444" />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </ScrollView>
                )}
              </>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  addBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, backgroundColor: '#6B7FC4', margin: 16, marginBottom: 0, paddingVertical: 12, borderRadius: 12 },
  addBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
  locName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  locAddress: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  badge: { fontSize: 11, color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 18, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  form: { padding: 20 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  photoPicker: { alignItems: 'center', marginBottom: 12 },
  photoPreview: { width: 120, height: 90, borderRadius: 14 },
  photoPlaceholder: { width: 120, height: 90, borderRadius: 14, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed' },
  galleryThumb: { width: 80, height: 80, marginRight: 8, borderRadius: 10, overflow: 'hidden', position: 'relative' as const },
  galleryImg: { width: 80, height: 80, borderRadius: 10 },
  galleryDelete: { position: 'absolute' as const, top: -4, right: -4, backgroundColor: '#fff', borderRadius: 11 },
  geocodeBtn: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center', marginBottom: 10 },
  tzBadge: { fontSize: 12, color: '#10b981', backgroundColor: '#d1fae5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, alignSelf: 'flex-start', marginBottom: 10, overflow: 'hidden' },
  formHint: { fontSize: 13, color: '#9ca3af', marginBottom: 10, lineHeight: 18 },
});
