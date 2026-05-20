import { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, Alert,
  ScrollView, Linking, ActivityIndicator, SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

let Clipboard: { setStringAsync?: (s: string) => Promise<void> } | null = null;
try { Clipboard = require('expo-clipboard'); } catch {}

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface ExternalCalendar {
  id: string;
  name: string;
  ical_url: string;
  last_synced_at: string | null;
  last_error: string | null;
  is_active: boolean;
}

interface GoogleConnection {
  id: string;
  google_email: string;
  is_active: boolean;
}

interface Props {
  staffId: string;
  getToken: () => Promise<string | null>;
  visible: boolean;
  onClose: () => void;
}

export function CalendarSyncModal({ staffId, getToken, visible, onClose }: Props) {
  const [feedToken, setFeedToken] = useState('');
  const [calendars, setCalendars] = useState<ExternalCalendar[]>([]);
  const [googleConn, setGoogleConn] = useState<GoogleConnection | null>(null);
  const [loading, setLoading] = useState(true);
  const [addName, setAddName] = useState('');
  const [addUrl, setAddUrl] = useState('');
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    if (!token) { setLoading(false); return; }
    try {
      const [calRes, gcalRes] = await Promise.all([
        fetch(`${API_BASE}/api/tenant/staff-calendars?staffId=${staffId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${API_BASE}/api/tenant/google-calendar?staffId=${staffId}`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ]);
      const calJson = await calRes.json();
      if (calJson.data) {
        setFeedToken(calJson.data.feedToken ?? '');
        setCalendars(calJson.data.calendars ?? []);
      }
      if (gcalRes?.ok) {
        const gcalJson = await gcalRes.json();
        setGoogleConn(gcalJson.data ?? null);
      }
    } catch { /* ignore */ }
    setLoading(false);
  }, [staffId, getToken]);

  useEffect(() => {
    if (visible) fetchData();
  }, [visible, fetchData]);

  const feedUrl = feedToken ? `${API_BASE}/api/calendar/${feedToken}` : '';

  const handleCopy = async () => {
    if (Clipboard?.setStringAsync) {
      await Clipboard.setStringAsync(feedUrl);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddCalendar = async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    setError('');
    const token = await getToken();
    if (!token) { setAdding(false); return; }
    try {
      const res = await fetch(`${API_BASE}/api/tenant/staff-calendars`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ staffId, name: addName.trim() || 'External Calendar', icalUrl: addUrl.trim() }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? 'Failed to add');
      } else {
        setAddName('');
        setAddUrl('');
        setShowAddForm(false);
        fetchData();
      }
    } catch {
      setError('Network error');
    }
    setAdding(false);
  };

  const handleDeleteCalendar = (id: string, name: string) => {
    Alert.alert('Remove Calendar', `Remove "${name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await fetch(`${API_BASE}/api/tenant/staff-calendars?id=${id}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          fetchData();
        },
      },
    ]);
  };

  const handleConnectGoogle = () => {
    Linking.openURL(`${API_BASE}/api/tenant/google-calendar/auth?staffId=${staffId}`);
  };

  const handleDisconnectGoogle = () => {
    Alert.alert('Disconnect Google Calendar', 'Your Google Calendar will no longer sync with Balkina.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Disconnect', style: 'destructive', onPress: async () => {
          const token = await getToken();
          if (!token) return;
          await fetch(`${API_BASE}/api/tenant/google-calendar?staffId=${staffId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${token}` },
          });
          setGoogleConn(null);
        },
      },
    ]);
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={s.container}>
        <View style={s.header}>
          <Text style={s.headerTitle}>Calendar Sync</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn}>
            <Ionicons name="close" size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color="#6B7FC4" />
          </View>
        ) : (
          <ScrollView style={s.scrollContent} contentContainerStyle={s.scrollInner}>
            {/* Google Calendar */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={[s.iconBg, { backgroundColor: '#e8f5e9' }]}>
                  <Ionicons name="logo-google" size={18} color="#4285F4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>Google Calendar</Text>
                  <Text style={s.sectionDesc}>Real-time two-way sync. Bookings push automatically.</Text>
                </View>
              </View>
              {googleConn ? (
                <View style={s.connectedRow}>
                  <Ionicons name="checkmark-circle" size={20} color="#16a34a" />
                  <Text style={s.connectedEmail}>{googleConn.google_email}</Text>
                  <TouchableOpacity onPress={handleDisconnectGoogle}>
                    <Text style={s.disconnectText}>Disconnect</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.connectBtn} onPress={handleConnectGoogle}>
                  <Text style={s.connectBtnText}>Connect Google Calendar</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Export Calendar */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={[s.iconBg, { backgroundColor: '#e8f0fe' }]}>
                  <Ionicons name="share-outline" size={18} color="#6B7FC4" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>Export Calendar</Text>
                  <Text style={s.sectionDesc}>Copy this URL into Outlook, Apple Calendar, or any iCal app.</Text>
                </View>
              </View>
              {feedUrl ? (
                <View style={s.feedUrlRow}>
                  <Text style={s.feedUrl} numberOfLines={1}>{feedUrl}</Text>
                  <TouchableOpacity style={s.copyBtn} onPress={handleCopy}>
                    <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={16} color="#fff" />
                    <Text style={s.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={s.emptyText}>Feed URL not available.</Text>
              )}
            </View>

            {/* Import Calendars */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={[s.iconBg, { backgroundColor: '#fef9c3' }]}>
                  <Ionicons name="download-outline" size={18} color="#ca8a04" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.sectionTitle}>Import iCal Calendars</Text>
                  <Text style={s.sectionDesc}>Add URLs from Airbnb, Calendly, etc. Syncs every 15 min.</Text>
                </View>
              </View>

              {calendars.map((cal) => (
                <View key={cal.id} style={s.calRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.calName}>{cal.name}</Text>
                    <Text style={s.calStatus}>
                      {cal.last_synced_at
                        ? `Synced ${new Date(cal.last_synced_at).toLocaleDateString()}`
                        : 'Not synced yet'}
                      {cal.last_error ? ` — Error` : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteCalendar(cal.id, cal.name)}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {showAddForm ? (
                <View style={s.addForm}>
                  <TextInput style={s.input} placeholder="Calendar name" value={addName} onChangeText={setAddName} placeholderTextColor="#9ca3af" />
                  <TextInput style={s.input} placeholder="iCal URL (https://...)" value={addUrl} onChangeText={setAddUrl} placeholderTextColor="#9ca3af" autoCapitalize="none" keyboardType="url" />
                  {error ? <Text style={s.errorText}>{error}</Text> : null}
                  <View style={s.addFormButtons}>
                    <TouchableOpacity onPress={() => { setShowAddForm(false); setError(''); }} style={s.cancelFormBtn}>
                      <Text style={s.cancelFormText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleAddCalendar} disabled={adding || !addUrl.trim()} style={[s.addFormBtn, (!addUrl.trim() || adding) && { opacity: 0.5 }]}>
                      <Text style={s.addFormBtnText}>{adding ? 'Adding...' : 'Add'}</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <TouchableOpacity style={s.addCalBtn} onPress={() => setShowAddForm(true)}>
                  <Ionicons name="add-circle-outline" size={18} color="#6B7FC4" />
                  <Text style={s.addCalText}>Add Calendar</Text>
                </TouchableOpacity>
              )}
            </View>
          </ScrollView>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#e5e7eb', backgroundColor: '#fff' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  closeBtn: { padding: 4 },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollContent: { flex: 1 },
  scrollInner: { padding: 16, gap: 16 },
  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  iconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#111827' },
  sectionDesc: { fontSize: 12, color: '#6b7280', marginTop: 2 },
  connectedRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#f0fdf4', borderRadius: 10, padding: 12 },
  connectedEmail: { flex: 1, fontSize: 13, fontWeight: '600', color: '#111827' },
  disconnectText: { fontSize: 12, fontWeight: '600', color: '#ef4444' },
  connectBtn: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#d1d5db', borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  connectBtnText: { fontSize: 14, fontWeight: '600', color: '#374151' },
  feedUrlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feedUrl: { flex: 1, fontSize: 12, fontFamily: 'monospace', color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6B7FC4', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  copyBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },
  emptyText: { fontSize: 12, color: '#9ca3af', fontStyle: 'italic' },
  calRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#f9fafb', borderRadius: 10, padding: 12 },
  calName: { fontSize: 13, fontWeight: '600', color: '#111827' },
  calStatus: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  addCalBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8 },
  addCalText: { fontSize: 14, fontWeight: '600', color: '#6B7FC4' },
  addForm: { gap: 10 },
  input: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111827' },
  errorText: { fontSize: 12, color: '#ef4444' },
  addFormButtons: { flexDirection: 'row', gap: 10 },
  cancelFormBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  cancelFormText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  addFormBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center', backgroundColor: '#6B7FC4' },
  addFormBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
});
