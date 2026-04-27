import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
}

export default function TenantStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');

  const fetchStaff = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
      if (!tenant) return;
      const tid = (tenant as { id: string }).id;
      setTenantId(tid);
      const { data } = await supabase.from('staff').select('id, name, email, phone, status').eq('tenant_id', tid).order('name');
      setStaff((data ?? []) as StaffMember[]);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const openAdd = () => {
    setEditing(null);
    setFormName(''); setFormEmail(''); setFormPhone('');
    setModalVisible(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setFormName(s.name); setFormEmail(s.email ?? ''); setFormPhone(s.phone ?? '');
    setModalVisible(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Error', 'Name is required'); return; }
    if (!tenantId) return;
    setSaving(true);
    try {
      if (editing) {
        await supabase.from('staff').update({ name: formName.trim(), email: formEmail.trim() || null, phone: formPhone.trim() || null } as never).eq('id', editing.id);
      } else {
        await supabase.from('staff').insert({
          tenant_id: tenantId, name: formName.trim(), email: formEmail.trim() || null, phone: formPhone.trim() || null, status: 'active',
          availability_schedule: { monday: { start: '09:00', end: '17:00' }, tuesday: { start: '09:00', end: '17:00' }, wednesday: { start: '09:00', end: '17:00' }, thursday: { start: '09:00', end: '17:00' }, friday: { start: '09:00', end: '17:00' }, saturday: { start: '09:00', end: '17:00' } },
        } as never);
      }
      setModalVisible(false);
      fetchStaff();
    } catch { Alert.alert('Error', 'Failed to save'); } finally { setSaving(false); }
  };

  const handleDelete = (s: StaffMember) => {
    Alert.alert('Remove Staff', `Remove "${s.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => { await supabase.from('staff').delete().eq('id', s.id); fetchStaff(); } },
    ]);
  };

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
        <Ionicons name="person-add" size={20} color="#fff" />
        <Text style={styles.addBtnText}>Add Staff Member</Text>
      </TouchableOpacity>

      <FlatList
        data={staff}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchStaff(); }} tintColor="#6B7FC4" />}
        ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyText}>No staff members yet</Text></View>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.card} onPress={() => openEdit(item)} activeOpacity={0.7}>
            <View style={styles.cardRow}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{item.name.charAt(0)}</Text></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.staffName}>{item.name}</Text>
                {item.email && <Text style={styles.staffDetail}>{item.email}</Text>}
                {item.phone && <Text style={styles.staffDetail}>{item.phone}</Text>}
              </View>
              <View style={[styles.statusDot, { backgroundColor: item.status === 'active' ? '#10b981' : '#9ca3af' }]} />
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
            <Text style={{ fontSize: 17, fontWeight: '700' }}>{editing ? 'Edit Staff' : 'Add Staff'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}><Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7FC4' }}>{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Full name" placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} value={formEmail} onChangeText={setFormEmail} placeholder="Email address" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} value={formPhone} onChangeText={setFormPhone} placeholder="Phone number" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />
            <Text style={styles.formHint}>New staff members get a Mon-Sat 9am-5pm default schedule. Adjust schedules from the desktop dashboard.</Text>
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
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center' },
  avatarText: { fontSize: 16, fontWeight: '700', color: '#fff' },
  staffName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  staffDetail: { fontSize: 13, color: '#6b7280' },
  statusDot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  form: { padding: 20 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  formHint: { fontSize: 13, color: '#9ca3af', marginTop: 8, lineHeight: 18 },
});
