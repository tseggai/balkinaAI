import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { pickAndUploadPhoto } from '@/lib/usePhotoUpload';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface Extra { id?: string; name: string; price: number; duration_minutes: number; }
interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description: string | null;
  image_url: string | null;
  visibility: string;
  location_ids: string[];
  extras: Extra[];
}
interface Option { id: string; name: string; }

export default function TenantServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDuration, setFormDuration] = useState('60');
  const [formDesc, setFormDesc] = useState('');
  const [formImageUrl, setFormImageUrl] = useState<string | null>(null);
  const [formLocIds, setFormLocIds] = useState<string[]>([]);
  const [formExtras, setFormExtras] = useState<Extra[]>([]);
  const [showAddExtra, setShowAddExtra] = useState(false);
  const [extraName, setExtraName] = useState('');
  const [extraPrice, setExtraPrice] = useState('');
  const [extraDuration, setExtraDuration] = useState('');

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const fetchServices = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/tenant/services`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setServices(json.data ?? []);
      setLocations(json.locations ?? []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const toggleLoc = (id: string) => setFormLocIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const openAdd = () => {
    setEditing(null);
    setFormName(''); setFormPrice(''); setFormDuration('60'); setFormDesc(''); setFormImageUrl(null);
    setFormLocIds([]); setFormExtras([]); setShowAddExtra(false);
    setModalVisible(true);
  };

  const openEdit = (svc: Service) => {
    setEditing(svc);
    setFormName(svc.name); setFormPrice(String(svc.price)); setFormDuration(String(svc.duration_minutes)); setFormDesc(svc.description ?? ''); setFormImageUrl(svc.image_url);
    setFormLocIds(svc.location_ids); setFormExtras(svc.extras); setShowAddExtra(false);
    setModalVisible(true);
  };

  const addExtra = () => {
    if (!extraName.trim()) return;
    setFormExtras([...formExtras, { name: extraName.trim(), price: parseFloat(extraPrice) || 0, duration_minutes: parseInt(extraDuration) || 0 }]);
    setExtraName(''); setExtraPrice(''); setExtraDuration('');
    setShowAddExtra(false);
  };

  const removeExtra = (idx: number) => setFormExtras(formExtras.filter((_, i) => i !== idx));

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Error', 'Service name is required'); return; }
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const method = editing ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = {
        name: formName.trim(), price: parseFloat(formPrice) || 0,
        duration_minutes: parseInt(formDuration) || 60,
        description: formDesc.trim() || null,
        image_url: formImageUrl,
        location_ids: formLocIds, extras: formExtras,
      };
      if (editing) body.id = editing.id;

      const res = await fetch(`${API_BASE}/api/tenant/services`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) { setModalVisible(false); fetchServices(); }
      else { const j = await res.json(); Alert.alert('Error', j.error ?? 'Failed to save'); }
    } catch { Alert.alert('Error', 'Connection error'); }
    finally { setSaving(false); }
  };

  const handleDelete = (svc: Service) => {
    Alert.alert('Delete Service', `Delete "${svc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => {
        const token = await getToken();
        if (!token) return;
        await fetch(`${API_BASE}/api/tenant/services?id=${svc.id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        fetchServices();
      }},
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
        <Ionicons name="add-circle" size={20} color="#fff" />
        <Text style={styles.addBtnText}>Add Service</Text>
      </TouchableOpacity>

      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchServices(); }} tintColor="#6B7FC4" />}
        ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyText}>No services yet</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.svcName}>{item.name}</Text>
                <Text style={styles.svcDetail}>${item.price.toFixed(2)} · {item.duration_minutes} min</Text>
                {item.extras.length > 0 && (
                  <Text style={styles.svcExtras}>{item.extras.length} extra{item.extras.length > 1 ? 's' : ''}</Text>
                )}
                {item.location_ids.length > 0 && (
                  <Text style={styles.svcLocs}>{item.location_ids.length} location{item.location_ids.length > 1 ? 's' : ''}</Text>
                )}
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
            <Text style={{ fontSize: 17, fontWeight: '700' }}>{editing ? 'Edit Service' : 'New Service'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}><Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7FC4' }}>{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            {/* Service photo */}
            <TouchableOpacity style={styles.photoPicker} onPress={async () => {
              const url = await pickAndUploadPhoto('service');
              if (url) setFormImageUrl(url);
            }}>
              {formImageUrl ? (
                <Image source={{ uri: formImageUrl }} style={styles.photoPreview} />
              ) : (
                <View style={styles.photoPlaceholder}>
                  <Ionicons name="camera-outline" size={28} color="#9ca3af" />
                  <Text style={{ fontSize: 13, color: '#9ca3af', marginTop: 4 }}>Add Photo</Text>
                </View>
              )}
            </TouchableOpacity>

            <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Service name *" placeholderTextColor="#9ca3af" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={formPrice} onChangeText={setFormPrice} placeholder="Price" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
              <TextInput style={[styles.input, { flex: 1 }]} value={formDuration} onChangeText={setFormDuration} placeholder="Duration (min)" placeholderTextColor="#9ca3af" keyboardType="number-pad" />
            </View>
            <TextInput style={[styles.input, { minHeight: 60, textAlignVertical: 'top' }]} value={formDesc} onChangeText={setFormDesc} placeholder="Description (optional)" placeholderTextColor="#9ca3af" multiline />

            {/* Location assignment */}
            {locations.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Available at Locations</Text>
                {locations.map(loc => (
                  <TouchableOpacity key={loc.id} style={styles.checkRow} onPress={() => toggleLoc(loc.id)}>
                    <Ionicons name={formLocIds.includes(loc.id) ? 'checkbox' : 'square-outline'} size={22} color={formLocIds.includes(loc.id) ? '#6B7FC4' : '#d1d5db'} />
                    <Text style={styles.checkLabel}>{loc.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Extras */}
            <Text style={styles.sectionLabel}>Service Extras</Text>
            {formExtras.map((ext, idx) => (
              <View key={idx} style={styles.extraRow}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: '500', color: '#111827' }}>{ext.name}</Text>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>+${ext.price} · +{ext.duration_minutes}min</Text>
                </View>
                <TouchableOpacity onPress={() => removeExtra(idx)}>
                  <Ionicons name="close-circle" size={22} color="#ef4444" />
                </TouchableOpacity>
              </View>
            ))}

            {showAddExtra ? (
              <View style={styles.addExtraForm}>
                <TextInput style={styles.input} value={extraName} onChangeText={setExtraName} placeholder="Extra name" placeholderTextColor="#9ca3af" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TextInput style={[styles.input, { flex: 1 }]} value={extraPrice} onChangeText={setExtraPrice} placeholder="Price" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
                  <TextInput style={[styles.input, { flex: 1 }]} value={extraDuration} onChangeText={setExtraDuration} placeholder="Duration (min)" placeholderTextColor="#9ca3af" keyboardType="number-pad" />
                </View>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.extraActionBtn, { backgroundColor: '#6B7FC4' }]} onPress={addExtra}>
                    <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.extraActionBtn, { backgroundColor: '#f3f4f6' }]} onPress={() => setShowAddExtra(false)}>
                    <Text style={{ color: '#6b7280', fontWeight: '600', fontSize: 14 }}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity style={styles.addExtraBtn} onPress={() => setShowAddExtra(true)}>
                <Ionicons name="add" size={18} color="#6B7FC4" />
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#6B7FC4' }}>Add Extra</Text>
              </TouchableOpacity>
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
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  cardRow: { flexDirection: 'row', alignItems: 'center' },
  svcName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  svcDetail: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  svcExtras: { fontSize: 11, color: '#8b5cf6', marginTop: 3 },
  svcLocs: { fontSize: 11, color: '#6B7FC4', marginTop: 1 },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 18, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  form: { padding: 20, paddingBottom: 60 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkLabel: { fontSize: 15, color: '#111827' },
  extraRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  addExtraForm: { marginTop: 8, padding: 12, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb' },
  extraActionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  addExtraBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
  photoPicker: { alignItems: 'center', marginBottom: 16 },
  photoPreview: { width: 100, height: 100, borderRadius: 14 },
  photoPlaceholder: { width: 100, height: 100, borderRadius: 14, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#e5e7eb', borderStyle: 'dashed' },
  formHint: { fontSize: 13, color: '#9ca3af', marginTop: 16, lineHeight: 18 },
});
