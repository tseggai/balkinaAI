import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Category {
  id: string;
  name: string;
  slug: string;
  icon_url: string | null;
}

interface Tenant {
  id: string;
  name: string;
  status: string;
  category_id: string | null;
  categories: { name: string } | null;
}

interface Appointment {
  id: string;
  start_time: string;
  status: string;
  services: { name: string } | null;
  tenants: { name: string } | null;
}

export default function HomeScreen() {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [recentBookings, setRecentBookings] = useState<Appointment[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    // Fetch categories
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, slug, icon_url')
      .is('parent_id', null)
      .order('display_order');

    if (cats) setCategories(cats as Category[]);

    // Fetch active tenants (requires RLS policy: "Active tenants are publicly readable")
    let tenantsQuery = supabase
      .from('tenants')
      .select('id, name, status, category_id, categories(name)')
      .eq('status', 'active')
      .order('name')
      .limit(20);

    if (selectedCategory) {
      tenantsQuery = tenantsQuery.eq('category_id', selectedCategory);
    }

    const { data: tenantList } = await tenantsQuery;
    if (tenantList) setTenants(tenantList as unknown as Tenant[]);

    // Fetch recent bookings for logged-in user
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: bookings } = await supabase
        .from('appointments')
        .select('id, start_time, status, services(name), tenants(name)')
        .eq('customer_id', user.id)
        .order('start_time', { ascending: false })
        .limit(3);

      if (bookings) setRecentBookings(bookings as unknown as Appointment[]);
    }

    setLoading(false);
    setRefreshing(false);
  }, [selectedCategory]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const filteredTenants = search.trim()
    ? tenants.filter((t) =>
        t.name.toLowerCase().includes(search.toLowerCase())
      )
    : tenants;

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#6366f1" />
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6366f1" />
        }
      >
        {/* Search */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#9ca3af" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Find a service near you"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>

        {/* Category pills */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoryRow}
        >
          <TouchableOpacity
            style={[
              styles.categoryPill,
              !selectedCategory && styles.categoryPillActive,
            ]}
            onPress={() => setSelectedCategory(null)}
          >
            <Text
              style={[
                styles.categoryPillText,
                !selectedCategory && styles.categoryPillTextActive,
              ]}
            >
              All
            </Text>
          </TouchableOpacity>
          {categories.map((cat) => (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.categoryPill,
                selectedCategory === cat.id && styles.categoryPillActive,
              ]}
              onPress={() =>
                setSelectedCategory(
                  selectedCategory === cat.id ? null : cat.id
                )
              }
            >
              <Text
                style={[
                  styles.categoryPillText,
                  selectedCategory === cat.id && styles.categoryPillTextActive,
                ]}
              >
                {cat.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Recent bookings */}
        {recentBookings.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Bookings</Text>
            {recentBookings.map((booking) => (
              <TouchableOpacity
                key={booking.id}
                style={styles.recentCard}
                onPress={() =>
                  router.push({ pathname: '/(main)/bookings' })
                }
              >
                <View style={styles.recentCardLeft}>
                  <Text style={styles.recentService}>
                    {booking.services?.name ?? 'Service'}
                  </Text>
                  <Text style={styles.recentBusiness}>
                    {booking.tenants?.name ?? 'Business'}
                  </Text>
                </View>
                <View style={styles.recentCardRight}>
                  <Text style={styles.recentDate}>
                    {new Date(booking.start_time).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                  </Text>
                  <View
                    style={[
                      styles.statusBadge,
                      booking.status === 'confirmed'
                        ? styles.statusConfirmed
                        : booking.status === 'completed'
                        ? styles.statusCompleted
                        : styles.statusCancelled,
                    ]}
                  >
                    <Text style={styles.statusText}>{booking.status}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Featured businesses */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Featured Businesses</Text>
          {filteredTenants.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="storefront-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyTitle}>No businesses found</Text>
              <Text style={styles.emptySubtitle}>
                Try a different category or use the AI assistant to find what you need.
              </Text>
            </View>
          ) : (
            filteredTenants.map((tenant) => (
              <TouchableOpacity
                key={tenant.id}
                style={styles.businessCard}
                onPress={() =>
                  router.push({
                    pathname: '/chat',
                    params: { tenantId: tenant.id, tenantName: tenant.name },
                  })
                }
              >
                <View style={styles.businessAvatar}>
                  <Text style={styles.businessAvatarText}>
                    {tenant.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.businessInfo}>
                  <Text style={styles.businessName}>{tenant.name}</Text>
                  <Text style={styles.businessCategory}>
                    {tenant.categories?.name ?? 'Services'}
                  </Text>
                </View>
                <Ionicons
                  name="chatbubble-outline"
                  size={20}
                  color="#6366f1"
                />
              </TouchableOpacity>
            ))
          )}
        </View>
      </ScrollView>

      {/* Floating AI chat button — always visible as a general assistant */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() =>
          router.push({
            pathname: '/chat',
            params: { tenantName: 'Balkina AI' },
          })
        }
        activeOpacity={0.85}
      >
        <Ionicons name="chatbubbles" size={24} color="#fff" />
        <Text style={styles.fabText}>Chat with AI</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  contentContainer: {
    paddingBottom: 80,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f9fafb',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  categoryRow: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  categoryPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  categoryPillActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  categoryPillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  categoryPillTextActive: {
    color: '#fff',
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  recentCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  recentCardLeft: {
    flex: 1,
  },
  recentCardRight: {
    alignItems: 'flex-end',
  },
  recentService: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  recentBusiness: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  recentDate: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  statusConfirmed: {
    backgroundColor: '#dbeafe',
  },
  statusCompleted: {
    backgroundColor: '#d1fae5',
  },
  statusCancelled: {
    backgroundColor: '#fee2e2',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'capitalize',
    color: '#374151',
  },
  businessCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  businessAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  businessAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  businessInfo: {
    flex: 1,
  },
  businessName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  businessCategory: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 4,
    lineHeight: 20,
    paddingHorizontal: 24,
  },
  fab: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 28,
    elevation: 4,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    gap: 8,
  },
  fabText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
});
