import { useEffect, useState, useCallback, useRef } from 'react';
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
  Linking,
  Modal,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase, getAuthenticatedRole } from '@/lib/supabase';
import type { StaffInfo } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface StaffAppointment {
  id: string;
  tenant_id: string;
  service_id: string;
  staff_id: string;
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

type DayOption = 'today' | 'tomorrow' | 'next_week';

interface TimeSlot {
  time: string;
  iso: string;
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

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function getDateForOption(option: DayOption): string {
  const d = new Date();
  if (option === 'tomorrow') d.setDate(d.getDate() + 1);
  if (option === 'next_week') d.setDate(d.getDate() + 7);
  return d.toISOString().split('T')[0];
}

function getDateLabel(option: DayOption): string {
  const d = new Date();
  if (option === 'tomorrow') d.setDate(d.getDate() + 1);
  if (option === 'next_week') d.setDate(d.getDate() + 7);
  const dayName = d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (option === 'today') return `Today (${dayName})`;
  if (option === 'tomorrow') return `Tomorrow (${dayName})`;
  return dayName;
}

export default function StaffDashboard() {
  const [staffInfo, setStaffInfo] = useState<StaffInfo | null>(null);
  const [appointments, setAppointments] = useState<StaffAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const listRef = useRef<FlatList<StaffAppointment>>(null);

  // Decline/reschedule modal state
  const [declineModalVisible, setDeclineModalVisible] = useState(false);
  const [declineAppointment, setDeclineAppointment] = useState<StaffAppointment | null>(null);
  const [selectedDay, setSelectedDay] = useState<DayOption | null>(null);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [declineLoading, setDeclineLoading] = useState(false);

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

  // Realtime subscription: auto-refresh when appointments change for this staff
  useEffect(() => {
    if (!staffInfo?.id) return;
    const channel = supabase
      .channel('staff-appointments')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `staff_id=eq.${staffInfo.id}`,
        },
        () => { fetchData(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [staffInfo?.id, fetchData]);

  // Polling fallback — realtime requires table publication in Supabase
  useEffect(() => {
    const interval = setInterval(() => { fetchData(); }, 10_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Auto-scroll to the first upcoming appointment when data loads
  useEffect(() => {
    if (appointments.length === 0) return;
    const now = new Date();
    const firstUpcomingIdx = appointments.findIndex(
      (a) => new Date(a.start_time) > now && (a.status === 'confirmed' || a.status === 'pending'),
    );
    if (firstUpcomingIdx > 0) {
      setTimeout(() => {
        listRef.current?.scrollToIndex({ index: firstUpcomingIdx, animated: true, viewOffset: 8 });
      }, 300);
    }
  }, [appointments]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const updateStatus = useCallback(async (appointmentId: string, newStatus: string, suggestedTime?: string) => {
    setActionLoading(appointmentId);
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    try {
      const reqBody: { status: string; suggestedTime?: string } = { status: newStatus };
      if (suggestedTime) reqBody.suggestedTime = suggestedTime;

      const res = await fetch(`${API_BASE}/api/staff/appointments/${appointmentId}/status`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(reqBody),
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

  // Open the decline modal
  const openDeclineModal = useCallback((appt: StaffAppointment) => {
    setDeclineAppointment(appt);
    setSelectedDay(null);
    setAvailableSlots([]);
    setDeclineModalVisible(true);
  }, []);

  // Fetch available slots for a given day
  const fetchSlots = useCallback(async (day: DayOption) => {
    if (!declineAppointment) return;
    setSelectedDay(day);
    setSlotsLoading(true);
    setAvailableSlots([]);

    try {
      const dateStr = getDateForOption(day);
      const res = await fetch(`${API_BASE}/api/booking/staff-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenantId: declineAppointment.tenant_id,
          serviceId: declineAppointment.service_id,
          date: dateStr,
          staffId: declineAppointment.staff_id,
        }),
      });
      const json = await res.json() as { staff?: { slots?: { time: string; iso?: string }[] }[] };
      const staffData = json.staff?.[0];
      const slots: TimeSlot[] = (staffData?.slots ?? []).map((s) => ({
        time: s.time,
        iso: s.iso ?? `${dateStr}T${s.time}:00.000Z`,
      }));
      setAvailableSlots(slots);
    } catch {
      setAvailableSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }, [declineAppointment]);

  // Decline with a suggested time
  const handleDeclineWithSuggestion = useCallback(async (slotIso: string) => {
    if (!declineAppointment) return;
    setDeclineLoading(true);
    await updateStatus(declineAppointment.id, 'cancelled', slotIso);
    setDeclineLoading(false);
    setDeclineModalVisible(false);
    setDeclineAppointment(null);
  }, [declineAppointment, updateStatus]);

  // Decline without suggestion
  const handleDeclineOnly = useCallback(async () => {
    if (!declineAppointment) return;
    setDeclineLoading(true);
    await updateStatus(declineAppointment.id, 'cancelled');
    setDeclineLoading(false);
    setDeclineModalVisible(false);
    setDeclineAppointment(null);
  }, [declineAppointment, updateStatus]);

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
    // Robust date parsing: Supabase may return "2026-03-17 09:35:00+00" (space, no T)
    const endMs = new Date(typeof item.end_time === 'string' ? item.end_time.replace(' ', 'T') : item.end_time).getTime();
    const isPast = !isNaN(endMs) && endMs < Date.now();

    return (
      <TouchableOpacity
        style={[styles.apptCard, isPast && styles.apptCardPast]}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.apptRow}>
          <Text style={[styles.apptTime, isPast && styles.apptTimePast]}>{formatTime(item.start_time)}</Text>
          <View style={styles.apptInfo}>
            <Text style={[styles.apptCustomer, isPast && styles.textPast]}>{item.customer_name}</Text>
            <Text style={[styles.apptService, isPast && styles.textPast]}>
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

            {/* Contact buttons */}
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
                        onPress={() => openDeclineModal(item)}
                      >
                        <Text style={styles.actionBtnTextDanger}>Decline</Text>
                      </TouchableOpacity>
                    </>
                  )}
                  {item.status === 'confirmed' && (
                    <>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionComplete]}
                        onPress={() => updateStatus(item.id, 'completed')}
                      >
                        <Text style={styles.actionBtnTextLight}>Complete</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.actionBtn, styles.actionNoShow]}
                        onPress={() => updateStatus(item.id, 'no_show')}
                      >
                        <Text style={styles.actionBtnTextDanger}>No Show</Text>
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
        ref={listRef}
        data={appointments}
        keyExtractor={(item) => item.id}
        renderItem={renderAppointment}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor="#6B7FC4" />
        }
        onScrollToIndexFailed={(info) => {
          setTimeout(() => {
            listRef.current?.scrollToIndex({ index: info.index, animated: true, viewOffset: 8 });
          }, 500);
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>No appointments today</Text>
          </View>
        }
      />

      {/* Decline / Reschedule Modal */}
      <Modal
        visible={declineModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setDeclineModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Decline Appointment</Text>
              <TouchableOpacity onPress={() => setDeclineModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {declineAppointment && (
              <Text style={styles.modalSubtitle}>
                {declineAppointment.customer_name} — {declineAppointment.service_name} on{' '}
                {formatDate(declineAppointment.start_time)} at {formatTime(declineAppointment.start_time)}
              </Text>
            )}

            <Text style={styles.modalSectionTitle}>Suggest an alternative time</Text>

            {/* Day picker */}
            <View style={styles.dayPickerRow}>
              {(['today', 'tomorrow', 'next_week'] as DayOption[]).map((day) => (
                <TouchableOpacity
                  key={day}
                  style={[styles.dayBtn, selectedDay === day && styles.dayBtnActive]}
                  onPress={() => fetchSlots(day)}
                >
                  <Text style={[styles.dayBtnText, selectedDay === day && styles.dayBtnTextActive]}>
                    {day === 'today' ? 'Today' : day === 'tomorrow' ? 'Tomorrow' : 'Next Week'}
                  </Text>
                  <Text style={[styles.dayBtnDate, selectedDay === day && styles.dayBtnTextActive]}>
                    {getDateLabel(day).replace(/.*\(/, '').replace(')', '')}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Time slots */}
            {selectedDay && (
              <View style={styles.slotsContainer}>
                {slotsLoading ? (
                  <ActivityIndicator size="small" color="#6B7FC4" style={{ marginVertical: 20 }} />
                ) : availableSlots.length === 0 ? (
                  <Text style={styles.noSlotsText}>No available slots for this day</Text>
                ) : (
                  <ScrollView style={styles.slotsScroll} showsVerticalScrollIndicator={false}>
                    <View style={styles.slotsGrid}>
                      {availableSlots.map((slot) => (
                        <TouchableOpacity
                          key={slot.iso}
                          style={styles.slotBtn}
                          onPress={() => handleDeclineWithSuggestion(slot.iso)}
                          disabled={declineLoading}
                        >
                          <Text style={styles.slotBtnText}>{slot.time}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                )}
              </View>
            )}

            {/* Divider */}
            <View style={styles.modalDivider} />

            {/* Decline without suggestion */}
            <TouchableOpacity
              style={styles.declineOnlyBtn}
              onPress={handleDeclineOnly}
              disabled={declineLoading}
            >
              {declineLoading ? (
                <ActivityIndicator size="small" color="#991b1b" />
              ) : (
                <Text style={styles.declineOnlyText}>Decline Without Suggestion</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 8 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#6B7FC4' },
  contactBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7FC4' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  actionAccept: { backgroundColor: '#6B7FC4' },
  actionDecline: { backgroundColor: '#fee2e2' },
  actionNoShow: { backgroundColor: '#fee2e2' },
  actionComplete: { backgroundColor: '#059669' },
  actionBtnTextLight: { color: '#fff', fontSize: 14, fontWeight: '600' },
  actionBtnTextDanger: { color: '#991b1b', fontSize: 14, fontWeight: '600' },
  apptCardPast: { opacity: 0.5, backgroundColor: '#f9fafb' },
  apptTimePast: { color: '#9ca3af' },
  textPast: { color: '#9ca3af' },
  emptyContainer: { alignItems: 'center', paddingTop: 60 },
  emptyText: { fontSize: 16, color: '#9ca3af', marginTop: 12 },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },
  modalSectionTitle: { fontSize: 15, fontWeight: '600', color: '#374151', marginBottom: 12 },
  dayPickerRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dayBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  dayBtnActive: { backgroundColor: '#6B7FC4', borderColor: '#6B7FC4' },
  dayBtnText: { fontSize: 13, fontWeight: '600', color: '#374151' },
  dayBtnDate: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  dayBtnTextActive: { color: '#fff' },
  slotsContainer: { marginBottom: 12 },
  slotsScroll: { maxHeight: 200 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  slotBtn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' },
  slotBtnText: { fontSize: 13, fontWeight: '600', color: '#1e40af' },
  noSlotsText: { fontSize: 14, color: '#9ca3af', textAlign: 'center', paddingVertical: 20 },
  modalDivider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 16 },
  declineOnlyBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#fee2e2' },
  declineOnlyText: { fontSize: 15, fontWeight: '600', color: '#991b1b' },
});
