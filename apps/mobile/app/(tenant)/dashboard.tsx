import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator, Linking } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface Stats {
  totalAppointments: number;
  todayAppointments: number;
  pendingAppointments: number;
  totalRevenue: number;
  totalCustomers: number;
  totalStaff: number;
  totalServices: number;
}

interface RecentAppointment {
  id: string;
  start_time: string;
  status: string;
  customer_name: string;
  service_name: string;
}

export default function TenantDashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [recent, setRecent] = useState<RecentAppointment[]>([]);
  const [tenantName, setTenantName] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboard = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name')
        .eq('user_id', user.id)
        .single();
      if (!tenant) return;
      setTenantName((tenant as { name: string }).name);
      const tenantId = (tenant as { id: string }).id;

      const today = new Date();
      const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      const todayEnd = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1).toISOString();

      const [allAppts, todayAppts, pendingAppts, customers, staffCount, svcCount] = await Promise.all([
        supabase.from('appointments').select('id, total_price, status').eq('tenant_id', tenantId),
        supabase.from('appointments').select('id').eq('tenant_id', tenantId).gte('start_time', todayStart).lt('start_time', todayEnd).in('status', ['confirmed', 'approved', 'pending']),
        supabase.from('appointments').select('id').eq('tenant_id', tenantId).eq('status', 'pending'),
        supabase.from('appointments').select('customer_id').eq('tenant_id', tenantId),
        supabase.from('staff').select('id').eq('tenant_id', tenantId),
        supabase.from('services').select('id').eq('tenant_id', tenantId),
      ]);

      const allData = (allAppts.data ?? []) as { id: string; total_price: number; status: string }[];
      const completedRevenue = allData.filter(a => a.status === 'completed').reduce((sum, a) => sum + (a.total_price ?? 0), 0);
      const uniqueCustomers = new Set((customers.data ?? []).map((c: { customer_id: string }) => c.customer_id));

      setStats({
        totalAppointments: allData.length,
        todayAppointments: (todayAppts.data ?? []).length,
        pendingAppointments: (pendingAppts.data ?? []).length,
        totalRevenue: completedRevenue,
        totalCustomers: uniqueCustomers.size,
        totalStaff: (staffCount.data ?? []).length,
        totalServices: (svcCount.data ?? []).length,
      });

      // Recent appointments
      const { data: recentData } = await supabase
        .from('appointments')
        .select('id, start_time, status, customers(display_name), services(name)')
        .eq('tenant_id', tenantId)
        .order('start_time', { ascending: false })
        .limit(5);

      setRecent((recentData ?? []).map((a: Record<string, unknown>) => ({
        id: a.id as string,
        start_time: a.start_time as string,
        status: a.status as string,
        customer_name: ((a.customers as { display_name: string } | null)?.display_name) ?? 'Guest',
        service_name: ((a.services as { name: string } | null)?.name) ?? 'Service',
      })));
    } catch (err) {
      console.error('[tenant-dashboard] error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const onRefresh = () => { setRefreshing(true); fetchDashboard(); };

  if (loading) {
    return <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>;
  }

  const statusColor: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#3b82f6', approved: '#3b82f6',
    completed: '#10b981', cancelled: '#ef4444', no_show: '#6b7280',
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6B7FC4" />}
    >
      <Text style={styles.greeting}>Welcome, {tenantName}</Text>

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
          <View key={appt.id} style={styles.apptCard}>
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
          </View>
        ))
      )}

      {/* Business snapshot */}
      <Text style={styles.sectionTitle}>Business Snapshot</Text>
      <View style={styles.snapshotRow}>
        <View style={styles.snapshotItem}>
          <Text style={styles.snapshotValue}>{stats?.totalServices ?? 0}</Text>
          <Text style={styles.snapshotLabel}>Services</Text>
        </View>
        <View style={styles.snapshotItem}>
          <Text style={styles.snapshotValue}>{stats?.totalStaff ?? 0}</Text>
          <Text style={styles.snapshotLabel}>Staff</Text>
        </View>
        <View style={styles.snapshotItem}>
          <Text style={styles.snapshotValue}>{stats?.totalAppointments ?? 0}</Text>
          <Text style={styles.snapshotLabel}>Total Bookings</Text>
        </View>
      </View>
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
  snapshotRow: { flexDirection: 'row', gap: 10 },
  snapshotItem: { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 16, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' },
  snapshotValue: { fontSize: 22, fontWeight: '700', color: '#111827' },
  snapshotLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
});
