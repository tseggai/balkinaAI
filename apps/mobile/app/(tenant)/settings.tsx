import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, ActivityIndicator, Image, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { CalendarSyncModal } from '@/components/CalendarSyncModal';
import { BokunIntegrationModal } from '@/components/BokunIntegrationModal';
import Constants from 'expo-constants';
import { supabase, supabaseConfigured } from '@/lib/supabase';
import { pickAndUploadPhoto } from '@/lib/usePhotoUpload';
import { useTenantPermissions } from '@/lib/tenantPermissions';

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

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

export default function TenantSettings() {
  const router = useRouter();
  const perms = useTenantPermissions();
  const [tenant, setTenant] = useState<TenantData | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [calSyncVisible, setCalSyncVisible] = useState(false);
  const [bokunVisible, setBokunVisible] = useState(false);
  const [ownerStaffId, setOwnerStaffId] = useState<string | null>(null);

  // Form
  const [formName, setFormName] = useState('');
  const [formOwnerName, setFormOwnerName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formCategoryIds, setFormCategoryIds] = useState<string[]>([]);
  const [showCategoryPicker, setShowCategoryPicker] = useState(false);
  const [dangerZoneExpanded, setDangerZoneExpanded] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');

  const fetchTenant = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: t }, { data: cats }, { data: staffRec }] = await Promise.all([
        supabase.from('tenants').select('id, name, owner_name, email, phone, logo_url, category_id').eq('user_id', user.id).single(),
        supabase.from('categories').select('id, name').is('parent_id', null).order('display_order'),
        supabase.from('staff').select('id').eq('user_id', user.id).limit(1).maybeSingle(),
      ]);
      if (staffRec) setOwnerStaffId((staffRec as { id: string }).id);

      if (t) {
        const td = t as TenantData;
        setTenant(td);
        setFormName(td.name);
        setFormOwnerName(td.owner_name ?? '');
        setFormPhone(td.phone ?? '');
        const { data: tcLinks } = await supabase
          .from('tenant_category_links')
          .select('category_id')
          .eq('tenant_id', td.id);
        setFormCategoryIds(((tcLinks ?? []) as { category_id: string }[]).map((l) => l.category_id));
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
        owner_name: formOwnerName.trim() || null,
        phone: formPhone.trim() || null,
        category_id: formCategoryIds[0] || null,
      } as never).eq('id', tenant.id);
      await supabase.from('tenant_category_links').delete().eq('tenant_id', tenant.id);
      if (formCategoryIds.length > 0) {
        await supabase.from('tenant_category_links').insert(
          formCategoryIds.map((cid) => ({ tenant_id: tenant.id, category_id: cid })) as never
        );
      }
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

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'This will permanently delete your account, your business, all services, staff, bookings, and customer data. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete Everything',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!supabaseConfigured) return;
              const { data: { session } } = await supabase.auth.getSession();
              if (!session) {
                Alert.alert('Error', 'Please sign in again to delete your account.');
                return;
              }
              const res = await fetch(`${API_BASE}/api/customers/profile`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${session.access_token}` },
              });
              if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                Alert.alert('Error', (data as { error?: string }).error || 'Failed to delete account.');
                return;
              }
              await supabase.auth.signOut();
              Alert.alert('Account Deleted', 'Your account and all business data have been permanently deleted.');
            } catch {
              Alert.alert('Error', 'Network error. Please try again.');
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;
  }

  const selectedCatNames = formCategoryIds.length > 0
    ? categories.filter(c => formCategoryIds.includes(c.id)).map(c => c.name).join(', ')
    : 'Not set';

  const isDeleteEnabled = deleteConfirmText.trim().toUpperCase() === 'DELETE';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Business Profile */}
      <View style={styles.card}>
        <View style={styles.profileHeader}>
          <TouchableOpacity onPress={async () => {
            const url = await pickAndUploadPhoto('logo');
            if (url && tenant) {
              await supabase.from('tenants').update({ logo_url: url } as never).eq('id', tenant.id);
              fetchTenant();
            }
          }}>
            {tenant?.logo_url ? (
              <Image source={{ uri: tenant.logo_url }} style={styles.logo} />
            ) : (
              <View style={styles.logoPlaceholder}>
                <Text style={styles.logoText}>{(tenant?.name ?? 'B').charAt(0)}</Text>
              </View>
            )}
            <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: '#6B7FC4', borderRadius: 10, width: 20, height: 20, justifyContent: 'center', alignItems: 'center' }}>
              <Ionicons name="camera" size={12} color="#fff" />
            </View>
          </TouchableOpacity>
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
            <TextInput style={styles.input} value={formOwnerName} onChangeText={setFormOwnerName} placeholder="Owner name" placeholderTextColor="#9ca3af" />
            <TextInput style={styles.input} value={formPhone} onChangeText={setFormPhone} placeholder="Phone number" placeholderTextColor="#9ca3af" keyboardType="phone-pad" />

            <TouchableOpacity style={styles.input} onPress={() => setShowCategoryPicker(!showCategoryPicker)}>
              <Text style={{ fontSize: 16, color: formCategoryIds.length > 0 ? '#111827' : '#9ca3af' }} numberOfLines={2}>{formCategoryIds.length > 0 ? selectedCatNames : 'Select categories'}</Text>
            </TouchableOpacity>
            {showCategoryPicker && (
              <View style={styles.pickerList}>
                {categories.map((cat) => {
                  const isSelected = formCategoryIds.includes(cat.id);
                  return (
                    <TouchableOpacity
                      key={cat.id}
                      style={[styles.pickerItem, isSelected && styles.pickerItemActive]}
                      onPress={() => setFormCategoryIds(isSelected ? formCategoryIds.filter(id => id !== cat.id) : [...formCategoryIds, cat.id])}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Ionicons name={isSelected ? 'checkbox' : 'square-outline'} size={20} color={isSelected ? '#6B7FC4' : '#d1d5db'} />
                        <Text style={[styles.pickerItemText, isSelected && { color: '#6B7FC4', fontWeight: '600' }]}>{cat.name}</Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving...' : 'Save Changes'}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Calendar Sync */}
      {ownerStaffId && (
        <>
          <Text style={styles.sectionTitle}>Calendar Sync</Text>
          <View style={styles.card}>
            <TouchableOpacity style={styles.linkRow} onPress={() => setCalSyncVisible(true)}>
              <View style={styles.linkRowLeft}>
                <Ionicons name="calendar-outline" size={20} color="#6B7FC4" />
                <View>
                  <Text style={styles.linkRowLabel}>Manage Calendar Sync</Text>
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>Google Calendar, export, import iCal</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
            </TouchableOpacity>
          </View>
          <CalendarSyncModal
            staffId={ownerStaffId}
            getToken={async () => {
              const { data: { session } } = await supabase.auth.getSession();
              return session?.access_token ?? null;
            }}
            visible={calSyncVisible}
            onClose={() => setCalSyncVisible(false)}
          />
        </>
      )}

      {/* OTA Distribution */}
      <Text style={styles.sectionTitle}>OTA Distribution</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.linkRow} onPress={() => setBokunVisible(true)}>
          <View style={styles.linkRowLeft}>
            <Ionicons name="globe-outline" size={20} color="#6B7FC4" />
            <View>
              <Text style={styles.linkRowLabel}>Bokun Integration</Text>
              <Text style={{ fontSize: 12, color: '#9ca3af' }}>Sync bookings from Viator, GetYourGuide, Airbnb</Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
        </TouchableOpacity>
      </View>
      {tenant && (
        <BokunIntegrationModal
          tenantId={tenant.id}
          visible={bokunVisible}
          onClose={() => setBokunVisible(false)}
        />
      )}

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

      {/* Danger Zone — collapsible */}
      <Text style={styles.sectionTitle}>Danger Zone</Text>
      <View style={styles.card}>
        <TouchableOpacity
          style={styles.linkRow}
          onPress={() => {
            setDangerZoneExpanded(!dangerZoneExpanded);
            if (dangerZoneExpanded) setDeleteConfirmText('');
          }}
          activeOpacity={0.6}
        >
          <View style={styles.linkRowLeft}>
            <Ionicons name="warning-outline" size={20} color="#dc2626" />
            <View>
              <Text style={[styles.linkRowLabel, { color: '#dc2626' }]}>Delete Account</Text>
              <Text style={styles.linkRowSub}>Permanently remove your account and business</Text>
            </View>
          </View>
          <Ionicons
            name={dangerZoneExpanded ? 'chevron-up' : 'chevron-down'}
            size={18}
            color="#d1d5db"
          />
        </TouchableOpacity>

        {dangerZoneExpanded && (
          <View style={styles.dangerZoneContent}>
            <Text style={styles.dangerZoneWarning}>
              This action is irreversible. Your account, business, all services, staff, bookings, and customer data will be permanently deleted.
            </Text>
            <Text style={styles.dangerZonePrompt}>
              Type <Text style={styles.dangerZoneDeleteWord}>DELETE</Text> to confirm:
            </Text>
            <TextInput
              style={styles.dangerZoneInput}
              value={deleteConfirmText}
              onChangeText={setDeleteConfirmText}
              placeholder="Type DELETE here"
              placeholderTextColor="#d1d5db"
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <TouchableOpacity
              style={[
                styles.dangerZoneButton,
                !isDeleteEnabled && styles.dangerZoneButtonDisabled,
              ]}
              onPress={handleDeleteAccount}
              disabled={!isDeleteEnabled}
              activeOpacity={0.6}
            >
              <Ionicons name="trash-outline" size={16} color={isDeleteEnabled ? '#fff' : '#f9a8a8'} />
              <Text
                style={[
                  styles.dangerZoneButtonText,
                  !isDeleteEnabled && styles.dangerZoneButtonTextDisabled,
                ]}
              >
                Delete My Account
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      <Text style={styles.version}>Balkina AI · v{Constants.expoConfig?.version ?? '1.1.0'}</Text>
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

  // Danger Zone
  dangerZoneContent: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: '#FEE2E2' },
  dangerZoneWarning: { fontSize: 13, color: '#6b7280', lineHeight: 18, marginTop: 12, marginBottom: 12 },
  dangerZonePrompt: { fontSize: 13, fontWeight: '600', color: '#374151', marginBottom: 8 },
  dangerZoneDeleteWord: { color: '#dc2626', fontWeight: '700' },
  dangerZoneInput: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#FCA5A5', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, fontSize: 16, color: '#111827', marginBottom: 12 },
  dangerZoneButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#dc2626', borderRadius: 12, paddingVertical: 14 },
  dangerZoneButtonDisabled: { backgroundColor: '#FEE2E2' },
  dangerZoneButtonText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  dangerZoneButtonTextDisabled: { color: '#f9a8a8' },
});
