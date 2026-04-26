import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Service {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  description: string | null;
  visibility: string;
}

export default function TenantServices() {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<Service | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState('');
  const [formPrice, setFormPrice] = useState('');
  const [formDuration, setFormDuration] = useState('60');
  const [formDesc, setFormDesc] = useState('');

  const fetchServices = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
      if (!tenant) return;
      const tid = (tenant as { id: string }).id;
      setTenantId(tid);

      const { data } = await supabase
        .from('services')
        .select('id, name, price, duration_minutes, description, visibility')
        .eq('tenant_id', tid)
        .order('name');
      setServices((data ?? []) as Service[]);
    } catch {
      setServices([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchServices(); }, [fetchServices]);

  const openAdd = () => {
    setEditing(null);
    setFormName(''); setFormPrice(''); setFormDuration('60'); setFormDesc('');
    setModalVisible(true);
  };

  const openEdit = (svc: Service) => {
    setEditing(svc);
    setFormName(svc.name);
    setFormPrice(String(svc.price));
    setFormDuration(String(svc.duration_minutes));
    setFormDesc(svc.description ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Error', 'Service name is required'); return; }
    if (!tenantId) return;
    setSaving(true);
    try {
      if (editing) {
        await supabase.from('services').update({
          name: formName.trim(),
          price: parseFloat(formPrice) || 0,
          duration_minutes: parseInt(formDuration) || 60,
          description: formDesc.trim() || null,
        } as never).eq('id', editing.id);
      } else {
        await supabase.from('services').insert({
          tenant_id: tenantId,
          name: formName.trim(),
          price: parseFloat(formPrice) || 0,
          duration_minutes: parseInt(formDuration) || 60,
          description: formDesc.trim() || null,
          visibility: 'public',
        } as never);
      }
      setModalVisible(false);
      fetchServices();
    } catch {
      Alert.alert('Error', 'Failed to save service');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (svc: Service) => {
    Alert.alert('Delete Service', `Delete "${svc.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          await supabase.from('services').delete().eq('id', svc.id);
          fetchServices();
        },
      },
    ]);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;
  }

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
        ListEmptyComponent={
          <View style={styles.emptyCard}><Text style={styles.emptyText}>No services yet. Add your first service above.</Text></View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
            <View style={styles.cardRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.svcName}>{item.name}</Text>
                <Text style={styles.svcDetail}>${item.price.toFixed(2)} · {item.duration_minutes} min</Text>
                {item.description ? <Text style={styles.svcDesc} numberOfLines={2}>{item.description}</Text> : null}
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
            <TouchableOpacity onPress={() => setModalVisible(false)}>
              <Text style={{ fontSize: 16, color: '#6b7280' }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 17, fontWeight: '700' }}>{editing ? 'Edit Service' : 'New Service'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}>
              <Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7FC4' }}>{saving ? 'Saving...' : 'Save'}</Text>
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Service name" placeholderTextColor="#9ca3af" />
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} value={formPrice} onChangeText={setFormPrice} placeholder="Price" placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
              <TextInput style={[styles.input, { flex: 1 }]} value={formDuration} onChangeText={setFormDuration} placeholder="Duration (min)" placeholderTextColor="#9ca3af" keyboardType="number-pad" />
            </View>
            <TextInput style={[styles.input, { minHeight: 80, textAlignVertical: 'top' }]} value={formDesc} onChangeText={setFormDesc} placeholder="Description (optional)" placeholderTextColor="#9ca3af" multiline />
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
  svcDesc: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9ca3af', textAlign: 'center' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  form: { padding: 20 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
});
