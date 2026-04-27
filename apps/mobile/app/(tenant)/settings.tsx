import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface TenantData {
  id: string;
  name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  logo_url: string | null;
  category_id: string | null;
}

interface Category {
  id: string;
  name: string;
}

export default function TenantSettings() {
  const router = useRouter();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Form
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);

  const fetchTenant = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: t }, { data: cats }] = await Promise.all([
        supabase.from('tenants').select('id, name, owner_name, email, phone, logo_url, category_id').eq('user_id', user.id).single(),
        supabase.from('categories').select('id, name').is('parent_id', null).order('display_order'),
      ]);

      if (t) {
        const td = t as TenantData;
        setTenant(td);
        setFormName(td.name);
        setFormPhone(td.phone ?? '');
        setFormCategoryId(td.category_id ?? '');
      }
      if (cats) setCategories(cats as Category[]);
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);

  const handleSave = async () => {
    if (!tenant || !formName.trim()) return;
    setSaving(true);
    try {
      await supabase.from('tenants').update({
        name: formName.trim(),
        phone: formPhone.trim() || null,
        category_id: formCategoryId || null,
      } as never).eq('id', tenant.id);
      setEditMode(false);
      fetchTenant();
    } catch {
      Alert.alert('Error', 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => supabase.auth.signOut() },
    ]);
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;
  }

  const selectedCatName = categories.find(c => c.id === formCategoryId)?.name ?? 'Not set';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Business Profile */}
      <View style={styles.card}>
        <View style={styles.profileHeader}>
          {tenant?.logo_url ? (
            <Image source={{ uri: tenant.logo_url }} style={styles.logo} />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>{(tenant?.name ?? 'B').charAt(0)}</Text>
            </View>
          )}
          <View style={{ flex: 1 }}>
            <Text style={styles.businessName}>{tenant?.name}</Text>
            {tenant?.email && <Text style={styles.businessEmail}>{tenant.email}</Text>}
          </View>
          <TouchableOpacity onPress={() => setEditMode(!editMode)}>
            <Ionicons name={editMode ? 'close' : 'create-outline'} size={22} color="#6B7FC4" />
          </TouchableOpacity>
        </View>

        {editMode && (
          <View style={styles.editSection}>
            <TextInput style={styles.input} value={formName} onChangeText={setFormName} placeholder="Business name" placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} value={formPhone} onChangeText={setFormPhone} placeholder="Phone number" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />

            <TouchableOpacity style={styles.input} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
              <Text style={{ fontSize: 16, color: formCategoryId ? '#111827' : '#9ca3af' }}>{formCategoryId ? selectedCatName : 'Select category'}</Text>
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.pickerList}>
                {categories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={[styles.pickerItem, formCategoryId === cat.id && styles.pickerItemActive]}
                    onPress={() => { setFormCategoryId(cat.id); setShowCategoryPicker(false); }}
                  >
                    <Text style={[styles.pickerItemText, formCategoryId === cat.id && { color: '#6B7FC4', fontWeight: '600' }]}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* In-App Management */}
      <Text style={styles.sectionTitle}>Management</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.navigate('/(tenant)/locations')}>
          <View style={styles.linkRowLeft}>
            <Ionicons name="location-outline" size={20} color="#6B7FC4" />
            <View>
              <Text style={styles.linkRowLabel}>Locations</Text>
              <Text style={styles.linkRowSub}>Manage your business locations</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
        </TouchableOpacity>

        <View style={styles.separator} />

        {/* Desktop links for advanced features */}
        <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://app.balkina.ai/dashboard')}>
          <View style={styles.linkRowLeft}>
            <Ionicons name="desktop-outline" size={20} color="#6B7FC4" />
            <View>
              <Text style={styles.linkRowLabel}>Full Dashboard</Text>
              <Text style={styles.linkRowSub}>Staff schedules, analytics, advanced settings</Text>
            </View>
          </View>
          <Ionicons name="open-outline" size={16} color="#d1d5db" />
        </TouchableOpacity>

        <View style={styles.separator} />

        <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://app.balkina.ai/dashboard/staff')}>
          <View style={styles.linkRowLeft}>
            <Ionicons name="people-outline" size={20} color="#6B7FC4" />
            <View>
              <Text style={styles.linkRowLabel}>Staff Management</Text>
              <Text style={styles.linkRowSub}>Add staff, set schedules, send invites</Text>
            </View>
          </View>
          <Ionicons name="open-outline" size={16} color="#d1d5db" />
        </TouchableOpacity>

        <View style={styles.separator} />

        <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://app.balkina.ai/dashboard/locations')}>
          <View style={styles.linkRowLeft}>
            <Ionicons name="location-outline" size={20} color="#6B7FC4" />
            <View>
              <Text style={styles.linkRowLabel}>Locations</Text>
              <Text style={styles.linkRowSub}>Manage addresses, gallery photos</Text>
            </View>
          </View>
          <Ionicons name="open-outline" size={16} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      {/* Legal */}
      <Text style={styles.sectionTitle}>Legal</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://balkina.ai/terms')}>
          <View style={styles.linkRowLeft}>
            <Ionicons name="document-text-outline" size={20} color="#6b7280" />
            <Text style={styles.linkRowLabel}>Terms of Service</Text>
          </View>
          <Ionicons name="open-outline" size={16} color="#d1d5db" />
        </TouchableOpacity>
        <View style={styles.separator} />
        <TouchableOpacity style={styles.linkRow} onPress={() => Linking.openURL('https://balkina.ai/privacy')}>
          <View style={styles.linkRowLeft}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#6b7280" />
            <Text style={styles.linkRowLabel}>Privacy Policy</Text>
          </View>
          <Ionicons name="open-outline" size={16} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      {/* Switch Role */}
      <View style={[styles.card, { marginTop: 20 }]}>
        <TouchableOpacity style={styles.linkRow} onPress={() => router.replace('/(app)')}>
          <View style={styles.linkRowLeft}>
            <Ionicons name="swap-horizontal-outline" size={20} color="#6B7FC4" />
            <View>
              <Text style={styles.linkRowLabel}>Switch to Customer</Text>
              <Text style={styles.linkRowSub}>Book services as a customer</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
        </TouchableOpacity>
      </View>

      {/* Sign Out */}
      <View style={[styles.card, { marginTop: 12 }]}>
        <TouchableOpacity style={styles.linkRow} onPress={handleSignOut}>
          <View style={styles.linkRowLeft}>
            <Ionicons name="log-out-outline" size={20} color="#dc2626" />
            <Text style={[styles.linkRowLabel, { color: '#dc2626' }]}>Sign Out</Text>
          </View>
        </TouchableOpacity>
      </View>

      <Text style={styles.version}>Balkina AI · v1.0.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 16, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  card: { backgroundColor: '#fff', borderRadius: 14, overflow: 'hidden', borderWidth: 1, borderColor: '#f3f4f6' },
  profileHeader: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 },
  logo: { width: 52, height: 52, borderRadius: 12 },
  logoPlaceholder: { width: 52, height: 52, borderRadius: 12, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center' },
  logoText: { fontSize: 22, fontWeight: '700', color: '#fff' },
  businessName: { fontSize: 18, fontWeight: '700', color: '#111827' },
  businessEmail: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  editSection: { padding: 16, paddingTop: 0 },
  input: { backgroundColor: '#f9fafb', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: '#111827', marginBottom: 10 },
  pickerList: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 10, overflow: 'hidden' },
  pickerItem: { paddingVertical: 12, paddingHorizontal: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  pickerItemActive: { backgroundColor: '#eef2ff' },
  pickerItemText: { fontSize: 15, color: '#374151' },
  saveBtn: { backgroundColor: '#6B7FC4', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 4 },
  saveBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 24, marginBottom: 8, marginLeft: 4 },
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 14, paddingHorizontal: 16 },
  linkRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  linkRowLabel: { fontSize: 15, fontWeight: '500', color: '#111827' },
  linkRowSub: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  separator: { height: 1, backgroundColor: '#f3f4f6', marginHorizontal: 16 },
  version: { textAlign: 'center', fontSize: 12, color: '#d1d5db', marginTop: 24 },
});
