import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/currency';
import type { StorefrontTenant } from './PropertyStorefront';

const IVORY = '#F8F6F2';
const INK = '#171513';
const MUTED = '#8A837A';
const HAIRLINE = '#ECE7DE';
const OPEN_GREEN = '#1E9E63';
const DISPLAY = Platform.select({ ios: 'Avenir Next', default: undefined });

export interface SectionEvent {
  id: string;
  tenant_id: string;
  name: string;
  image_url: string | null;
  price: number;
  pricing_type: string | null;
  service_type: string;
}

interface Props {
  visible: boolean;
  accent: string;
  title: string;
  mode: 'business' | 'event';
  tenants?: StorefrontTenant[];
  events?: SectionEvent[];
  openByTenant?: Map<string, boolean | null>;
  tenantName?: (id: string) => string | undefined;
  onClose: () => void;
  onSelectBusiness?: (t: StorefrontTenant) => void;
  onSelectEvent?: (e: SectionEvent) => void;
}

export default function PropertySectionList({
  visible, accent, title, mode, tenants = [], events = [], openByTenant, tenantName, onClose, onSelectBusiness, onSelectEvent,
}: Props) {
  const [sub, setSub] = useState<string>('all');
  const [openNow, setOpenNow] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Distinct sub-categories present in this list (business mode only).
  const subcategories = useMemo(() => {
    const set = new Set<string>();
    tenants.forEach((t) => { if (t.subcategory?.trim()) set.add(t.subcategory.trim()); });
    return Array.from(set).sort();
  }, [tenants]);

  const visibleTenants = useMemo(() => {
    return tenants.filter((t) => {
      if (sub !== 'all' && (t.subcategory?.trim() ?? '') !== sub) return false;
      if (openNow && openByTenant?.get(t.id) === false) return false;
      return true;
    });
  }, [tenants, sub, openNow, openByTenant]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.iconBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{title}</Text>
          <View style={styles.iconBtn} />
        </View>

        {/* Filters (business mode) */}
        {mode === 'business' && (subcategories.length > 0 || true) && (
          <View style={styles.filters}>
            {subcategories.length > 0 && (
              <View style={{ flex: 1 }}>
                <TouchableOpacity style={styles.dropdown} activeOpacity={0.8} onPress={() => setDropdownOpen((o) => !o)}>
                  <Text style={styles.dropdownText} numberOfLines={1}>{sub === 'all' ? 'All categories' : sub}</Text>
                  <Ionicons name={dropdownOpen ? 'chevron-up' : 'chevron-down'} size={16} color={INK} />
                </TouchableOpacity>
              </View>
            )}
            <TouchableOpacity onPress={() => setOpenNow((o) => !o)} style={[styles.openChip, openNow && { backgroundColor: accent, borderColor: accent }]} activeOpacity={0.8}>
              <View style={[styles.dot, { backgroundColor: openNow ? '#fff' : OPEN_GREEN }]} />
              <Text style={[styles.openChipText, openNow && { color: '#fff' }]}>OPEN NOW</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Dropdown menu */}
        {dropdownOpen && mode === 'business' && (
          <View style={styles.menu}>
            <TouchableOpacity style={styles.menuItem} onPress={() => { setSub('all'); setDropdownOpen(false); }}>
              <Text style={[styles.menuItemText, sub === 'all' && { color: accent, fontWeight: '700' }]}>All categories</Text>
            </TouchableOpacity>
            {subcategories.map((s) => (
              <TouchableOpacity key={s} style={styles.menuItem} onPress={() => { setSub(s); setDropdownOpen(false); }}>
                <Text style={[styles.menuItemText, sub === s && { color: accent, fontWeight: '700' }]}>{s}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <ScrollView contentContainerStyle={styles.list} showsVerticalScrollIndicator={false}>
          {mode === 'business' ? (
            visibleTenants.length === 0 ? (
              <Text style={styles.empty}>{openNow ? 'Nothing open right now.' : 'Nothing here.'}</Text>
            ) : visibleTenants.map((t) => {
              const img = t.cover_image_url || t.logo_url;
              const state = openByTenant?.get(t.id);
              return (
                <TouchableOpacity key={t.id} style={styles.card} activeOpacity={0.9} onPress={() => onSelectBusiness?.(t)}>
                  <View style={[styles.cardImage, { backgroundColor: accent }]}>
                    {img ? <Image source={{ uri: img }} style={styles.fill} resizeMode="cover" /> : null}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName} numberOfLines={1}>{t.name}</Text>
                    {(t.subcategory || t.category) ? <Text style={styles.cardEyebrow}>{(t.subcategory || t.category)!.toUpperCase()}</Text> : null}
                    {t.description ? <Text style={styles.cardDesc} numberOfLines={2}>{t.description}</Text> : null}
                    <View style={styles.cardFooter}>
                      {t.avg_rating && t.avg_rating > 0 ? (
                        <View style={styles.ratingRow}>
                          <Ionicons name="star" size={11} color={INK} />
                          <Text style={styles.ratingText}>{t.avg_rating.toFixed(1)}{t.review_count ? ` · ${t.review_count}` : ''}</Text>
                        </View>
                      ) : <View />}
                      {state === true || state === false ? (
                        <View style={styles.openRow}>
                          <View style={[styles.dot, { backgroundColor: state ? OPEN_GREEN : '#C0392B' }]} />
                          <Text style={[styles.openText, { color: state ? OPEN_GREEN : '#C0392B' }]}>{state ? 'Open now' : 'Closed'}</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            events.length === 0 ? (
              <Text style={styles.empty}>Nothing here.</Text>
            ) : events.map((ev) => {
              const perPerson = ev.pricing_type === 'per_person';
              return (
                <TouchableOpacity key={ev.id} style={styles.card} activeOpacity={0.9} onPress={() => onSelectEvent?.(ev)}>
                  <View style={[styles.cardImage, { backgroundColor: accent }]}>
                    {ev.image_url ? <Image source={{ uri: ev.image_url }} style={styles.fill} resizeMode="cover" />
                                  : <Ionicons name="sparkles-outline" size={26} color="rgba(255,255,255,0.85)" />}
                  </View>
                  <View style={styles.cardBody}>
                    <Text style={styles.cardName} numberOfLines={1}>{ev.name}</Text>
                    {tenantName?.(ev.tenant_id) ? <Text style={styles.cardEyebrow}>{tenantName(ev.tenant_id)!.toUpperCase()}</Text> : null}
                    <View style={styles.cardFooter}>
                      <Text style={styles.price}>{formatPrice(Number(ev.price))}{perPerson ? ' / guest' : ''}</Text>
                      <View style={[styles.pill, { borderColor: accent }]}>
                        <Text style={[styles.pillText, { color: accent }]}>Reserve</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, textAlign: 'center', fontSize: 19, fontWeight: '600', color: INK, fontFamily: DISPLAY, letterSpacing: 0.3 },

  filters: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingTop: 14 },
  dropdown: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#fff', borderWidth: 1, borderColor: HAIRLINE, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  dropdownText: { fontSize: 14, fontWeight: '600', color: INK, flex: 1 },
  openChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 999, borderWidth: 1, borderColor: HAIRLINE, backgroundColor: '#fff' },
  openChipText: { fontSize: 11, fontWeight: '700', color: INK, letterSpacing: 0.8 },

  menu: { backgroundColor: '#fff', marginHorizontal: 20, marginTop: 6, borderRadius: 12, borderWidth: 1, borderColor: HAIRLINE, overflow: 'hidden' },
  menuItem: { paddingHorizontal: 16, paddingVertical: 13, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  menuItemText: { fontSize: 14, color: INK },

  list: { padding: 20, gap: 18 },
  empty: { fontSize: 14, color: MUTED, textAlign: 'center', marginTop: 40 },

  card: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardImage: { width: '100%', height: 200, alignItems: 'center', justifyContent: 'center' },
  cardBody: { padding: 16 },
  cardName: { fontSize: 17, fontWeight: '600', color: INK, fontFamily: DISPLAY, letterSpacing: 0.2 },
  cardEyebrow: { fontSize: 10.5, letterSpacing: 1.4, fontWeight: '600', color: MUTED, marginTop: 6 },
  cardDesc: { fontSize: 13.5, color: MUTED, marginTop: 9, lineHeight: 19 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  price: { fontSize: 15, fontWeight: '600', color: INK },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  pillText: { fontSize: 12.5, fontWeight: '600' },

  fill: { width: '100%', height: '100%' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12.5, fontWeight: '600', color: INK },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  openText: { fontSize: 11.5, fontWeight: '600' },
});
