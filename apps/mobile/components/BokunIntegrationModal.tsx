import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput,
  ScrollView, SafeAreaView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

let Clipboard: { setStringAsync?: (s: string) => Promise<void> } | null = null;
try { Clipboard = require('expo-clipboard'); } catch {}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface Props {
  tenantId: string;
  visible: boolean;
  onClose: () => void;
}

export function BokunIntegrationModal({ tenantId, visible, onClose }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [vendorId, setVendorId] = useState('');
  const [savedVendorId, setSavedVendorId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${API_BASE}/api/webhooks/bokun`;

  const fetchData = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('tenants')
      .select('bokun_vendor_id')
      .eq('id', tenantId)
      .single();
    const t = data as { bokun_vendor_id: string | null } | null;
    if (t?.bokun_vendor_id) {
      setVendorId(t.bokun_vendor_id);
      setSavedVendorId(t.bokun_vendor_id);
      setEnabled(true);
    }
    setLoading(false);
  }, [tenantId]);

  useEffect(() => {
    if (visible) fetchData();
  }, [visible, fetchData]);

  const handleSave = async () => {
    if (enabled && !vendorId.trim()) {
      Alert.alert('Required', 'Please enter your Bokun Vendor ID');
      return;
    }
    setSaving(true);
    await supabase
      .from('tenants')
      .update({ bokun_vendor_id: enabled ? vendorId.trim() : null } as never)
      .eq('id', tenantId);
    setSavedVendorId(enabled ? vendorId.trim() : '');
    setSaving(false);
    if (!enabled) {
      setVendorId('');
    }
  };

  const handleCopy = async () => {
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(webhookUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleToggle = () => {
    const next = !enabled;
    setEnabled(next);
    if (!next) {
      setSaving(true);
      supabase
        .from('tenants')
        .update({ bokun_vendor_id: null } as never)
        .eq('id', tenantId)
        .then(() => {
          setVendorId('');
          setSavedVendorId('');
          setSaving(false);
        });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>OTA Distribution</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        <ScrollView style={s.scroll} contentContainerStyle={s.scrollInner}>
          <Text style={s.desc}>
            Connect your Bokun account to sync bookings from Viator, GetYourGuide, Airbnb Experiences, and other OTAs. Bookings and cancellations sync automatically.
          </Text>

          {/* Enable toggle */}
          <View style={s.toggleRow}>
            <View style={{ flex: 1 }}>
              <Text style={s.toggleLabel}>Enable Bokun Integration</Text>
              <Text style={s.toggleDesc}>Receive OTA bookings in Balkina</Text>
            </View>
            <TouchableOpacity
              onPress={handleToggle}
              style={[s.toggle, enabled && s.toggleOn]}
            >
              <View style={[s.toggleThumb, enabled && s.toggleThumbOn]} />
            </TouchableOpacity>
          </View>

          {enabled && !loading && (
            <>
              {/* Vendor ID input */}
              <View style={s.section}>
                <Text style={s.label}>Bokun Vendor ID</Text>
                <Text style={s.hint}>
                  Find this in your Bokun dashboard — it's the number next to your company name (e.g. "My Business (140057)").
                </Text>
                <TextInput
                  style={s.input}
                  value={vendorId}
                  onChangeText={setVendorId}
                  placeholder="e.g. 140057"
                  placeholderTextColor="#9ca3af"
                  keyboardType="number-pad"
                />
                <TouchableOpacity
                  style={[s.saveBtn, (saving || vendorId.trim() === savedVendorId) && s.saveBtnDisabled]}
                  onPress={handleSave}
                  disabled={saving || vendorId.trim() === savedVendorId}
                >
                  <Text style={s.saveBtnText}>{saving ? 'Saving...' : 'Save'}</Text>
                </TouchableOpacity>
              </View>

              {/* Setup instructions */}
              {savedVendorId ? (
                <View style={s.instructionsCard}>
                  <Text style={s.instructionsTitle}>Setup Instructions</Text>
                  <Text style={s.instructionsSubtitle}>Complete these steps in your Bokun dashboard:</Text>

                  <View style={s.step}>
                    <View style={s.stepNum}><Text style={s.stepNumText}>1</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.stepTitle}>Create your products in Bokun</Text>
                      <Text style={s.stepDesc}>Product names must match your Balkina service names exactly.</Text>
                    </View>
                  </View>

                  <View style={s.step}>
                    <View style={s.stepNum}><Text style={s.stepNumText}>2</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.stepTitle}>Connect OTA sales channels</Text>
                      <Text style={s.stepDesc}>In Bokun, go to Marketplace → OTAs and connect Viator, GetYourGuide, etc.</Text>
                    </View>
                  </View>

                  <View style={s.step}>
                    <View style={s.stepNum}><Text style={s.stepNumText}>3</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={s.stepTitle}>Add the Balkina webhook</Text>
                      <Text style={s.stepDesc}>
                        Go to Settings → Connections → Integrated systems → Add → HTTP Booking notification. Paste this URL and check all three notification boxes:
                      </Text>
                      <View style={s.urlRow}>
                        <Text style={s.urlText} numberOfLines={1}>{webhookUrl}</Text>
                        <TouchableOpacity style={s.copyBtn} onPress={handleCopy}>
                          <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color="#fff" />
                          <Text style={s.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>

                  <View style={s.successBanner}>
                    <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                    <Text style={s.successText}>
                      Once configured, OTA bookings and cancellations will automatically sync to your Balkina appointments.
                    </Text>
                  </View>
                </View>
              ) : null}
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 4 },
  scroll: { flex: 1 },
  scrollInner: { padding: 20, gap: 20 },
  desc: { fontSize: 14, color: '#6b7280', lineHeight: 20 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  toggleLabel: { fontSize: 15, fontWeight: '600', color: '#111827' },
  toggleDesc: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  toggle: { width: 48, height: 28, borderRadius: 14, backgroundColor: '#e5e7eb', justifyContent: 'center', paddingHorizontal: 2 },
  toggleOn: { backgroundColor: '#6B7FC4' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' },
  toggleThumbOn: { alignSelf: 'flex-end' },
  section: { gap: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  hint: { fontSize: 12, color: '#9ca3af', lineHeight: 16 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: '#111827' },
  saveBtn: { backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  instructionsCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 14 },
  instructionsTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  instructionsSubtitle: { fontSize: 12, color: '#6b7280' },
  step: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  stepNum: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center' },
  stepNumText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  stepTitle: { fontSize: 14, fontWeight: '600', color: '#111827' },
  stepDesc: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 16 },
  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  urlText: { flex: 1, fontSize: 11, fontFamily: 'monospace', color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6B7FC4', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  copyBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  successBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12 },
  successText: { flex: 1, fontSize: 12, color: '#166534', lineHeight: 16 },
});
