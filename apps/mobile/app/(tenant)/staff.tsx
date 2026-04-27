import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, TextInput, Modal, KeyboardAvoidingView, Platform, ScrollView, Switch } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface StaffMember {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string | null;
  location_ids: string[];
  service_ids: string[];
}

interface Option { id: string; name: string; }

export default function TenantStaff() {
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [locations, setLocations] = useState<Option[]>([]);
  const [services, setServices] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [saving, setSaving] = useState(false);

  const [formName, setFormName] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formLocIds, setFormLocIds] = useState<string[]>([]);
  const [formSvcIds, setFormSvcIds] = useState<string[]>([]);
  const [sendInvite, setSendInvite] = useState(false);

  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  };

  const fetchStaff = useCallback(async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_BASE}/api/tenant/staff`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      setStaff(json.data ?? []);
      setLocations(json.locations ?? []);
      setServices(json.services ?? []);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const openAdd = () => {
    setEditing(null);
    setFormName(''); setFormEmail(''); setFormPhone('');
    setFormLocIds([]); setFormSvcIds([]); setSendInvite(false);
    setModalVisible(true);
  };

  const openEdit = (s: StaffMember) => {
    setEditing(s);
    setFormName(s.name); setFormEmail(s.email ?? ''); setFormPhone(s.phone ?? '');
    setFormLocIds(s.location_ids); setFormSvcIds(s.service_ids); setSendInvite(false);
    setModalVisible(true);
  };

  const toggleItem = (list: string[], id: string): string[] =>
    list.includes(id) ? list.filter(x => x !== id) : [...list, id];

  const handleSave = async () => {
    if (!formName.trim()) { Alert.alert('Error', 'Name is required'); return; }
    setSaving(true);
    try {
      const token = await getToken();
      if (!token) return;
      const method = editing ? 'PATCH' : 'POST';
      const body: Record<string, unknown> = {
        name: formName.trim(), email: formEmail.trim() || null,
        phone: formPhone.trim() || null,
        location_ids: formLocIds, service_ids: formSvcIds,
      };
      if (editing) body.id = editing.id;
      else body.send_invite = sendInvite && !!formEmail.trim();

      const res = await fetch(`${API_BASE}/api/tenant/staff`, {
        method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        setModalVisible(false);
        fetchStaff();
        if (!editing && sendInvite && formEmail.trim()) {
          Alert.alert('Invite Sent', `Invite email sent to ${formEmail.trim()}`);
        }
      } else {
        const j = await res.json();
        Alert.alert('Error', j.error ?? 'Failed to save');
      }
    } catch { Alert.alert('Error', 'Connection error'); }
    finally { setSaving(false); }
  };

  const handleDelete = (s: StaffMember) => {
    Alert.alert('Remove Staff', `Remove "${s.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: async () => {
        const token = await getToken();
        if (!token) return;
        await fetch(`${API_BASE}/api/tenant/staff?id=${s.id}`, {
          method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
        });
        fetchStaff();
      }},
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
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                  {item.location_ids.length > 0 && (
                    <Text style={styles.chipBadge}>{item.location_ids.length} location{item.location_ids.length > 1 ? 's' : ''}</Text>
                  )}
                  {item.service_ids.length > 0 && (
                    <Text style={styles.chipBadge}>{item.service_ids.length} service{item.service_ids.length > 1 ? 's' : ''}</Text>
                  )}
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
            <Text style={{ fontSize: 17, fontWeight: '700' }}>{editing ? 'Edit Staff' : 'Add Staff'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving}><Text style={{ fontSize: 16, fontWeight: '600', color: '#6B7FC4' }}>{saving ? 'Saving...' : 'Save'}</Text></TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
            <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Full name *" placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} value={formEmail} onChangeText={setFormEmail} placeholder="Email address" placeholderTextColor="#9ca3af" keyboardType="email-address" autoCapitalize="none" />
            <TextInput style={styles.input} value={formPhone} onChangeText={setFormPhone} placeholder="Phone number" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />

            {/* Location assignment */}
            {locations.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Assign to Locations</Text>
                {locations.map(loc => (
                  <TouchableOpacity key={loc.id} style={styles.checkRow} onPress={() => setFormLocIds(toggleItem(formLocIds, loc.id))}>
                    <Ionicons name={formLocIds.includes(loc.id) ? 'checkbox' : 'square-outline'} size={22} color={formLocIds.includes(loc.id) ? '#6B7FC4' : '#d1d5db'} />
                    <Text style={styles.checkLabel}>{loc.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Service assignment */}
            {services.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Assign Services</Text>
                {services.map(svc => (
                  <TouchableOpacity key={svc.id} style={styles.checkRow} onPress={() => setFormSvcIds(toggleItem(formSvcIds, svc.id))}>
                    <Ionicons name={formSvcIds.includes(svc.id) ? 'checkbox' : 'square-outline'} size={22} color={formSvcIds.includes(svc.id) ? '#6B7FC4' : '#d1d5db'} />
                    <Text style={styles.checkLabel}>{svc.name}</Text>
                  </TouchableOpacity>
                ))}
              </>
            )}

            {/* Send invite toggle */}
            {!editing && (
              <View style={styles.inviteRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionLabel}>Send Invite Email</Text>
                  <Text style={styles.formHint}>Staff will receive an invite code to download the app and create their account</Text>
                </View>
                <Switch value={sendInvite} onValueChange={setSendInvite} trackColor={{ false: '#e5e7eb', true: '#6B7FC4' }} thumbColor="#fff" disabled={!formEmail.trim()} />
              </View>
            )}

            <Text style={styles.formHint}>Default schedule: Mon-Sat 9am-5pm. Adjust from the desktop dashboard.</Text>
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
  chipBadge: { fontSize: 11, color: '#6B7FC4', backgroundColor: '#eef2ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, overflow: 'hidden' },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  form: { padding: 20, paddingBottom: 60 },
  input: { backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' },
  sectionLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginTop: 16, marginBottom: 8 },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  checkLabel: { fontSize: 15, color: '#111827' },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, paddingVertical: 8 },
  formHint: { fontSize: 13, color: '#9ca3af', marginTop: 4, lineHeight: 18 },
});
