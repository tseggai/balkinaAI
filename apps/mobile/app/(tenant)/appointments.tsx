import { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator, Alert, Linking, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

interface Appointment {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  total_price: number;
  notes: string | null;
  staff_id: string | null;
  location_id: string | null;
  customers: { display_name: string | null; phone: string | null; no_show_count?: number } | null;
  services: { name: string; duration_minutes: number } | null;
  staff: { id: string; name: string } | null;
  tenant_locations: { name: string } | null;
}

interface StaffOption {
  id: string;
  name: string;
}

type Tab = 'today' | 'all';
const STATUS_FILTERS = ['all', 'pending', 'confirmed', 'approved', 'completed', 'cancelled', 'no_show'] as const;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fef3c7', text: '#92400e' },
  confirmed: { bg: '#dbeafe', text: '#1e40af' },
  approved: { bg: '#dbeafe', text: '#1e40af' },
  completed: { bg: '#d1fae5', text: '#065f46' },
  cancelled: { bg: '#fee2e2', text: '#991b1b' },
  no_show: { bg: '#f3f4f6', text: '#374151' },
};

export default function TenantAppointments() {
  const [tab, setTab] = useState<Tab>('today');
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [staffFilter, setStaffFilter] = useState<string>('all');
  const [serviceFilter, setServiceFilter] = useState<string>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [activeFilterModal, setActiveFilterModal] = useState<string | null>(null);
  const [staffList, setStaffList] = useState<StaffOption[]>([]);
  const [filterStaffOptions, setFilterStaffOptions] = useState<StaffOption[]>([]);
  const [filterServiceOptions, setFilterServiceOptions] = useState<{ id: string; name: string }[]>([]);
  const [filterLocationOptions, setFilterLocationOptions] = useState<{ id: string; name: string }[]>([]);
  const [assignModalVisible, setAssignModalVisible] = useState(false);
  const [assigningApptId, setAssigningApptId] = useState<string | null>(null);

  const fetchAppointments = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const res = await fetch(`${API_BASE}/api/tenant/appointments?tab=${tab}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok || json.error) {
        console.error('[tenant-appts]', json.error);
        setAppointments([]);
        return;
      }
      setAppointments(json.data ?? []);
      if (json.filters) {
        setFilterStaffOptions(json.filters.staff ?? []);
        setFilterServiceOptions(json.filters.services ?? []);
        setFilterLocationOptions(json.filters.locations ?? []);
      }

      // Also fetch staff list for assignment
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        let tid = tenantId;
        if (!tid) {
          const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
          if (tenant) { tid = (tenant as { id: string }).id; setTenantId(tid); }
        }
        if (tid) {
          const { data: staffData } = await supabase.from('staff').select('id, name').eq('tenant_id', tid).eq('status', 'active').order('name');
          setStaffList((staffData ?? []) as StaffOption[]);
        }
      }
    } catch (err) {
      console.error('[tenant-appts] error:', err);
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
      const res = await fetch(`${API_BASE}/api/tenant/appointments`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointmentId, status: newStatus }),
      });
      const json = await res.json();
      if (!res.ok) { Alert.alert('Error', json.error ?? 'Failed to update'); }
      else { fetchAppointments(); }
    } catch { Alert.alert('Error', 'Connection error'); }
    finally { setActionLoading(null); }
  }, [fetchAppointments]);

  const assignStaff = useCallback(async (appointmentId: string, staffId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${API_BASE}/api/tenant/appointments`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: appointmentId, staff_id: staffId }),
      });
      if (res.ok) {
        setAssignModalVisible(false);
        setAssigningApptId(null);
        fetchAppointments();
      } else {
        const json = await res.json();
        Alert.alert('Error', json.error ?? 'Failed to assign');
      }
    } catch { Alert.alert('Error', 'Connection error'); }
  }, [fetchAppointments]);

  const openAssignModal = (apptId: string) => {
    setAssigningApptId(apptId);
    setAssignModalVisible(true);
  };

  const renderItem = ({ item }: { item: Appointment }) => {
    const isExpanded = expandedId === item.id;
    const colors = STATUS_COLORS[item.status] ?? STATUS_COLORS.pending;
    const isPending = item.status === 'pending';
    const isActive = ['pending', 'confirmed', 'approved'].includes(item.status);
    const custName = item.customers?.display_name ?? 'Guest';
    const custPhone = item.customers?.phone ?? null;
    const noShowCount = (item.customers as { no_show_count?: number } | null)?.no_show_count ?? 0;
    const svcName = item.services?.name ?? 'Service';
    const svcDuration = item.services?.duration_minutes ?? 0;
    const staffName = item.staff?.name ?? null;
    const locName = item.tenant_locations?.name ?? null;

    return (
      <TouchableOpacity style={styles.card} onPress={() => setExpandedId(isExpanded ? null : item.id)} activeOpacity={0.7}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Text style={styles.customerName}>{custName}</Text>
              {noShowCount >= 2 && (
                <View style={{ backgroundColor: '#fee2e2', borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 }}>
                  <Text style={{ fontSize: 9, fontWeight: '700', color: '#991b1b' }}>{noShowCount} no-shows</Text>
                </View>
              )}
            </View>
            <Text style={styles.serviceName}>{svcName} — {svcDuration} min</Text>
            {staffName && <Text style={styles.staffText}>with {staffName}</Text>}
            {locName && <Text style={styles.locationText}>at {locName}</Text>}
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
            <Text style={styles.detailText}>Price: ${(item.total_price ?? 0).toFixed(2)}</Text>
            {item.notes && <Text style={styles.detailText}>Notes: {item.notes}</Text>}

            {/* Staff assignment */}
            <TouchableOpacity style={styles.assignBtn} onPress={() => openAssignModal(item.id)}>
              <Ionicons name="person-add-outline" size={16} color="#6B7FC4" />
              <Text style={styles.assignBtnText}>{staffName ? 'Reassign Staff' : 'Assign Staff'}</Text>
            </TouchableOpacity>

            {custPhone && (
              <View style={styles.contactRow}>
                <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`tel:${custPhone}`)}>
                  <Ionicons name="call-outline" size={16} color="#6B7FC4" />
                  <Text style={styles.contactBtnText}>Call</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => Linking.openURL(`sms:${custPhone}`)}>
                  <Ionicons name="chatbubble-outline" size={16} color="#6B7FC4" />
                  <Text style={styles.contactBtnText}>Message</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactBtn} onPress={() => {
                  const cleaned = custPhone.replace(/[^0-9+]/g, '');
                  Linking.openURL(`https://wa.me/${cleaned.startsWith('+') ? cleaned.slice(1) : cleaned}`);
                }}>
                  <Ionicons name="logo-whatsapp" size={16} color="#25D366" />
                  <Text style={styles.contactBtnText}>WhatsApp</Text>
                </TouchableOpacity>
              </View>
            )}

            {isPending && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#d1fae5' }]} onPress={() => updateStatus(item.id, 'confirmed')} disabled={actionLoading === item.id}>
                  <Ionicons name="checkmark-circle" size={18} color="#065f46" />
                  <Text style={[styles.actionBtnText, { color: '#065f46' }]}>Approve</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={() => updateStatus(item.id, 'cancelled')} disabled={actionLoading === item.id}>
                  <Ionicons name="close-circle" size={18} color="#991b1b" />
                  <Text style={[styles.actionBtnText, { color: '#991b1b' }]}>Decline</Text>
                </TouchableOpacity>
              </View>
            )}

            {isActive && !isPending && (
              <View style={styles.actionRow}>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#d1fae5' }]} onPress={() => updateStatus(item.id, 'completed')} disabled={actionLoading === item.id}>
                  <Ionicons name="checkmark-done" size={18} color="#065f46" />
                  <Text style={[styles.actionBtnText, { color: '#065f46' }]}>Complete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#f3f4f6' }]} onPress={() => updateStatus(item.id, 'no_show')} disabled={actionLoading === item.id}>
                  <Ionicons name="person-remove" size={18} color="#374151" />
                  <Text style={[styles.actionBtnText, { color: '#374151' }]}>No Show</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.actionBtn, { backgroundColor: '#fee2e2' }]} onPress={() => updateStatus(item.id, 'cancelled')} disabled={actionLoading === item.id}>
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
      <View style={styles.tabSection}>
        <View style={styles.tabRow}>
          {(['today', 'all'] as Tab[]).map((t) => (
            <TouchableOpacity key={t} style={[styles.tab, tab === t && styles.tabActive]} onPress={() => { setTab(t); setStatusFilter('all'); setStaffFilter('all'); setServiceFilter('all'); }}>
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'today' ? 'Today' : 'All'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
          <TouchableOpacity style={[styles.filterBtn, statusFilter !== 'all' && styles.filterBtnActive]} onPress={() => setActiveFilterModal('status')}>
            <Text style={[styles.filterBtnText, statusFilter !== 'all' && styles.filterBtnTextActive]}>{statusFilter === 'all' ? 'Status' : statusFilter.replace('_', ' ')}</Text>
            <Ionicons name="chevron-down" size={14} color={statusFilter !== 'all' ? '#6B7FC4' : '#9ca3af'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, locationFilter !== 'all' && styles.filterBtnActive]} onPress={() => setActiveFilterModal('location')}>
            <Text style={[styles.filterBtnText, locationFilter !== 'all' && styles.filterBtnTextActive]}>{locationFilter === 'all' ? 'Location' : filterLocationOptions.find(l => l.id === locationFilter)?.name ?? 'Location'}</Text>
            <Ionicons name="chevron-down" size={14} color={locationFilter !== 'all' ? '#6B7FC4' : '#9ca3af'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, staffFilter !== 'all' && styles.filterBtnActive]} onPress={() => setActiveFilterModal('staff')}>
            <Text style={[styles.filterBtnText, staffFilter !== 'all' && styles.filterBtnTextActive]}>{staffFilter === 'all' ? 'Staff' : filterStaffOptions.find(s => s.id === staffFilter)?.name ?? 'Staff'}</Text>
            <Ionicons name="chevron-down" size={14} color={staffFilter !== 'all' ? '#6B7FC4' : '#9ca3af'} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.filterBtn, serviceFilter !== 'all' && styles.filterBtnActive]} onPress={() => setActiveFilterModal('service')}>
            <Text style={[styles.filterBtnText, serviceFilter !== 'all' && styles.filterBtnTextActive]}>{serviceFilter === 'all' ? 'Service' : filterServiceOptions.find(s => s.id === serviceFilter)?.name ?? 'Service'}</Text>
            <Ionicons name="chevron-down" size={14} color={serviceFilter !== 'all' ? '#6B7FC4' : '#9ca3af'} />
          </TouchableOpacity>
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centered}><ActivityIndicator size="large" color="#6B7FC4" /></View>
      ) : (
        <FlatList
          data={appointments.filter(a => {
            if (statusFilter !== 'all' && a.status !== statusFilter) return false;
            if (staffFilter !== 'all' && a.staff?.id !== staffFilter) return false;
            if (serviceFilter !== 'all' && (a as Record<string, unknown>).service_id !== serviceFilter) return false;
            if (locationFilter !== 'all' && (a as Record<string, unknown>).location_id !== locationFilter) return false;
            return true;
          })}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchAppointments(); }} tintColor="#6B7FC4" />}
          ListEmptyComponent={<View style={styles.emptyCard}><Text style={styles.emptyText}>No {tab} appointments</Text></View>}
        />
      )}

      {/* Filter dropdown modal */}
      <Modal visible={activeFilterModal !== null} transparent animationType="slide" onRequestClose={() => setActiveFilterModal(null)}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setActiveFilterModal(null)}>
          <View style={styles.filterModalContent}>
            <Text style={styles.filterModalTitle}>
              {activeFilterModal === 'status' ? 'Filter by Status' : activeFilterModal === 'location' ? 'Filter by Location' : activeFilterModal === 'staff' ? 'Filter by Staff' : 'Filter by Service'}
            </Text>
            <ScrollView style={{ maxHeight: 300 }}>
              <TouchableOpacity style={styles.filterOption} onPress={() => {
                if (activeFilterModal === 'status') setStatusFilter('all');
                else if (activeFilterModal === 'location') setLocationFilter('all');
                else if (activeFilterModal === 'staff') setStaffFilter('all');
                else setServiceFilter('all');
                setActiveFilterModal(null);
              }}>
                <Text style={styles.filterOptionText}>All</Text>
                {((activeFilterModal === 'status' && statusFilter === 'all') || (activeFilterModal === 'location' && locationFilter === 'all') || (activeFilterModal === 'staff' && staffFilter === 'all') || (activeFilterModal === 'service' && serviceFilter === 'all')) && (
                  <Ionicons name="checkmark" size={20} color="#6B7FC4" />
                )}
              </TouchableOpacity>
              {activeFilterModal === 'status' && STATUS_FILTERS.filter(s => s !== 'all').map(s => (
                <TouchableOpacity key={s} style={styles.filterOption} onPress={() => { setStatusFilter(s); setActiveFilterModal(null); }}>
                  <Text style={[styles.filterOptionText, { textTransform: 'capitalize' }]}>{s.replace('_', ' ')}</Text>
                  {statusFilter === s && <Ionicons name="checkmark" size={20} color="#6B7FC4" />}
                </TouchableOpacity>
              ))}
              {activeFilterModal === 'location' && filterLocationOptions.map(l => (
                <TouchableOpacity key={l.id} style={styles.filterOption} onPress={() => { setLocationFilter(l.id); setActiveFilterModal(null); }}>
                  <Text style={styles.filterOptionText}>{l.name}</Text>
                  {locationFilter === l.id && <Ionicons name="checkmark" size={20} color="#6B7FC4" />}
                </TouchableOpacity>
              ))}
              {activeFilterModal === 'staff' && filterStaffOptions.map(s => (
                <TouchableOpacity key={s.id} style={styles.filterOption} onPress={() => { setStaffFilter(s.id); setActiveFilterModal(null); }}>
                  <Text style={styles.filterOptionText}>{s.name}</Text>
                  {staffFilter === s.id && <Ionicons name="checkmark" size={20} color="#6B7FC4" />}
                </TouchableOpacity>
              ))}
              {activeFilterModal === 'service' && filterServiceOptions.map(s => (
                <TouchableOpacity key={s.id} style={styles.filterOption} onPress={() => { setServiceFilter(s.id); setActiveFilterModal(null); }}>
                  <Text style={styles.filterOptionText}>{s.name}</Text>
                  {serviceFilter === s.id && <Ionicons name="checkmark" size={20} color="#6B7FC4" />}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Staff assignment modal */}
      <Modal visible={assignModalVisible} transparent animationType="slide" onRequestClose={() => setAssignModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Assign Staff</Text>
              <TouchableOpacity onPress={() => setAssignModalVisible(false)}>
                <Ionicons name="close" size={24} color="#6b7280" />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 300 }}>
              {staffList.map((s) => (
                <TouchableOpacity key={s.id} style={styles.staffOption} onPress={() => assigningApptId && assignStaff(assigningApptId, s.id)}>
                  <View style={styles.staffAvatar}><Text style={styles.staffAvatarText}>{s.name.charAt(0)}</Text></View>
                  <Text style={styles.staffOptionName}>{s.name}</Text>
                </TouchableOpacity>
              ))}
              {staffList.length === 0 && <Text style={styles.emptyText}>No active staff members</Text>}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  tabSection: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 8, gap: 8 },
  filterRow: { paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  filterBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#f3f4f6', borderWidth: 1, borderColor: '#e5e7eb' },
  filterBtnActive: { backgroundColor: '#eef2ff', borderColor: '#6B7FC4' },
  filterBtnText: { fontSize: 13, fontWeight: '500', color: '#6b7280' },
  filterBtnTextActive: { color: '#6B7FC4', fontWeight: '600' },
  filterModalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  filterModalTitle: { fontSize: 18, fontWeight: '700', color: '#111827', marginBottom: 12 },
  filterOption: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  filterOptionText: { fontSize: 16, color: '#111827' },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: '#f3f4f6' },
  tabActive: { backgroundColor: '#6B7FC4' },
  tabText: { fontSize: 14, fontWeight: '600', color: '#6b7280' },
  tabTextActive: { color: '#fff' },
  list: { padding: 16, paddingBottom: 40 },
  card: { backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, borderWidth: 1, borderColor: '#f3f4f6' },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  customerName: { fontSize: 16, fontWeight: '600', color: '#111827' },
  serviceName: { fontSize: 13, color: '#6b7280', marginTop: 2 },
  staffText: { fontSize: 12, color: '#6B7FC4', marginTop: 1 },
  locationText: { fontSize: 12, color: '#9ca3af', marginTop: 1 },
  dateText: { fontSize: 12, color: '#9ca3af', marginTop: 3 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '600', textTransform: 'capitalize' },
  expandedSection: { marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  detailText: { fontSize: 13, color: '#6b7280', marginBottom: 4 },
  assignBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8, backgroundColor: '#eef2ff', alignSelf: 'flex-start', marginTop: 8 },
  assignBtnText: { fontSize: 13, fontWeight: '600', color: '#6B7FC4' },
  contactRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  contactBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f3f4f6' },
  contactBtnText: { fontSize: 13, fontWeight: '500', color: '#374151' },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, borderRadius: 10 },
  actionBtnText: { fontSize: 13, fontWeight: '600' },
  emptyCard: { padding: 40, alignItems: 'center' },
  emptyText: { fontSize: 14, color: '#9ca3af' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  modalContent: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 40 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
  staffOption: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  staffAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center' },
  staffAvatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  staffOptionName: { fontSize: 16, fontWeight: '500', color: '#111827' },
});
