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
  const [showIcal, setShowIcal] = useState(false);

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
    if (visible) { fetchData(); setShowIcal(false); }
  }, [visible, fetchData]);

  const feedUrl = feedToken ? `${API_BASE}/api/calendar/${feedToken}` : '';

  const handleCopy = async (text: string) => {
    if (Clipboard?.setStringAsync) await Clipboard.setStringAsync(text);
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
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
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
            method: 'DELETE', headers: { Authorization: `Bearer ${token}` },
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
          <Text style={s.headerTitle}>{showIcal ? 'iCal Calendars' : 'Calendar Sync'}</Text>
          <TouchableOpacity onPress={showIcal ? () => setShowIcal(false) : onClose} style={s.closeBtn}>
            <Ionicons name={showIcal ? 'arrow-back' : 'close'} size={24} color="#6b7280" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color="#6B7FC4" />
          </View>
        ) : showIcal ? (
          <ScrollView style={s.scrollContent} contentContainerStyle={s.scrollInner}>
            {/* Export section */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={[s.iconBg, { backgroundColor: '#e8f0fe' }]}>
                  <Ionicons name="share-outline" size={18} color="#6B7FC4" />
                </View>
                <Text style={s.sectionTitle}>Export Your Balkina Calendar</Text>
              </View>
              <Text style={s.instructions}>
                Copy this URL and paste it into your calendar app to see your Balkina bookings. Here's how:
              </Text>
              <View style={s.stepList}>
                <Text style={s.stepText}>
                  <Text style={s.bold}>Google Calendar:</Text> Settings → "Other calendars" → "From URL" → paste the URL
                </Text>
                <Text style={s.stepText}>
                  <Text style={s.bold}>Apple Calendar:</Text> File → New Calendar Subscription → paste the URL
                </Text>
                <Text style={s.stepText}>
                  <Text style={s.bold}>Outlook:</Text> Add calendar → Subscribe from web → paste the URL
                </Text>
              </View>
              {feedUrl ? (
                <View style={s.urlRow}>
                  <Text style={s.urlText} numberOfLines={1}>{feedUrl}</Text>
                  <TouchableOpacity style={s.copyBtn} onPress={() => handleCopy(feedUrl)}>
                    <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={14} color="#fff" />
                    <Text style={s.copyBtnText}>{copied ? 'Copied' : 'Copy'}</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={s.emptyText}>Feed URL not available.</Text>
              )}
            </View>

            {/* Import section */}
            <View style={s.section}>
              <View style={s.sectionHeader}>
                <View style={[s.iconBg, { backgroundColor: '#fef9c3' }]}>
                  <Ionicons name="download-outline" size={18} color="#ca8a04" />
                </View>
                <Text style={s.sectionTitle}>Import External Calendars</Text>
              </View>
              <Text style={s.instructions}>
                Add iCal feed URLs from other platforms to block those busy times. Here's where to find them:
              </Text>
              <View style={s.stepList}>
                <Text style={s.stepText}>
                  <Text style={s.bold}>Google Calendar:</Text> Settings → click your calendar → "Secret address in iCal format" → copy
                </Text>
                <Text style={s.stepText}>
                  <Text style={s.bold}>Apple Calendar:</Text> Right-click calendar → Sharing Settings → enable Public Calendar → copy URL
                </Text>
                <Text style={s.stepText}>
                  <Text style={s.bold}>Outlook:</Text> Settings → Calendar → Shared calendars → Publish a calendar → copy ICS link
                </Text>
                <Text style={s.stepText}>
                  <Text style={s.bold}>Airbnb:</Text> Calendar → Availability → scroll to "Connect calendars" → copy the export link
                </Text>
                <Text style={s.stepText}>
                  <Text style={s.bold}>Calendly:</Text> Account → Calendar sync → copy iCal feed link
                </Text>
              </View>
              <Text style={s.syncNote}>Syncs every 15 minutes. Busy times will block bookings for this staff member.</Text>

              {calendars.map((cal) => (
                <View key={cal.id} style={s.calRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.calName}>{cal.name}</Text>
                    <Text style={s.calStatus}>
                      {cal.last_synced_at
                        ? `Synced ${new Date(cal.last_synced_at).toLocaleDateString()}`
                        : 'Not synced yet'}
                      {cal.last_error ? ' — Error' : ''}
                    </Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteCalendar(cal.id, cal.name)}>
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              ))}

              {showAddForm ? (
                <View style={s.addForm}>
                  <TextInput style={s.input} placeholder="Calendar name (e.g. Airbnb)" value={addName} onChangeText={setAddName} placeholderTextColor="#9ca3af" />
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
        ) : (
          <ScrollView style={s.scrollContent} contentContainerStyle={s.scrollInner}>
            {/* Google Calendar option */}
            <TouchableOpacity
              style={s.optionCard}
              onPress={googleConn ? handleDisconnectGoogle : handleConnectGoogle}
            >
              <View style={[s.iconBg, { backgroundColor: '#e8f5e9' }]}>
                <Ionicons name="logo-google" size={20} color="#4285F4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>Google Calendar</Text>
                <Text style={s.optionDesc}>
                  {googleConn
                    ? `Connected — ${googleConn.google_email}`
                    : 'Real-time two-way sync. Bookings push automatically.'}
                </Text>
              </View>
              {googleConn ? (
                <View style={s.connectedBadge}>
                  <Ionicons name="checkmark-circle" size={16} color="#16a34a" />
                </View>
              ) : (
                <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
              )}
            </TouchableOpacity>

            {/* iCal option */}
            <TouchableOpacity style={s.optionCard} onPress={() => setShowIcal(true)}>
              <View style={[s.iconBg, { backgroundColor: '#e8f0fe' }]}>
                <Ionicons name="calendar-outline" size={20} color="#6B7FC4" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.optionTitle}>iCal Calendars</Text>
                <Text style={s.optionDesc}>
                  Export to Outlook/Apple Calendar. Import from Airbnb, Calendly, etc.
                  {calendars.length > 0 ? ` (${calendars.length} connected)` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#d1d5db" />
            </TouchableOpacity>
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

  optionCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 16 },
  optionTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  optionDesc: { fontSize: 12, color: '#6b7280', marginTop: 2, lineHeight: 16 },
  connectedBadge: { padding: 4 },

  section: { backgroundColor: '#fff', borderRadius: 14, padding: 16, gap: 12 },
  sectionHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  iconBg: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },

  instructions: { fontSize: 13, color: '#6b7280', lineHeight: 18 },
  stepList: { gap: 8, backgroundColor: '#f9fafb', borderRadius: 10, padding: 12 },
  stepText: { fontSize: 12, color: '#374151', lineHeight: 18 },
  bold: { fontWeight: '700' },
  syncNote: { fontSize: 11, color: '#9ca3af', fontStyle: 'italic' },

  urlRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  urlText: { flex: 1, fontSize: 11, fontFamily: 'monospace', color: '#6b7280', backgroundColor: '#f3f4f6', paddingHorizontal: 10, paddingVertical: 10, borderRadius: 8 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#6B7FC4', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 8 },
  copyBtnText: { color: '#fff', fontSize: 12, fontWeight: '600' },
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
