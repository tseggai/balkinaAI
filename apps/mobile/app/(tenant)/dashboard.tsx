import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface DashboardData {
  tenantName: string;
  ownerName: string;
  stats: {
    totalAppointments: number;
    todayAppointments: number;
    pendingAppointments: number;
    totalRevenue: number;
    totalCustomers: number;
    totalStaff: number;
    totalServices: number;
  };
  recent: {
    id: string;
    start_time: string;
    status: string;
    customer_name: string;
    service_name: string;
  }[];
}

export default function TenantDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_BASE}/api/tenant/dashboard`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (res.ok) setData(json);
    } catch (err) {
      console.error('[tenant-dashboard] error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  if (loading) return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;

  const stats = data?.stats;
  const recent = data?.recent ?? [];
  const statusColor: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#3b82f6', approved: '#3b82f6',
    completed: '#10b981', cancelled: '#ef4444', no_show: '#6b7280',
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchDashboard(); }} tintColor="#6B7FC4" />}
    >
      <Text style={styles.greeting}>Welcome, {data?.ownerName ?? data?.tenantName ?? ''}</Text>

      {/* Compact stats */}
      <View style={styles.statsRow}>
        <View style={styles.statChip}>
          <Text style={styles.statChipValue}>{stats?.todayAppointments ?? 0}</Text>
          <Text style={styles.statChipLabel}>Today</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statChipValue, { color: '#f59e0b' }]}>{stats?.pendingAppointments ?? 0}</Text>
          <Text style={styles.statChipLabel}>Pending</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={styles.statChipValue}>{stats?.totalCustomers ?? 0}</Text>
          <Text style={styles.statChipLabel}>Customers</Text>
        </View>
        <View style={styles.statChip}>
          <Text style={[styles.statChipValue, { color: '#10b981' }]}>${(stats?.totalRevenue ?? 0).toFixed(0)}</Text>
          <Text style={styles.statChipLabel}>Revenue</Text>
        </View>
      </View>

      {/* Manage section */}
      <Text style={styles.sectionTitle}>Manage</Text>
      <View style={styles.manageGrid}>
        <TouchableOpacity style={styles.manageCard} onPress={() => router.navigate('/(tenant)/appointments')}>
          <Ionicons name="calendar-outline" size={24} color="#3b82f6" />
          <Text style={styles.manageLabel}>Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.manageCard} onPress={() => router.navigate('/(tenant)/services')}>
          <Ionicons name="briefcase-outline" size={24} color="#8b5cf6" />
          <Text style={styles.manageLabel}>Services</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.manageCard} onPress={() => router.navigate('/(tenant)/staff')}>
          <Ionicons name="people-outline" size={24} color="#10b981" />
          <Text style={styles.manageLabel}>Staff</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.manageCard} onPress={() => router.navigate('/(tenant)/locations')}>
          <Ionicons name="location-outline" size={24} color="#f59e0b" />
          <Text style={styles.manageLabel}>Locations</Text>
        </TouchableOpacity>
      </View>

      {/* Full dashboard link */}
      <TouchableOpacity style={styles.dashboardLink} onPress={() => Linking.openURL('https://app.balkina.ai/dashboard')}>
        <Ionicons name="desktop-outline" size={18} color="#6B7FC4" />
        <Text style={styles.dashboardLinkText}>Open Full Dashboard on Web</Text>
        <Ionicons name="open-outline" size={14} color="#9ca3af" />
      </TouchableOpacity>

      {/* Recent appointments */}
      <Text style={styles.sectionTitle}>Recent Bookings</Text>
      {recent.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No bookings yet</Text>
        </View>
      ) : (
        recent.map((appt) => (
          <TouchableOpacity key={appt.id} style={styles.apptCard} onPress={() => router.navigate('/(tenant)/appointments')} activeOpacity={0.7}>
            <View style={styles.apptRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.apptCustomer}>{appt.customer_name}</Text>
                <Text style={styles.apptService}>{appt.service_name}</Text>
                <Text style={styles.apptDate}>
                  {new Date(appt.start_time).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at{' '}
                  {new Date(appt.start_time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </Text>
              </View>
              <View style={[styles.statusDot, { backgroundColor: statusColor[appt.status] ?? '#6b7280' }]} />
            </View>
          </TouchableOpacity>
        ))
      )}

    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { paddingHorizontal: 16, paddingTop: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 16 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 24 },
  statChip: { flex: 1, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  statChipValue: { fontSize: 20, fontWeight: '700', color: '#111827' },
  statChipLabel: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12, marginTop: 8 },
  manageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 10 },
  manageCard: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, alignItems: 'center', gap: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  manageLabel: { fontSize: 14, fontWeight: '600', color: '#111827' },
  dashboardLink: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 24 },
  dashboardLinkText: { fontSize: 14, fontWeight: '500', color: '#6B7FC4' },
  apptCard: { backgroundColor: '#fff', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#f3f4f6' },
  apptRow: { flexDirection: 'row', alignItems: 'center' },
  apptCustomer: { fontSize: 15, fontWeight: '600', color: '#111827' },
  apptService: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  apptDate: { fontSize: 12, color: '#9ca3af', marginTop: 2 },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 12, padding: 32, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  emptyText: { fontSize: 14, color: '#9ca3af' },
});
