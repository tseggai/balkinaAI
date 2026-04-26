import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, ActivityIndicator } from 'react-native';
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

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatCard icon="calendar" label="Today" value={String(stats?.todayAppointments ?? 0)} color="#3b82f6" />
        <StatCard icon="time" label="Pending" value={String(stats?.pendingAppointments ?? 0)} color="#f59e0b" />
        <StatCard icon="people" label="Customers" value={String(stats?.totalCustomers ?? 0)} color="#8b5cf6" />
        <StatCard icon="cash" label="Revenue" value={`$${(stats?.totalRevenue ?? 0).toFixed(0)}`} color="#10b981" />
      </View>

      {/* Quick actions */}
      <Text style={styles.sectionTitle}>Quick Actions</Text>
      <View style={styles.actionsRow}>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.navigate('/(tenant)/appointments')}>
          <Ionicons name="calendar-outline" size={22} color="#6B7FC4" />
          <Text style={styles.actionBtnText}>View Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.actionBtn} onPress={() => router.navigate('/(tenant)/services')}>
          <Ionicons name="add-circle-outline" size={22} color="#6B7FC4" />
          <Text style={styles.actionBtnText}>Add Service</Text>
        </TouchableOpacity>
      </View>

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

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: string; color: string }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon as keyof typeof Ionicons.glyphMap} size={20} color={color} />
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f9fafb' },
  greeting: { fontSize: 22, fontWeight: '700', color: '#111827', marginBottom: 20 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 },
  statCard: { width: '47%', backgroundColor: '#fff', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#f3f4f6' },
  statValue: { fontSize: 24, fontWeight: '700', color: '#111827', marginTop: 8 },
  statLabel: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12, marginTop: 8 },
  actionsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#fff', borderRadius: 12, paddingVertical: 14, borderWidth: 1, borderColor: '#e5e7eb' },
  actionBtnText: { fontSize: 14, fontWeight: '600', color: '#6B7FC4' },
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
