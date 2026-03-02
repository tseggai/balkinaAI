import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

// ── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  services: { name: string } | null;
  staff: { name: string } | null;
  tenants: { name: string } | null;
}

type Tab = 'upcoming' | 'past';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStatusStyle(status: string): { bg: string; text: string } {
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

function formatDateTime(dateStr: string): { date: string; time: string } {
  const d = new Date(dateStr);
  return {
    date: d.toLocaleDateString('en-US', {
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

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');

  const fetchAppointments = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const now = new Date().toISOString();
    const isUpcoming = tab === 'upcoming';

    let query = supabase
      .from('appointments')
      .select(
        'id, start_time, end_time, status, total_price, services(name), staff(name), tenants(name)',
      )
      .eq('customer_id', user.id)
      .order('start_time', { ascending: isUpcoming });

    if (isUpcoming) {
      query = query
        .gte('start_time', now)
        .in('status', ['pending', 'confirmed']);
    } else {
      query = query.or(
        `start_time.lt.${now},status.eq.completed,status.eq.cancelled`,
      );
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

  const renderItem = ({ item }: { item: Appointment }) => {
    const { date, time } = formatDateTime(item.start_time);
    const statusColor = getStatusStyle(item.status);

    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.businessName}>
            {item.tenants?.name ?? 'Business'}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: statusColor.bg },
            ]}
          >
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.serviceName}>
          {item.services?.name ?? 'Service'}
        </Text>

        {item.staff?.name ? (
          <Text style={styles.staffName}>with {item.staff.name}</Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.dateTimeRow}>
            <Ionicons name="calendar-outline" size={14} color="#6b7280" />
            <Text style={styles.dateTimeText}>
              {date} at {time}
            </Text>
          </View>

          <Text style={styles.price}>
            ${(item.total_price / 100).toFixed(2)}
          </Text>
        </View>
      </View>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────────

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
              <Ionicons name="calendar-outline" size={56} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No bookings yet</Text>
              <Text style={styles.emptySubtitle}>
                {tab === 'upcoming'
                  ? 'Your upcoming appointments will appear here.'
                  : 'Your past appointments will appear here.'}
              </Text>
              {tab === 'upcoming' && (
                <TouchableOpacity
                  style={styles.startChatBtn}
                  onPress={() => {
                    router.navigate('/(app)');
                  }}
                >
                  <Ionicons
                    name="chatbubbles-outline"
                    size={18}
                    color="#fff"
                  />
                  <Text style={styles.startChatBtnText}>Start chatting</Text>
                </TouchableOpacity>
              )}
            </View>
          }
        />
      )}
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

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
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  businessName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    marginRight: 8,
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
  serviceName: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  staffName: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 10,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  dateTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  dateTimeText: {
    fontSize: 13,
    color: '#6b7280',
  },
  price: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginTop: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  startChatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
    gap: 8,
  },
  startChatBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
