import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  TextInput,
  Alert,
  Linking,
  Platform,
} from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

// ── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  notes: string | null;
  services: { name: string } | null;
  staff: { name: string } | null;
  tenant_locations: { name: string; address?: string; latitude?: number; longitude?: number } | null;
  tenants: { name: string } | null;
}

type Tab = 'upcoming' | 'past';
type SortOrder = 'date_asc' | 'date_desc' | 'price_asc' | 'price_desc';

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

// ── Booking Card Row ─────────────────────────────────────────────────────────

function BookingCardRow({
  item,
  onCancel,
  onGetDirections,
}: {
  item: Appointment;
  onCancel: (id: string) => void;
  onGetDirections: (item: Appointment) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const isCancellable = item.status === 'confirmed' || item.status === 'pending';
  const hasLocation = !!(item.tenant_locations?.address || item.tenant_locations?.latitude);

  const { date, time } = formatDateTime(item.start_time);
  const statusColor = getStatusStyle(item.status);

  // Extract package name from notes if present
  const packageMatch = item.notes?.match(/^Package:\s*(.+)$/);
  const displayName = packageMatch ? packageMatch[1] : (item.services?.name ?? 'Service');

  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        style={styles.card}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.businessName}>
            {item.tenants?.name ?? 'Business'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {item.status}
            </Text>
          </View>
        </View>

        <Text style={styles.serviceName}>{displayName}</Text>

        {item.staff?.name ? (
          <Text style={styles.staffName}>with {item.staff.name}</Text>
        ) : null}

        {item.tenant_locations?.name ? (
          <Text style={styles.locationName}>
            at {item.tenant_locations.name}
          </Text>
        ) : null}

        <View style={styles.cardFooter}>
          <View style={styles.dateTimeRow}>
            <Ionicons name="calendar-outline" size={14} color="#6b7280" />
            <Text style={styles.dateTimeText}>
              {date} at {time}
            </Text>
          </View>
          <Text style={styles.price}>
            ${(item.total_price ?? 0).toFixed(2)}
          </Text>
        </View>
      </TouchableOpacity>

      {/* Action buttons revealed on tap */}
      {expanded ? (
        <View style={styles.actionsRow}>
          {hasLocation ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDirections]}
              onPress={() => { setExpanded(false); onGetDirections(item); }}
              activeOpacity={0.7}
            >
              <Ionicons name="navigate-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Directions</Text>
            </TouchableOpacity>
          ) : null}
          {isCancellable ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnCancel]}
              onPress={() => { setExpanded(false); onCancel(item.id); }}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

// ── Main Screen ──────────────────────────────────────────────────────────────

