import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, getAuthenticatedRole } from '@/lib/supabase';
import type { StaffInfo } from '@/lib/supabase';

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

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTodayDate(): string {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export default function StaffDashboard() {
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const { staffInfo: info } = await getAuthenticatedRole();
    setStaffInfo(info ?? null);

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const res = await fetch(`${API_BASE}/api/staff/appointments?period=today`, {
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
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

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
        fetchData();
      }
    } catch {
      Alert.alert('Error', 'Failed to update appointment');
    } finally {
      setActionLoading(null);
    }
  }, [fetchData]);

  // Stats
  const totalToday = appointments.length;
  const completedToday = appointments.filter((a) => a.status === 'completed').length;
  const nextAppt = appointments.find((a) => a.status === 'confirmed' && new Date(a.start_time) > new Date());
  const minutesToNext = nextAppt
    ? Math.max(0, Math.round((new Date(nextAppt.start_time).getTime() - Date.now()) / 60000))
    : null;

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
          <Text style={styles.apptTime}>{formatTime(item.start_time)}</Text>
          <View style={styles.apptInfo}>
            <Text style={styles.apptCustomer}>{item.customer_name}</Text>
            <Text style={styles.apptService}>
              {item.service_name} — {item.service_duration} min
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedSection}>
            {item.customer_phone && (
              <Text style={styles.detailText}>Phone: {item.customer_phone}</Text>
            )}
            {item.location_name && (
              <Text style={styles.detailText}>Location: {item.location_name}</Text>
            )}
            {item.notes && (
              <Text style={styles.detailText}>Notes: {item.notes}</Text>
            )}
            <Text style={styles.detailText}>Price: ${(item.total_price ?? 0).toFixed(2)}</Text>

            {/* Action buttons */}
            <View style={styles.actionRow}>
              {isActioning ? (
                <ActivityIndicator size="small" color="#6B7FC4" />
              ) : (
                <>
                  {item.status === 'pending' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionAccept]}
                        onPress={() => updateStatus(item.id, 'confirmed')}
                      >
                        <Text style={styles.actionBtnTextLight}>Accept</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionDecline]}
                        onPress={() => updateStatus(item.id, 'cancelled')}
                      >
                        <Text style={styles.actionBtnTextDanger}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {item.status === 'confirmed' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionStart]}
                        onPress={() => updateStatus(item.id, 'in_progress')}
                      >
                        <Text style={styles.actionBtnTextLight}>Start</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionNoShow]}
                        onPress={() => updateStatus(item.id, 'no_show')}
                      >
                        <Text style={styles.actionBtnTextDanger}>No Show</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {item.status === 'in_progress' && (
                    <TouchableOpacity
                      style={[styles.actionBtn, styles.actionComplete]}
                      onPress={() => updateStatus(item.id, 'completed')}
                    >
                      <Text style={styles.actionBtnTextLight}>Complete</Text>
                    </TouchableOpacity>
                  )}
                </>
              )}
            </View>
          </View>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6B7FC4" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.greeting}>
          {getGreeting()}, {staffInfo?.name?.split(' ')[0] ?? 'there'}
        </Text>
        <Text style={styles.dateText}>{formatTodayDate()}</Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{totalToday}</Text>
          <Text style={styles.statLabel}>Today</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {minutesToNext !== null ? `${minutesToNext}m` : '--'}
          </Text>
          <Text style={styles.statLabel}>Next in</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{completedToday}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
      </View>

      {/* Appointment list */}
      <FlatList
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={renderAppointment}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6B7FC4" />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No appointments today</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  greeting: { fontSize: 24, fontWeight: '700', color: '#111827' },
  dateText: { fontSize: 15, color: '#6b7280', marginTop: 4 },
  statsRow: { flexDirection: 'row', paddingHorizontal: 16, gap: 10, marginTop: 16, marginBottom: 8 },
  statCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16,
    alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6',
  },
  statNumber: { fontSize: 22, fontWeight: '700', color: '#6B7FC4' },
  statLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  listContent: { padding: 16, paddingBottom: 32 },
  apptCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, marginBottom: 10,
    borderWidth: 1, borderColor: '#f3f4f6',
  },
  apptRow: { flexDirection: 'row', alignItems: 'center' },
  apptTime: { fontSize: 13, fontWeight: '600', color: '#6B7FC4', width: 72 },
  apptInfo: { flex: 1 },
  apptCustomer: { fontSize: 15, fontWeight: '600', color: '#111827' },
  apptService: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  detailText: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, minWidth: 80, alignItems: 'center' },
  actionAccept: { backgroundColor: '#6B7FC4' },
  actionDecline: { backgroundColor: '#fee2e2' },
  actionStart: { backgroundColor: '#7c3aed' },
  actionNoShow: { backgroundColor: '#fee2e2' },
  actionComplete: { backgroundColor: '#059669' },
  actionBtnTextLight: { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionBtnTextDanger: { color: '#991b1b', fontSize: 14, fontWeight: '600' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },
});
