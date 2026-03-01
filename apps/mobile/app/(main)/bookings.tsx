import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  services: { name: string; duration_minutes: number } | null;
  tenants: { name: string } | null;
  staff: { name: string } | null;
}

type Tab = 'upcoming' | 'past';

export default function BookingsScreen() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const now = new Date().toISOString();
    let query = supabase
      .from('appointments')
      .select('id, start_time, end_time, status, total_price, services(name, duration_minutes), tenants(name), staff(name)')
      .eq('customer_id', user.id);

    if (tab === 'upcoming') {
      query = query
        .gte('start_time', now)
        .in('status', ['pending', 'confirmed'])
        .order('start_time', { ascending: true });
    } else {
      query = query
        .or(`start_time.lt.${now},status.eq.cancelled,status.eq.completed`)
        .order('start_time', { ascending: false });
    }

    const { data } = await query.limit(50);
    setAppointments((data as unknown as Appointment[]) ?? []);
    setLoading(false);
    setRefreshing(false);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAppointments();
  }, [fetchAppointments]);

  const handleCancel = useCallback(
    async (appointmentId: string) => {
      Alert.alert(
        'Cancel Appointment',
        'Are you sure you want to cancel this appointment?',
        [
          { text: 'Keep it', style: 'cancel' },
          {
            text: 'Cancel it',
            style: 'destructive',
            onPress: async () => {
              setCancellingId(appointmentId);
              const { error } = await supabase
                .from('appointments')
                .update({ status: 'cancelled' } as never)
                .eq('id', appointmentId)
                .in('status', ['pending', 'confirmed']);

              if (error) {
                Alert.alert('Error', error.message);
              } else {
                setAppointments((prev) =>
                  prev.filter((a) => a.id !== appointmentId)
                );
              }
              setCancellingId(null);
            },
          },
        ]
      );
    },
    []
  );

  function getStatusColor(status: string) {
    switch (status) {
      case 'confirmed':
        return { bg: '#dbeafe', text: '#1d4ed8' };
      case 'pending':
        return { bg: '#fef3c7', text: '#92400e' };
      case 'completed':
        return { bg: '#d1fae5', text: '#065f46' };
      case 'cancelled':
        return { bg: '#fee2e2', text: '#991b1b' };
      default:
        return { bg: '#f3f4f6', text: '#374151' };
    }
  }

  function formatDateTime(dateStr: string) {
    const d = new Date(dateStr);
    return {
      date: d.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      time: d.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      }),
    };
  }

  const renderItem = ({ item }: { item: Appointment }) => {
    const { date, time } = formatDateTime(item.start_time);
    const statusColor = getStatusColor(item.status);
    const isUpcoming = tab === 'upcoming';
    const isCancelling = cancellingId === item.id;

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.serviceName}>
              {item.services?.name ?? 'Service'}
            </Text>
            <Text style={styles.businessName}>
              {item.tenants?.name ?? 'Business'}
            </Text>
          </View>
          <View
            style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}
          >
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <View style={styles.cardDetails}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color="#6b7280" />
            <Text style={styles.detailText}>{date}</Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color="#6b7280" />
            <Text style={styles.detailText}>{time}</Text>
          </View>
          {item.staff?.name && (
            <View style={styles.detailRow}>
              <Ionicons name="person-outline" size={14} color="#6b7280" />
              <Text style={styles.detailText}>{item.staff.name}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <Ionicons name="cash-outline" size={14} color="#6b7280" />
            <Text style={styles.detailText}>
              ${(item.total_price / 100).toFixed(2)}
            </Text>
          </View>
        </View>

        {isUpcoming && (
          <TouchableOpacity
            style={[styles.cancelBtn, isCancelling && styles.cancelBtnDisabled]}
            onPress={() => handleCancel(item.id)}
            disabled={isCancelling}
          >
            {isCancelling ? (
              <ActivityIndicator size="small" color="#dc2626" />
            ) : (
              <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'upcoming' && styles.tabTextActive,
            ]}
          >
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'past' && styles.tabActive]}
          onPress={() => setTab('past')}
        >
          <Text
            style={[
              styles.tabText,
              tab === 'past' && styles.tabTextActive,
            ]}
          >
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={appointments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6366f1"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color="#d1d5db"
              />
              <Text style={styles.emptyTitle}>No {tab} appointments</Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'upcoming'
                  ? 'Book your first appointment from the Home screen!'
                  : 'Your past appointments will appear here.'}
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingTop: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: '#6366f1',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#9ca3af',
  },
  tabTextActive: {
    color: '#6366f1',
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  cardHeaderLeft: {
    flex: 1,
    marginRight: 8,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  businessName: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  cardDetails: {
    gap: 6,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  detailText: {
    fontSize: 13,
    color: '#6b7280',
  },
  cancelBtn: {
    marginTop: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#fecaca',
    backgroundColor: '#fef2f2',
    alignItems: 'center',
  },
  cancelBtnDisabled: {
    opacity: 0.6,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#dc2626',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
