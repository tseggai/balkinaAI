import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  customer_name: string;
  customer_phone: string | null;
  customer_no_show_count: number;
  service_name: string;
  service_duration: number;
  staff_name: string | null;
  location_name: string | null;
  notes: string | null;
}

type Tab = 'upcoming' | 'past' | 'pending';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  confirmed: { bg: '#dbeafe', text: '#1e40af' },
  approved: { bg: '#dbeafe', text: '#1e40af' },
  completed: { bg: '#d1fae5', text: '#065f46' },
  cancelled: { bg: '#fee2e2', text: '#991b1b' },
  no_show: { bg: '#f3f4f6', text: '#374151' },
};

export default function TenantAppointments() {
  const [tab, setTab] = useState<Tab>('upcoming');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      if (!tenantId) {
        const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
        if (tenant) setTenantId((tenant as { id: string }).id);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_BASE}/api/appointments?period=${tab}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) { setAppointments([]); return; }
      const json = await res.json();
      setAppointments(json.data ?? []);
    } catch {
      setAppointments([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [tab, tenantId]);

  useEffect(() => { setLoading(true); fetchAppointments(); }, [fetchAppointments]);

  const updateStatus = useCallback(async (appointmentId: string, newStatus: string) => {
    setActionLoading(appointmentId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      // Find the staff_id for this appointment
      const appt = appointments.find(a => a.id === appointmentId);

      const res = await fetch(`${API_BASE}/api/appointments`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointmentId, status: newStatus }),
      });
      if (res.ok) {
        fetchAppointments();
      } else {
        const json = await res.json().catch(() => ({}));
        Alert.alert('Error', (json as { error?: string }).error ?? 'Failed to update');
      }
    } catch {
      Alert.alert('Error', 'Connection error');
    } finally {
      setActionLoading(null);
    }
  }, [appointments, fetchAppointments]);

  const renderItem = ({ item }: { item: Appointment }) => {
    const isExpanded = expandedId === item.id;
    const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
    const isPending = item.status === 'pending';
    const isActive = ['pending', 'confirmed', 'approved'].includes(item.status);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => setExpandedId(isExpanded ? null : item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.customerName}>{item.customer_name}</Text>
              {item.customer_no_show_count >= 2 && (
                <View style={{ backgroundColor: '#fee2e2', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#991b1b' }}>{item.customer_no_show_count} no-shows</Text>
                </View>
              )}
            </View>
            <Text style={styles.serviceName}>{item.service_name} — {item.service_duration} min</Text>
            <Text style={styles.dateText}>
              {new Date(item.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
              {new Date(item.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </Text>
          </View>
          <View style={[styles.statusBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusText, { color: colors.text }]}>{item.status.replace('_', ' ')}</Text>
          </View>
        </View>

        {isExpanded && (
          <View style={styles.expandedSection}>
            {item.staff_name && <Text style={styles.detailText}>Staff: {item.staff_name}</Text>}
            {item.location_name && <Text style={styles.detailText}>Location: {item.location_name}</Text>}
            {item.customer_phone && <Text style={styles.detailText}>Phone: {item.customer_phone}</Text>}
            <Text style={styles.detailText}>Price: ${(item.total_price ?? 0).toFixed(2)}</Text>
            {item.notes && <Text style={styles.detailText}>Notes: {item.notes}</Text>}

            {item.customer_phone && (
              <View style={styles.contactRow}>
                <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${item.customer_phone}`)}>
                  <Ionicons name="call-outline" size={16} color="#6B7FC4" />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`sms:${item.customer_phone}`)}>
                  <Ionicons name="chatbubble-outline" size={16} color="#6B7FC4" />
                  <Text style={styles.contactBtnText}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => {
                  const cleaned = item.customer_phone!.replace(/[^0-9+]/g, '');
                  const waNumber = cleaned.startsWith('+') ? cleaned.slice(1) : cleaned;
                  Linking.openURL(`https://wa.me/${waNumber}`);
                }}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={styles.contactBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}

            {isPending && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#d1fae5' }]}
                  onPress={() => updateStatus(item.id, 'confirmed')}
                  disabled={actionLoading === item.id}
                >
                  <Ionicons name="checkmark-circle" size={18} color="#065f46" />
                  <Text style={[styles.actionBtnText, { color: '#065f46' }]}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]}
                  onPress={() => updateStatus(item.id, 'cancelled')}
                  disabled={actionLoading === item.id}
                >
                  <Ionicons name="close-circle" size={18} color="#991b1b" />
                  <Text style={[styles.actionBtnText, { color: '#991b1b' }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}

            {isActive && !isPending && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#d1fae5' }]}
                  onPress={() => updateStatus(item.id, 'completed')}
                  disabled={actionLoading === item.id}
                >
                  <Ionicons name="checkmark-done" size={18} color="#065f46" />
                  <Text style={[styles.actionBtnText, { color: '#065f46' }]}>Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#f3f4f6' }]}
                  onPress={() => updateStatus(item.id, 'no_show')}
                  disabled={actionLoading === item.id}
                >
                  <Ionicons name="person-remove" size={18} color="#374151" />
                  <Text style={[styles.actionBtnText, { color: '#374151' }]}>No Show</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]}
                  onPress={() => updateStatus(item.id, 'cancelled')}
                  disabled={actionLoading === item.id}
                >
                  <Ionicons name="close-circle" size={18} color="#991b1b" />
                  <Text style={[styles.actionBtnText, { color: '#991b1b' }]}>Cancel</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.tabRow}>
        {(['upcoming', 'past', 'pending'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'upcoming' ? 'Upcoming' : t === 'past' ? 'Past' : 'Pending'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAppointments(); }} tintColor="#6B7FC4" />}
          ListEmptyComponent={
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No {tab} appointments</Text>
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
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: '#6B7FC4' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  customerName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  serviceName: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  dateText: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  detailText: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f3f4f6' },
  contactBtnText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9ca3af' },
});
