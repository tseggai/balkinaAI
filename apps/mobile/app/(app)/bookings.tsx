import { useEffect, useState, useCallback, useRef } from 'react';
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
  Modal,
  KeyboardAvoidingView,
  Keyboard,
  TouchableWithoutFeedback,
  ScrollView,
} from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useStripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import PaymentWebViewModal from '@/components/PaymentWebViewModal';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

// ── Types ────────────────────────────────────────────────────────────────────

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  notes: string | null;
  deposit_paid: boolean | null;
  deposit_amount_paid: number | null;
  stripe_payment_intent_id: string | null;
  services: { name: string } | null;
  staff: { name: string } | null;
  tenant_locations: { name: string; address?: string; latitude?: number; longitude?: number } | null;
  tenants: { name: string } | null;
}

type Tab = 'upcoming' | 'past';
type SortOrder = 'date_asc' | 'date_desc';

// ── Helpers ──────────────────────────────────────────────────────────────────

function getStatusLabel(status: string): string {
  switch (status) {
    case 'approved': return 'Approved';
    case 'confirmed': return 'Confirmed';
    case 'pending': return 'Pending';
    case 'completed': return 'Completed';
    case 'cancelled': return 'Cancelled';
    case 'no_show': return 'No Show';
    default: return status;
  }
}

