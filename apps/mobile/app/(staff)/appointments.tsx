import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, getAuthenticatedRole } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

interface StaffAppointment {
  id: string;
  customer_name: string;
  customer_phone: string | null;
  service_name: string;
  service_duration: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  notes: string | null;
  location_name: string | null;
}

type TabKey = 'upcoming' | 'past' | 'pending';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  confirmed: { bg: '#dbeafe', text: '#1e40af' },
  in_progress: { bg: '#ede9fe', text: '#6d28d9' },
  completed: { bg: '#d1fae5', text: '#065f46' },
  no_show: { bg: '#fee2e2', text: '#991b1b' },
  cancelled: { bg: '#f3f4f6', text: '#6b7280' },
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function StaffAppointments() {
  const [tab, setTab] = useState<TabKey>('upcoming');
  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [staffId, setStaffId] = useState<string | null>(null);

  // Get staff ID for realtime subscription
  useEffect(() => {
    (async () => {
      const { staffInfo } = await getAuthenticatedRole();
      if (staffInfo) setStaffId(staffInfo.id);
    })();
  }, []);

  const fetchAppointments = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    let period = 'upcoming';
    let statusFilter = '';
    if (tab === 'past') period = 'past';
    if (tab === 'pending') { period = 'upcoming'; statusFilter = '&status=pending'; }

    try {
      const res = await fetch(`${API_BASE}/api/staff/appointments?period=${period}${statusFilter}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json() as { data: StaffAppointment[] | null };
      setAppointments(json.data ?? []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  // Realtime subscription — auto-refresh when appointments change
  useEffect(() => {
    if (!staffId) return;
    const channel = supabase
      .channel('staff-appointments-list')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `staff_id=eq.${staffId}`,
        },
        () => { fetchAppointments(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [staffId, fetchAppointments]);

  // Polling fallback — realtime requires table publication in Supabase
  useEffect(() => {
    const interval = setInterval(() => { fetchAppointments(); }, 10_000);
    return () => clearInterval(interval);
  }, [fetchAppointments]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAppointments();
  }, [fetchAppointments]);

  const updateStatus = useCallback(async (appointmentId: string, newStatus: string) => {
    setActionLoading(appointmentId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`${API_BASE}/api/staff/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json() as { error?: { message: string } | null };
      if (json.error) {
        Alert.alert('Error', json.error.message);
      } else {
        fetchAppointments();
      }
    } catch {
      Alert.alert('Error', 'Failed to update appointment');
    } finally {
      setActionLoading(null);
    }
  }, [fetchAppointments]);

  const renderAppointment = ({ item }: { item: StaffAppointment }) => {
    const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.cancelled;
    const isExpanded = expandedId === item.id;
    const isActioning = actionLoading === item.id;

    return (
      <TouchableOpacity
        style={styles.apptCard}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.apptRow}>
          <View style={styles.timeCol}>
            <Text style={styles.apptDate}>{formatDate(item.start_time)}</Text>
            <Text style={styles.apptTime}>{formatTime(item.start_time)}</Text>
          </View>
          <View style={styles.apptInfo}>
            <Text style={styles.apptCustomer}>{item.customer_name}</Text>
            <Text style={styles.apptService}>{item.service_name} — {item.service_duration} min</Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedSection}>
            {item.customer_phone && <Text style={styles.detailText}>Phone: {item.customer_phone}</Text>}
            {item.location_name && <Text style={styles.detailText}>Location: {item.location_name}</Text>}
            {item.notes && <Text style={styles.detailText}>Notes: {item.notes}</Text>}
            <Text style={styles.detailText}>Price: ${(item.total_price ?? 0).toFixed(2)}</Text>

            {item.customer_phone && (
              <View style={styles.contactRow}>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}
                >
                  <Ionicons name="call-outline" size={16} color="#6B7FC4" />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.contactBtn}
                  onPress={() => Linking.openURL(`sms:${item.customer_phone}`)}
                >
                  <Ionicons name="chatbubble-outline" size={16} color="#6B7FC4" />
                  <Text style={styles.contactBtnText}>Message</Text>
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.actionRow}>
              {isActioning ? (
                <ActivityIndicator size="small" color="#6B7FC4" />
              ) : (
                <>
                  {item.status === 'pending' && (
                    <>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#6B7FC4' }]} onPress={() => updateStatus(item.id, 'confirmed')}>
                        <Text style={styles.actionTextLight}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={() => updateStatus(item.id, 'cancelled')}>
                        <Text style={styles.actionTextDanger}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {item.status === 'confirmed' && (
                    <>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#059669' }]} onPress={() => updateStatus(item.id, 'completed')}>
                        <Text style={styles.actionTextLight}>Complete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={() => updateStatus(item.id, 'no_show')}>
                        <Text style={styles.actionTextDanger}>No Show</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(['upcoming', 'past', 'pending'] as TabKey[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'pending' ? 'Pending Approval' : t.charAt(0).toUpperCase() + t.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6B7FC4" />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={renderAppointment}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6B7FC4" />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No appointments</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabBar: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  tab: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center', backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: '#6B7FC4' },
  tabText: { fontSize: 13, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#fff' },
  listContent: { padding: 16, paddingBottom: 32 },
  apptCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  apptRow: { flexDirection: 'row', alignItems: 'center' },
  timeCol: { width: 65 },
  apptDate: { fontSize: 12, color: '#9ca3af' },
  apptTime: { fontSize: 13, fontWeight: '600', color: '#6B7FC4' },
  apptInfo: { flex: 1, marginLeft: 8 },
  apptCustomer: { fontSize: 15, fontWeight: '600', color: '#111827' },
  apptService: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  detailText: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  actionTextLight: { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionTextDanger: { color: '#991b1b', fontSize: 14, fontWeight: '600' },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#6B7FC4' },
  contactBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7FC4' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },
});
