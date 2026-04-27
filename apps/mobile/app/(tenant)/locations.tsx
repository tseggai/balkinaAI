import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

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
    setModalVisible(true);
  };

  const openEdit = (loc: Location) => {
    setEditing(loc);
    setFormName(loc.name); setFormAddress(loc.address); setFormCity(loc.city ?? ''); setFormState(loc.state ?? ''); setFormCountry(loc.country ?? ''); setFormPhone(loc.phone ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Error', 'Location name is required'); return; }
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const method = editing ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = {
        name: formName.trim(), address: formAddress.trim(),
        city: formCity.trim() || null, state: formState.trim() || null,
        country: formCountry.trim() || null, phone: formPhone.trim() || null,
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
            <TextInput style={styles.input} value={formAddress} onChangeText={setFormAddress} placeholder="Full address" placeholderTextColor="#9ca3af" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={formCity} onChangeText={setFormCity} placeholder="City" placeholderTextColor="#9ca3af" />
              <TextInput style={[styles.input, { flex: 1 }]} value={formState} onChangeText={setFormState} placeholder="State" placeholderTextColor="#9ca3af" />
            </View>
            <TextInput style={styles.input} value={formCountry} onChangeText={setFormCountry} placeholder="Country" placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} value={formPhone} onChangeText={setFormPhone} placeholder="Phone number" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
            <Text style={styles.formHint}>For gallery photos and Google Maps address lookup, use the desktop dashboard.</Text>
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
  formHint: { fontSize: 13, color: '#9ca3af', marginTop: 8, lineHeight: 18 },
});