function getStatusStyle(status: string): { bg: string; text: string } {
  switch (status) {
    case 'confirmed':
      return { bg: '#dbeafe', text: '#1d4ed8' };
    case 'approved':
      return { bg: '#e0e7ff', text: '#4338ca' };
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
  expanded,
  onToggle,
  onCancel,
  onGetDirections,
  onRate,
  onPayDeposit,
}: {
  item: Appointment;
  expanded: boolean;
  onToggle: () => void;
  onCancel: (id: string) => void;
  onGetDirections: (item: Appointment) => void;
  onRate: (id: string) => void;
  onPayDeposit: (id: string) => void;
}) {
  const isCancellable = item.status === 'confirmed' || item.status === 'approved' || item.status === 'pending';
  const isCompleted = item.status === 'completed';
  const hasLocation = !!(item.tenant_locations?.address || item.tenant_locations?.latitude);
  const hasUnpaidDeposit = item.deposit_amount_paid != null && item.deposit_amount_paid > 0 && item.deposit_paid !== true && (item.status === 'approved' || item.status === 'confirmed' || item.status === 'pending');

  const { date, time } = formatDateTime(item.start_time);
  const statusColor = getStatusStyle(item.status);

  // Extract package name from notes if present
  const packageMatch = item.notes?.match(/^Package:\s*(.+)$/);
  const displayName = packageMatch ? packageMatch[1] : (item.services?.name ?? 'Service');

  return (
    <View style={styles.cardWrapper}>
      <TouchableOpacity
        style={styles.card}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.businessName}>
            {item.tenants?.name ?? 'Business'}
          </Text>
          <View style={[styles.statusBadge, { backgroundColor: statusColor.bg }]}>
            <Text style={[styles.statusText, { color: statusColor.text }]}>
              {getStatusLabel(item.status)}
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

        {/* Deposit status row */}
        {item.deposit_amount_paid != null && item.deposit_amount_paid > 0 ? (
          <View style={styles.depositRow}>
            <Text style={[styles.depositText, { color: item.deposit_paid ? '#059669' : '#dc2626' }]}>
              Deposit: ${item.deposit_amount_paid.toFixed(2)} {item.deposit_paid ? '(Paid)' : '(Due)'}
            </Text>
          </View>
        ) : null}
      </TouchableOpacity>

      {/* Pay Deposit button — always visible when deposit is due, no expand needed */}
      {hasUnpaidDeposit && !expanded ? (
        <TouchableOpacity
          style={styles.payDepositBtn}
          onPress={() => onPayDeposit(item.id)}
          activeOpacity={0.7}
        >
          <Ionicons name="card-outline" size={18} color="#fff" />
          <Text style={styles.payDepositBtnText}>Pay Deposit (${item.deposit_amount_paid!.toFixed(2)})</Text>
        </TouchableOpacity>
      ) : null}

      {/* Action buttons revealed on tap */}
      {expanded ? (
        <View style={styles.actionsRow}>
          {hasUnpaidDeposit ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnPay]}
              onPress={() => onPayDeposit(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="card-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Pay Deposit</Text>
            </TouchableOpacity>
          ) : null}
          {hasLocation ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnDirections]}
              onPress={() => onGetDirections(item)}
              activeOpacity={0.7}
            >
              <Ionicons name="navigate-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Directions</Text>
            </TouchableOpacity>
          ) : null}
          {isCancellable ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnCancel]}
              onPress={() => onCancel(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="close-circle-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Cancel</Text>
            </TouchableOpacity>
          ) : null}
          {isCompleted ? (
            <TouchableOpacity
              style={[styles.actionBtn, styles.actionBtnRate]}
              onPress={() => onRate(item.id)}
              activeOpacity={0.7}
            >
              <Ionicons name="star-outline" size={18} color="#fff" />
              <Text style={styles.actionBtnText}>Rate</Text>
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
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>('upcoming');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('date_asc');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [userId, setUserId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);

  // Rating modal state
  const [ratingModalVisible, setRatingModalVisible] = useState(false);
  const [ratingAppointmentId, setRatingAppointmentId] = useState<string | null>(null);
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [ratingLoading, setRatingLoading] = useState(false);

  // Accept-suggestion modal state
  const [suggestionModalVisible, setSuggestionModalVisible] = useState(false);
  const [suggestionAppointmentId, setSuggestionAppointmentId] = useState<string | null>(null);
  const [suggestedTimeOptions, setSuggestedTimeOptions] = useState<{ date: string; time: string; iso: string }[]>([]);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(0);
  const [suggestionLoading, setSuggestionLoading] = useState(false);

  // Handle notification deep-link params
  const params = useLocalSearchParams<{
    action?: string;
    appointmentId?: string;
    suggestedTime?: string;
    suggestedDate?: string;
    suggestedTimeIso?: string;
    suggestedTimes?: string;
  }>();

  // Track whether a notification-triggered payment has been handled
  const payDepositHandled = useRef(false);

  useEffect(() => {
    if (!params.action) return;
    if (params.action === 'rate' && params.appointmentId) {
      setRatingAppointmentId(params.appointmentId);
      setRatingValue(0);
      setRatingComment('');
      setRatingModalVisible(true);
    } else if (params.action === 'accept_suggestion' && params.appointmentId) {
      setSuggestionAppointmentId(params.appointmentId);
      // Parse suggested times — support both new array format and legacy single fields
      let options: { date: string; time: string; iso: string }[] = [];
      if (params.suggestedTimes) {
        try { options = JSON.parse(params.suggestedTimes) as { date: string; time: string; iso: string }[]; } catch { /* ignore */ }
      }
      if (options.length === 0 && params.suggestedTimeIso) {
        options = [{ date: params.suggestedDate ?? '', time: params.suggestedTime ?? '', iso: params.suggestedTimeIso }];
      }
      setSuggestedTimeOptions(options);
      setSelectedSuggestionIdx(0);
      setSuggestionModalVisible(true);
    } else if (params.action === 'pay_deposit' && params.appointmentId && !payDepositHandled.current) {
      // Auto-trigger payment for notification deep-link (Scenario 2)
      payDepositHandled.current = true;
      handlePayDeposit(params.appointmentId);
    }
  }, [params.action, params.appointmentId, params.suggestedTime, params.suggestedDate, params.suggestedTimeIso]);

  const fetchAppointments = useCallback(async () => {
    setErrorMsg(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      console.warn('[bookings] No authenticated user — cannot fetch bookings');
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

      console.log('[bookings] fetching:', `${API_BASE}/api/customer/bookings?${params.toString()}`);
      const res = await fetch(
        `${API_BASE}/api/customer/bookings?${params.toString()}`,
      );
      console.log('[bookings] response status:', res.status);

      if (!res.ok) {
        const errText = await res.text().catch(() => '');
        console.error('[bookings] error response:', errText);
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
    } catch (err) {
      console.error('[bookings] fetch error:', err);
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

  // Realtime subscription for appointment status/deposit changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('customer-bookings-realtime')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
          filter: `customer_id=eq.${userId}`,
        },
        () => { fetchAppointments(); },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'appointments',
          filter: `customer_id=eq.${userId}`,
        },
        () => { fetchAppointments(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId, fetchAppointments]);

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
      if (sortOrder === 'date_desc') {
        return new Date(b.start_time).getTime() - new Date(a.start_time).getTime();
      }
      return new Date(a.start_time).getTime() - new Date(b.start_time).getTime();
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

  // Submit a review
  const handleSubmitRating = useCallback(async () => {
    if (!ratingAppointmentId || !userId || ratingValue === 0) return;
    setRatingLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customer/reviews`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: ratingAppointmentId,
          userId,
          rating: ratingValue,
          comment: ratingComment.trim() || undefined,
        }),
      });
      if (res.ok) {
        Alert.alert('Thank You!', 'Your review has been submitted.');
        setRatingModalVisible(false);
        setRatingAppointmentId(null);
        setRatingValue(0);
        setRatingComment('');
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        Alert.alert('Error', err.error ?? 'Failed to submit review');
      }
    } catch {
      Alert.alert('Error', 'Connection error. Please try again.');
    } finally {
      setRatingLoading(false);
    }
  }, [ratingAppointmentId, userId, ratingValue, ratingComment]);

  // Accept a suggested reschedule time
  const handleAcceptSuggestion = useCallback(async () => {
    const selected = suggestedTimeOptions[selectedSuggestionIdx];
    if (!suggestionAppointmentId || !userId || !selected?.iso) return;
    setSuggestionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/customer/bookings/accept-suggestion`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          appointmentId: suggestionAppointmentId,
          userId,
          suggestedTimeIso: selected.iso,
        }),
      });
      if (res.ok) {
        const result = (await res.json().catch(() => ({}))) as { status?: string };
        const msg = result.status === 'approved'
          ? 'Your appointment has been rescheduled. Please pay the deposit to confirm.'
          : 'Your appointment has been confirmed!';
        Alert.alert('Rescheduled!', msg);
        setSuggestionModalVisible(false);
        setSuggestionAppointmentId(null);
        fetchAppointments();
      } else {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        Alert.alert('Error', err.error ?? 'Failed to accept suggestion');
      }
    } catch {
      Alert.alert('Error', 'Connection error. Please try again.');
    } finally {
      setSuggestionLoading(false);
    }
  }, [suggestionAppointmentId, userId, suggestedTimeOptions, selectedSuggestionIdx, fetchAppointments]);

  // Open the rating modal from a booking card
  const openRatingModal = useCallback((appointmentId: string) => {
    setRatingAppointmentId(appointmentId);
    setRatingValue(0);
    setRatingComment('');
    setRatingModalVisible(true);
  }, []);

  // In-app payment WebView modal state
  const [paymentModal, setPaymentModal] = useState<{ appointmentId: string; depositAmount?: number } | null>(null);

  const handlePayDeposit = useCallback(async (appointmentId: string) => {
    setPaymentLoading(true);
    try {
      // 1. Fetch or create PaymentIntent
      const res = await fetch(`${API_BASE}/api/payments/create-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        Alert.alert('Payment Error', err.error ?? 'Failed to prepare payment');
        return;
      }

      const { clientSecret, amount } = (await res.json()) as { clientSecret: string; amount?: number };
      if (!clientSecret) {
        Alert.alert('Payment Error', 'No payment secret returned');
        return;
      }

      // 2. Init PaymentSheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Balkina AI',
        allowsDelayedPaymentMethods: false,
        applePay: { merchantCountryCode: 'US' },
        googlePay: { merchantCountryCode: 'US', testEnv: true },
      });

      if (initError) {
        // Native Stripe unavailable (e.g. Expo Go) — open in-app WebView payment modal
        if (initError.code === 'Unavailable') {
          setPaymentModal({
            appointmentId,
            depositAmount: amount ? amount / 100 : undefined,
          });
          return;
        }
        Alert.alert('Payment Error', initError.message);
        return;
      }

      // 3. Present PaymentSheet
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        if (presentError.code !== 'Canceled') {
          Alert.alert('Payment Failed', presentError.message);
        }
        return;
      }

      // 4. Payment succeeded — verify and update DB (don't rely on webhook timing)
      try {
        await fetch(`${API_BASE}/api/payments/verify-deposit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId }),
        });
      } catch {
        // Verification failed — webhook will handle it eventually
      }

      Alert.alert('Deposit Paid!', 'Your deposit has been processed successfully.');
      fetchAppointments();
    } catch {
      Alert.alert('Error', 'Connection error. Please try again.');
    } finally {
      setPaymentLoading(false);
    }
  }, [initPaymentSheet, presentPaymentSheet, fetchAppointments]);

  const renderItem = ({ item }: { item: Appointment }) => (
    <BookingCardRow
      item={item}
      expanded={expandedId === item.id}
      onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
      onCancel={handleCancel}
      onGetDirections={handleGetDirections}
      onRate={openRatingModal}
      onPayDeposit={handlePayDeposit}
    />
  );

  const STATUS_OPTIONS = ['all', 'confirmed', 'pending', 'completed', 'cancelled'];

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

      {/* Search + Sort + Status (inline row) */}
      <View style={styles.searchRow}>
        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={16} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            value={search}
            onChangeText={setSearch}
            placeholder="Search..."
            placeholderTextColor="#9ca3af"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
        {/* Date sort toggle */}
        <TouchableOpacity
          style={styles.sortToggle}
          onPress={() => setSortOrder(sortOrder === 'date_asc' ? 'date_desc' : 'date_asc')}
        >
          <Ionicons
            name={sortOrder === 'date_asc' ? 'arrow-up' : 'arrow-down'}
            size={14}
            color="#6B7FC4"
          />
          <Text style={styles.sortToggleText}>Date</Text>
        </TouchableOpacity>
        {/* Status dropdown */}
        <TouchableOpacity
          style={styles.statusDropdown}
          onPress={() => {
            const currentIdx = STATUS_OPTIONS.indexOf(statusFilter);
            const nextIdx = (currentIdx + 1) % STATUS_OPTIONS.length;
            setStatusFilter(STATUS_OPTIONS[nextIdx]);
          }}
        >
          <Text style={styles.statusDropdownText}>
            {statusFilter === 'all' ? 'All' : statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)}
          </Text>
          <Ionicons name="chevron-down" size={14} color="#6B7FC4" />
        </TouchableOpacity>
      </View>

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

      {/* Rating Modal */}
      <Modal
        visible={ratingModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setRatingModalVisible(false)}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.modalOverlay}>
            <KeyboardAvoidingView
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
              style={styles.keyboardAvoid}
            >
              <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Rate Your Experience</Text>
                  <TouchableOpacity onPress={() => setRatingModalVisible(false)}>
                    <Ionicons name="close" size={24} color="#6b7280" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.modalSubtitle}>How was your appointment?</Text>

                {/* Star rating */}
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <TouchableOpacity key={star} onPress={() => setRatingValue(star)}>
                      <Ionicons
                        name={star <= ratingValue ? 'star' : 'star-outline'}
                        size={40}
                        color={star <= ratingValue ? '#f59e0b' : '#d1d5db'}
                      />
                    </TouchableOpacity>
                  ))}
                </View>

                <Text style={styles.ratingLabel}>
                  {ratingValue === 0 ? 'Tap a star to rate' :
                   ratingValue === 1 ? 'Poor' :
                   ratingValue === 2 ? 'Fair' :
                   ratingValue === 3 ? 'Good' :
                   ratingValue === 4 ? 'Great' : 'Excellent!'}
                </Text>

                {/* Optional comment */}
                <ScrollView keyboardShouldPersistTaps="handled" style={styles.ratingScroll}>
                  <TextInput
                    style={styles.commentInput}
                    placeholder="Add a comment (optional)"
                    placeholderTextColor="#9ca3af"
                    value={ratingComment}
                    onChangeText={setRatingComment}
                    multiline
                    numberOfLines={3}
                    textAlignVertical="top"
                    returnKeyType="done"
                    blurOnSubmit
                    onSubmitEditing={Keyboard.dismiss}
                  />
                </ScrollView>

                <TouchableOpacity
                  style={[styles.submitBtn, ratingValue === 0 && styles.submitBtnDisabled]}
                  onPress={() => {
                    Keyboard.dismiss();
                    handleSubmitRating();
                  }}
                  disabled={ratingValue === 0 || ratingLoading}
                >
                  {ratingLoading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitBtnText}>Submit Review</Text>
                  )}
                </TouchableOpacity>
              </View>
            </KeyboardAvoidingView>
          </View>
        </TouchableWithoutFeedback>
      </Modal>

      {/* Accept Suggestion Modal */}
      <Modal
        visible={suggestionModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setSuggestionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reschedule Suggestion</Text>
              <TouchableOpacity onPress={() => setSuggestionModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalSubtitle}>
              Your stylist has suggested {(suggestedTimeOptions ?? []).length > 1 ? 'alternative times' : 'a new time'} for your appointment:
            </Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {(suggestedTimeOptions ?? []).map((opt, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.suggestionCard,
                    { flex: 1, marginBottom: 0 },
                    idx === selectedSuggestionIdx && { borderColor: '#6B7FC4', borderWidth: 2 },
                  ]}
                  onPress={() => setSelectedSuggestionIdx(idx)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="calendar-outline" size={22} color="#6B7FC4" />
                  <View style={styles.suggestionInfo}>
                    <Text style={styles.suggestionDate}>{opt.date}</Text>
                    <Text style={styles.suggestionTime}>{opt.time}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.suggestionActions}>
              <TouchableOpacity
                style={styles.acceptBtn}
                onPress={handleAcceptSuggestion}
                disabled={suggestionLoading || suggestedTimeOptions.length === 0}
              >
                {suggestionLoading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.acceptBtnText}>Accept & Book</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.declineSuggestionBtn}
                onPress={() => {
                  setSuggestionModalVisible(false);
                  router.navigate('/(app)/');
                }}
              >
                <Text style={styles.declineSuggestionText}>Find Another Time</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* In-app payment WebView modal (fallback when native Stripe unavailable) */}
      {paymentModal && (
        <PaymentWebViewModal
          visible={true}
          appointmentId={paymentModal.appointmentId}
          depositAmount={paymentModal.depositAmount}
          onSuccess={async () => {
            const apptId = paymentModal.appointmentId;
            setPaymentModal(null);
            // Verify deposit is marked paid in DB (webhook may not have fired yet)
            try {
              await fetch(`${API_BASE}/api/payments/verify-deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointmentId: apptId }),
              });
            } catch { /* best-effort */ }
            Alert.alert('Deposit Paid!', 'Your deposit has been successfully processed.');
            fetchAppointments();
          }}
          onClose={() => setPaymentModal(null)}
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

  // Search + controls row
  searchRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#fff',
    gap: 8,
    alignItems: 'center',
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f3f4f6',
    borderRadius: 10,
    paddingHorizontal: 10,
    height: 38,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: '#111827', padding: 0 },
  sortToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  sortToggleText: { fontSize: 12, fontWeight: '600', color: '#6B7FC4' },
  statusDropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 38,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#f3f4f6',
    gap: 4,
  },
  statusDropdownText: { fontSize: 12, fontWeight: '600', color: '#6B7FC4' },

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
    paddingVertical: 14,
    borderRadius: 10,
    gap: 6,
  },
  actionBtnDirections: { backgroundColor: '#6B7FC4' },
  actionBtnCancel: { backgroundColor: '#ef4444' },
  actionBtnRate: { backgroundColor: '#f59e0b' },
  actionBtnPay: { backgroundColor: '#6B7FC4' },
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
  businessName: { fontSize: 15, fontWeight: '600', color: '#111827', flex: 1, marginRight: 8 },
  statusBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 12 },
  statusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  serviceName: { fontSize: 14, color: '#374151', marginBottom: 2 },
  staffName: { fontSize: 13, color: '#6b7280', marginBottom: 2 },
  locationName: { fontSize: 13, color: '#6b7280', marginBottom: 10 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  dateTimeRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dateTimeText: { fontSize: 13, color: '#6b7280' },
  price: { fontSize: 15, fontWeight: '700', color: '#111827' },
  depositRow: { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  depositText: { fontSize: 13, fontWeight: '600' },
  payDepositBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6B7FC4',
    paddingVertical: 14,
    borderRadius: 10,
    marginTop: 8,
    gap: 6,
  },
  payDepositBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
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
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 16,
    gap: 8,
  },
  startChatBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },

  // Modal styles
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  keyboardAvoid: { justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 14, color: '#6b7280', marginBottom: 20 },

  // Rating modal
  ratingScroll: { maxHeight: 120 },
  starsRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginBottom: 8 },
  ratingLabel: { fontSize: 14, fontWeight: '600', color: '#374151', textAlign: 'center', marginBottom: 16 },
  commentInput: {
    borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12,
    fontSize: 14, color: '#111827', minHeight: 80, marginBottom: 16,
  },
  submitBtn: { backgroundColor: '#6B7FC4', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.4 },
  submitBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },

  // Suggestion modal
  suggestionCard: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: '#eff6ff', borderRadius: 12, padding: 16, marginBottom: 20,
    borderWidth: 1, borderColor: '#bfdbfe',
  },
  suggestionInfo: { flex: 1 },
  suggestionDate: { fontSize: 16, fontWeight: '700', color: '#111827' },
  suggestionTime: { fontSize: 14, color: '#6B7FC4', fontWeight: '600', marginTop: 2 },
  suggestionActions: { gap: 10 },
  acceptBtn: { backgroundColor: '#6B7FC4', paddingVertical: 14, borderRadius: 10, alignItems: 'center' },
  acceptBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  declineSuggestionBtn: { paddingVertical: 14, borderRadius: 10, alignItems: 'center', backgroundColor: '#f3f4f6' },
  declineSuggestionText: { fontSize: 15, fontWeight: '600', color: '#374151' },
});
