import { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

interface Category {
  id: string;
  name: string;
  slug: string;
}

interface Tenant {
  id: string;
  name: string;
  category_id: string | null;
  categories: { name: string } | null;
}

export default function BusinessListScreen() {
  const router = useRouter();
  const { categoryId } = useLocalSearchParams<{ categoryId?: string }>();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(
    categoryId ?? null
  );
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    // Fetch categories
    const { data: cats } = await supabase
      .from('categories')
      .select('id, name, slug')
      .is('parent_id', null)
      .order('display_order');

    if (cats) setCategories(cats as Category[]);

    // Fetch tenants
    let query = supabase
      .from('tenants')
      .select('id, name, category_id, categories(name)')
      .eq('status', 'active')
      .order('name');

    if (selectedCategory) {
      query = query.eq('category_id', selectedCategory);
    }

    const { data } = await query.limit(100);
    setTenants((data as unknown as Tenant[]) ?? []);
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

  const renderItem = ({ item }: { item: Tenant }) => (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push({
          pathname: '/chat',
          params: { tenantId: item.id, tenantName: item.name },
        })
      }
    >
      <View style={styles.cardAvatar}>
        <Text style={styles.cardAvatarText}>
          {item.name.charAt(0).toUpperCase()}
        </Text>
      </View>
      <View style={styles.cardInfo}>
        <Text style={styles.cardName}>{item.name}</Text>
        <Text style={styles.cardCategory}>
          {item.categories?.name ?? 'Services'}
        </Text>
      </View>
      <Ionicons name="chatbubble-outline" size={20} color="#6366f1" />
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Search */}
      <View style={styles.searchContainer}>
        <Ionicons name="search" size={18} color="#9ca3af" />
        <TextInput
          style={styles.searchInput}
          placeholder="Search businesses..."
          placeholderTextColor="#9ca3af"
          value={search}
          onChangeText={setSearch}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')}>
            <Ionicons name="close-circle" size={18} color="#9ca3af" />
          </TouchableOpacity>
        )}
      </View>

      {/* Category filter */}
      <View style={styles.filterRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={[{ id: '', name: 'All', slug: '' } as Category, ...categories]}
          keyExtractor={(item) => item.id || 'all'}
          renderItem={({ item }) => {
            const isActive = item.id
              ? selectedCategory === item.id
              : !selectedCategory;
            return (
              <TouchableOpacity
                style={[styles.pill, isActive && styles.pillActive]}
                onPress={() =>
                  setSelectedCategory(item.id || null)
                }
              >
                <Text
                  style={[
                    styles.pillText,
                    isActive && styles.pillTextActive,
                  ]}
                >
                  {item.name}
                </Text>
              </TouchableOpacity>
            );
          }}
          contentContainerStyle={styles.filterContent}
        />
      </View>

      {/* List */}
      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={filteredTenants}
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
              <Ionicons name="business-outline" size={48} color="#d1d5db" />
              <Text style={styles.emptyText}>No businesses found</Text>
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
    gap: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111827',
  },
  filterRow: {
    marginTop: 8,
  },
  filterContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    marginRight: 8,
  },
  pillActive: {
    backgroundColor: '#6366f1',
    borderColor: '#6366f1',
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  pillTextActive: {
    color: '#fff',
  },
  list: {
    padding: 16,
    paddingBottom: 24,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#f3f4f6',
  },
  cardAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#6366f1',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  cardAvatarText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
  },
  cardName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
  },
  cardCategory: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    paddingTop: 80,
    gap: 8,
  },
  emptyText: {
    fontSize: 15,
    color: '#9ca3af',
  },
});
