import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/currency';
import type { StorefrontTenant } from './PropertyStorefront';
import type { SectionEvent } from './PropertySectionList';

const IVORY = '#F8F6F2';
const INK = '#171513';
const MUTED = '#8A837A';
const HAIRLINE = '#ECE7DE';
const DISPLAY = Platform.select({ ios: 'Avenir Next', default: undefined });

interface Props {
  visible: boolean;
  accent: string;
  tenants: StorefrontTenant[];
  events: SectionEvent[];
  tenantName: (id: string) => string | undefined;
  onClose: () => void;
  onSelectBusiness: (t: StorefrontTenant) => void;
  onSelectEvent: (e: SectionEvent) => void;
}

export default function PropertySearch({ visible, accent, tenants, events, tenantName, onClose, onSelectBusiness, onSelectEvent }: Props) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();

  const matchedTenants = useMemo(() => {
    if (!q) return [];
    return tenants.filter((t) =>
      t.name.toLowerCase().includes(q) ||
      (t.category ?? '').toLowerCase().includes(q) ||
      (t.subcategory ?? '').toLowerCase().includes(q),
    ).slice(0, 20);
  }, [tenants, q]);

  const matchedEvents = useMemo(() => {
    if (!q) return [];
    return events.filter((e) =>
      e.name.toLowerCase().includes(q) ||
      (tenantName(e.tenant_id) ?? '').toLowerCase().includes(q),
    ).slice(0, 10);
  }, [events, q, tenantName]);

  const hasResults = matchedTenants.length > 0 || matchedEvents.length > 0;

  const close = () => { setQuery(''); onClose(); };

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={close}>
      <SafeAreaView style={styles.container}>
        <View style={styles.searchBar}>
          <TouchableOpacity onPress={close} hitSlop={10} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <View style={styles.inputWrap}>
            <Ionicons name="search" size={18} color={MUTED} />
            <TextInput
              style={styles.input}
              value={query}
              onChangeText={setQuery}
              placeholder="Search businesses & experiences"
              placeholderTextColor="#9ca3af"
              autoFocus
              returnKeyType="search"
              autoCorrect={false}
            />
            {query.length > 0 ? (
              <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={18} color="#c4bdb2" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.results} showsVerticalScrollIndicator={false}>
          {!q ? (
            <Text style={styles.hint}>Start typing to find a business, service, or experience.</Text>
          ) : !hasResults ? (
            <Text style={styles.hint}>No matches for “{query}”.</Text>
          ) : (
            <>
              {matchedTenants.length > 0 && (
                <>
                  <Text style={styles.group}>BUSINESSES</Text>
                  {matchedTenants.map((t) => {
                    const img = t.cover_image_url || t.logo_url;
                    return (
                      <TouchableOpacity key={t.id} style={styles.row} activeOpacity={0.8} onPress={() => onSelectBusiness(t)}>
                        {img ? <Image source={{ uri: img }} style={styles.thumb} /> : <View style={[styles.thumb, { backgroundColor: accent }]} />}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.name} numberOfLines={1}>{t.name}</Text>
                          {(t.subcategory || t.category) ? <Text style={styles.meta} numberOfLines={1}>{t.subcategory || t.category}</Text> : null}
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#cfc8bd" />
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {matchedEvents.length > 0 && (
                <>
                  <Text style={[styles.group, { marginTop: 18 }]}>EXPERIENCES</Text>
                  {matchedEvents.map((e) => (
                    <TouchableOpacity key={e.id} style={styles.row} activeOpacity={0.8} onPress={() => onSelectEvent(e)}>
                      {e.image_url ? <Image source={{ uri: e.image_url }} style={styles.thumb} />
                                   : <View style={[styles.thumb, { backgroundColor: accent, alignItems: 'center', justifyContent: 'center' }]}><Ionicons name="sparkles-outline" size={18} color="#fff" /></View>}
                      <View style={{ flex: 1 }}>
                        <Text style={styles.name} numberOfLines={1}>{e.name}</Text>
                        <Text style={styles.meta} numberOfLines={1}>{tenantName(e.tenant_id) ?? ''} · {formatPrice(Number(e.price))}{e.pricing_type === 'per_person' ? ' / guest' : ''}</Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color="#cfc8bd" />
                    </TouchableOpacity>
                  ))}
                </>
              )}
            </>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  backBtn: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  inputWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#fff', borderWidth: 1, borderColor: HAIRLINE, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 },
  input: { flex: 1, fontSize: 15, color: INK },

  results: { padding: 20 },
  hint: { fontSize: 14, color: MUTED, marginTop: 30, textAlign: 'center', lineHeight: 20 },
  group: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700', color: MUTED, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: HAIRLINE },
  thumb: { width: 48, height: 48, borderRadius: 10 },
  name: { fontSize: 16, fontWeight: '600', color: INK, fontFamily: DISPLAY },
  meta: { fontSize: 13, color: MUTED, marginTop: 2 },
});