export default function BookingsScreen() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date_asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    setErrorMsg(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setLoading(false);
      setRefreshing(false);
      setErrorMsg('Please sign in to view your bookings.');
      return;
    }
    setUserId(user.id);

    try {
      const params = new URLSearchParams({ tab });
      if (user.id) params.set('userId', user.id);
      if (user.email) params.set('email', user.email);
      if (user.phone) params.set('phone', user.phone);

      const res = await fetch(
        `${API_BASE}/api/customer/bookings?${params.toString()}`,
      );

      if (!res.ok) {
        setErrorMsg('Failed to load bookings. Please try again.');
        setAppointments([]);
      } else {
        const result = (await res.json()) as {
          data: Appointment[];
          error: string | null;
        };
        if (result.error) {
          setErrorMsg(result.error);
          setAppointments([]);
        } else {
          setAppointments(result.data ?? []);
        }
      }
    } catch {
      setErrorMsg('Connection error. Please check your network.');
      setAppointments([]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [tab]);

  useEffect(() => {
    setLoading(true);
    fetchAppointments();
  }, [fetchAppointments]);

  useFocusEffect(
    useCallback(() => {
      fetchAppointments();
    }, [fetchAppointments]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchAppointments();
  }, [fetchAppointments]);

  // Filter and sort
  const filteredAppointments = appointments
    .filter((a) => {
      if (statusFilter !== 'all' && a.status !== statusFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        const serviceName = a.services?.name?.toLowerCase() ?? '';
        const businessName = a.tenants?.name?.toLowerCase() ?? '';
        const staffName = a.staff?.name?.toLowerCase() ?? '';
        const packageName = a.notes?.match(/^Package:\s*(.+)$/)?.[1]?.toLowerCase() ?? '';
        return serviceName.includes(q) || businessName.includes(q) || staffName.includes(q) || packageName.includes(q);
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortOrder) {
        case 'date_asc':
          return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
        case 'date_desc':
          return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
        case 'price_asc':
          return (a.total_price ?? 0) - (b.total_price ?? 0);
        case 'price_desc':
          return (b.total_price ?? 0) - (a.total_price ?? 0);
        default:
          return 0;
      }
    });

  const handleCancel = useCallback(async (appointmentId: string) => {
    Alert.alert(
      'Cancel Appointment',
      'Are you sure you want to cancel this appointment?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              const res = await fetch(`${API_BASE}/api/customer/bookings/cancel`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointmentId, userId }),
              });
              if (res.ok) {
                setAppointments((prev) =>
                  prev.map((a) => a.id === appointmentId ? { ...a, status: 'cancelled' } : a),
                );
              } else {
                const err = (await res.json().catch(() => ({}))) as { error?: string };
                Alert.alert('Error', err.error ?? 'Failed to cancel appointment');
              }
            } catch {
              Alert.alert('Error', 'Connection error. Please try again.');
            }
          },
        },
      ],
    );
  }, [userId]);

  const handleGetDirections = useCallback((item: Appointment) => {
    const loc = item.tenant_locations;
    if (!loc) return;
    if (loc.latitude && loc.longitude) {
      const url = Platform.OS === 'ios'
        ? `maps://maps.apple.com/?daddr=${loc.latitude},${loc.longitude}`
        : `https://www.google.com/maps/dir/?api=1&destination=${loc.latitude},${loc.longitude}`;
      Linking.openURL(url);
    } else if (loc.address) {
      const encoded = encodeURIComponent(loc.address);
      const url = Platform.OS === 'ios'
        ? `maps://maps.apple.com/?daddr=${encoded}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
      Linking.openURL(url);
    }
  }, []);

  const renderItem = ({ item }: { item: Appointment }) => (
    <BookingCardRow
      item={item}
      onCancel={handleCancel}
      onGetDirections={handleGetDirections}
    />
  );

  const STATUS_FILTERS = ['all', 'confirmed', 'pending', 'completed', 'cancelled'];

  return (
    <View style={styles.container}>
      {/* Tab bar */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, tab === 'upcoming' && styles.tabActive]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, tab === 'past' && styles.tabActive]}
          onPress={() => setTab('past')}
        >
          <Text style={[styles.tabText, tab === 'past' && styles.tabTextActive]}>
            Past
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search bar */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={16} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search bookings..."
            placeholderTextColor="#9ca3af"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
        <TouchableOpacity
          style={[styles.filterBtn, showFilters && styles.filterBtnActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons name="options-outline" size={18} color={showFilters ? '#fff' : '#6B7FC4'} />
        </TouchableOpacity>
      </View>

      {/* Filter/sort controls */}
      {showFilters ? (
        <View style={styles.filtersContainer}>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Status</Text>
            <View style={styles.filterChips}>
              {STATUS_FILTERS.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[styles.filterChip, statusFilter === s && styles.filterChipActive]}
                  onPress={() => setStatusFilter(s)}
                >
                  <Text style={[styles.filterChipText, statusFilter === s && styles.filterChipTextActive]}>
                    {s === 'all' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
          <View style={styles.filterGroup}>
            <Text style={styles.filterLabel}>Sort by</Text>
            <View style={styles.filterChips}>
              {[
                { key: 'date_asc' as SortOrder, label: 'Date (earliest)' },
                { key: 'date_desc' as SortOrder, label: 'Date (latest)' },
                { key: 'price_asc' as SortOrder, label: 'Price (low)' },
                { key: 'price_desc' as SortOrder, label: 'Price (high)' },
              ].map((s) => (
                <TouchableOpacity
                  key={s.key}
                  style={[styles.filterChip, sortOrder === s.key && styles.filterChipActive]}
                  onPress={() => setSortOrder(s.key)}
                >
                  <Text style={[styles.filterChipText, sortOrder === s.key && styles.filterChipTextActive]}>
                    {s.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      ) : null}

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6B7FC4" />
        </View>
      ) : errorMsg ? (
        <View style={styles.empty}>
          <Ionicons name="alert-circle-outline" size={56} color="#ef4444" />
          <Text style={styles.emptyTitle}>Error</Text>
          <Text style={styles.emptySubtitle}>{errorMsg}</Text>
          <TouchableOpacity
            style={styles.startChatBtn}
            onPress={() => {
              setErrorMsg(null);
              setLoading(true);
              fetchAppointments();
            }}
          >
            <Ionicons name="refresh" size={18} color="#fff" />
            <Text style={styles.startChatBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filteredAppointments}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6B7FC4"
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={56} color="#d1d5db" />
              <Text style={styles.emptyTitle}>
                {search || statusFilter !== 'all' ? 'No matching bookings' : 'No bookings yet'}
              </Text>
              <Text style={styles.emptySubtitle}>
                {search || statusFilter !== 'all'
                  ? 'Try adjusting your search or filters.'
                  : tab === 'upcoming'
                    ? 'Your upcoming appointments will appear here.'
                    : 'Your past appointments will appear here.'}
              </Text>
              {tab === 'upcoming' && !search && statusFilter === 'all' && (
                <TouchableOpacity
                  style={styles.startChatBtn}
                  onPress={() => router.navigate('/(app)')}
                >
                  <Ionicons name="chatbubbles-outline" size={18} color="#fff" />
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
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
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
  tabActive: { borderBottomColor: '#6B7FC4' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#9ca3af' },
  tabTextActive: { color: '#6B7FC4' },

  // Search
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    gap: 8,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 40,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  filterBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#eef2ff',
    justifyContent: 'center',
    alignItems: 'center',
  },
  filterBtnActive: { backgroundColor: '#6B7FC4' },

  // Filters
  filtersContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  filterGroup: { marginBottom: 8 },
  filterLabel: { fontSize: 12, fontWeight: '600', color: '#6b7280', marginBottom: 6 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
  },
  filterChipActive: { backgroundColor: '#6B7FC4' },
  filterChipText: { fontSize: 12, fontWeight: '500', color: '#6b7280' },
  filterChipTextActive: { color: '#fff' },

  list: { padding: 16, paddingBottom: 24 },

  // Booking card
  cardWrapper: { marginBottom: 12 },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnDirections: { backgroundColor: '#6B7FC4' },
  actionBtnCancel: { backgroundColor: '#ef4444' },
  actionBtnText: { fontSize: 13, fontWeight: '600', color: '#fff' },

  card: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
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
  businessName: { fontSize: 16, fontWeight: '700', color: '#111827', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  serviceName: { fontSize: 14, color: '#374151', marginBottom: 2 },
  staffName: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  locationName: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateTimeText: { fontSize: 13, color: '#6b7280' },
  price: { fontSize: 15, fontWeight: '700', color: '#111827' },
  empty: { alignItems: 'center', paddingTop: 80, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#374151', marginTop: 8 },
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
    backgroundColor: '#6B7FC4',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 24,
    marginTop: 16,
    gap: 8,
  },
  startChatBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
});
