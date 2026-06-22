import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Platform,
  Animated,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/currency';
import type { BookingService } from './PropertyBookingFlow';

const { height: SCREEN_H } = Dimensions.get('window');
const IVORY = '#F8F6F2';
const INK = '#171513';
const MUTED = '#8A837A';
const HAIRLINE = '#ECE7DE';
const OPEN_GREEN = '#1E9E63';
const DISPLAY = Platform.select({ ios: 'Avenir Next', default: undefined });

export interface BusinessSummary {
  id: string;
  name: string;
  cover_image_url: string | null;
  logo_url: string | null;
  category: string | null;
  subcategory: string | null;
  description: string | null;
  avg_rating: number | null;
  review_count: number | null;
}

export interface BookingSelection {
  extras: string[];
  packageName?: string;
  addOnTotal: number;
}

interface Props {
  visible: boolean;
  apiBase: string;
  accent: string;
  business: BusinessSummary | null;
  initialServiceId?: string | null;
  onClose: () => void;
  onBook: (service: BookingService, selection: BookingSelection) => void;
}

function to12h(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr ?? '0', 10);
  const mer = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${mStr ?? '00'} ${mer}`;
}

function deriveHours(services: BookingService[]): { open: boolean; label: string | null } {
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  for (const s of services) {
    const ts = s.timesheet as Record<string, { enabled?: boolean; start?: string; end?: string }> | null | undefined;
    const day = ts?.[weekday];
    if (day && day.enabled !== false && day.start && day.end) {
      const [sh, sm] = day.start.split(':').map(Number);
      const [eh, em] = day.end.split(':').map(Number);
      const mins = now.getHours() * 60 + now.getMinutes();
      const open = mins >= sh! * 60 + (sm ?? 0) && mins <= eh! * 60 + (em ?? 0);
      return { open, label: `${to12h(day.start)} – ${to12h(day.end)}` };
    }
  }
  return { open: false, label: null };
}

// ── Service-detail bottom sheet (in-page overlay; no nested Modal) ──
function ServiceSheet({
  service, tenantId, apiBase, accent, onClose, onBook,
}: {
  service: BookingService;
  tenantId: string;
  apiBase: string;
  accent: string;
  onClose: () => void;
  onBook: (service: BookingService, selection: BookingSelection) => void;
}) {
  const [extras, setExtras] = useState<{ name: string; price: number }[]>([]);
  const [packages, setPackages] = useState<{ name: string; price: number; description: string | null }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selExtras, setSelExtras] = useState<Set<string>>(new Set());
  const [selPackage, setSelPackage] = useState<string | null>(null);

  const slide = useRef(new Animated.Value(SCREEN_H)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/booking/service-detail?serviceId=${service.id}&tenantId=${tenantId}`);
        const data = await res.json();
        if (!cancelled) { setExtras(data.extras ?? []); setPackages(data.packages ?? []); }
      } catch { /* ignore */ } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [service.id]);

  const close = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: SCREEN_H, duration: 220, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const toggleExtra = (name: string) => {
    setSelExtras((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name); else next.add(name);
      return next;
    });
  };

  const base = service.hide_price ? 0 : Number(service.price);
  const extrasTotal = extras.filter((e) => selExtras.has(e.name)).reduce((s, e) => s + Number(e.price), 0);
  const pkgTotal = selPackage ? Number(packages.find((p) => p.name === selPackage)?.price ?? 0) : 0;
  const total = base + extrasTotal + pkgTotal;
  const perPerson = service.pricing_type === 'per_person';

  return (
    <View style={StyleSheet.absoluteFill}>
      <Animated.View style={[styles.sheetBackdrop, { opacity: fade }]}>
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
      </Animated.View>
      <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }] }]}>
        {service.image_url ? (
          <View style={styles.sheetImage}>
            <Image source={{ uri: service.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.sheetHandleLight} />
            <TouchableOpacity onPress={close} style={styles.sheetImageClose} hitSlop={10}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.sheetHandle} />
        )}

        <ScrollView contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator={false}>
          <View style={styles.sheetTitleRow}>
            <Text style={styles.sheetTitle} numberOfLines={2}>{service.name}</Text>
            {!service.image_url ? (
              <TouchableOpacity onPress={close} style={styles.sheetClose} hitSlop={10}>
                <Ionicons name="close" size={22} color={INK} />
              </TouchableOpacity>
            ) : null}
          </View>

          <View style={styles.sheetMetaRow}>
            {!service.hide_price ? <Text style={styles.sheetPrice}>{formatPrice(base, service.currency)}{perPerson ? ' / guest' : ''}</Text> : null}
            {service.service_type !== 'event' ? <Text style={styles.sheetMeta}>{service.duration_minutes} min</Text> : null}
          </View>

          {service.description ? <Text style={styles.sheetDesc}>{service.description}</Text> : null}

          {loading ? (
            <ActivityIndicator color={accent} style={{ marginTop: 24 }} />
          ) : (
            <>
              {packages.length > 0 && (
                <>
                  <Text style={styles.groupTitle}>PACKAGES</Text>
                  {packages.map((p) => {
                    const active = selPackage === p.name;
                    return (
                      <TouchableOpacity key={p.name} style={[styles.option, active && { borderColor: accent }]} activeOpacity={0.8}
                        onPress={() => setSelPackage(active ? null : p.name)}>
                        <View style={[styles.radio, active && { borderColor: accent }]}>{active ? <View style={[styles.radioDot, { backgroundColor: accent }]} /> : null}</View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.optionName}>{p.name}</Text>
                          {p.description ? <Text style={styles.optionDesc} numberOfLines={2}>{p.description}</Text> : null}
                        </View>
                        <Text style={styles.optionPrice}>{formatPrice(Number(p.price), service.currency)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}

              {extras.length > 0 && (
                <>
                  <Text style={styles.groupTitle}>ADD-ONS</Text>
                  {extras.map((e) => {
                    const active = selExtras.has(e.name);
                    return (
                      <TouchableOpacity key={e.name} style={[styles.option, active && { borderColor: accent }]} activeOpacity={0.8} onPress={() => toggleExtra(e.name)}>
                        <View style={[styles.check, active && { backgroundColor: accent, borderColor: accent }]}>{active ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}</View>
                        <Text style={[styles.optionName, { flex: 1 }]}>{e.name}</Text>
                        <Text style={styles.optionPrice}>+{formatPrice(Number(e.price), service.currency)}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </>
          )}
        </ScrollView>

        <TouchableOpacity
          style={[styles.fab, { backgroundColor: accent }]}
          activeOpacity={0.9}
          onPress={() => onBook(service, { extras: Array.from(selExtras), packageName: selPackage ?? undefined, addOnTotal: extrasTotal + pkgTotal })}
        >
          <Ionicons name="calendar-outline" size={18} color="#fff" />
          <Text style={styles.fabText}>{service.hide_price ? 'Book' : `Book · ${formatPrice(total, service.currency)}`}</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

export default function PropertyBusinessPage({ visible, apiBase, accent, business, initialServiceId, onClose, onBook }: Props) {
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'details' | 'services'>('services');
  const [sheetService, setSheetService] = useState<BookingService | null>(null);

  useEffect(() => {
    if (!visible || !business) return;
    setTab('services');
    setSheetService(null);
    let cancelled = false;
    (async () => {
      setLoading(true);
      setServices([]);
      try {
        const res = await fetch(`${apiBase}/api/booking/services?tenantId=${business.id}`);
        const data = (await res.json()) as { services?: BookingService[] };
        if (cancelled) return;
        const list = data.services ?? [];
        setServices(list);
        // Experiences open straight into the service detail.
        if (initialServiceId) {
          const found = list.find((s) => s.id === initialServiceId);
          if (found) setSheetService(found);
        }
      } catch {
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, business?.id, initialServiceId]);

  const cover = business?.cover_image_url || business?.logo_url || null;
  const hours = deriveHours(services);

  const priceLabel = (s: BookingService) =>
    s.hide_price ? '' : `${formatPrice(Number(s.price), s.currency)}${s.pricing_type === 'per_person' ? ' / guest' : ''}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Full-bleed hero */}
          <View style={[styles.hero, { backgroundColor: accent }]}>
            {cover ? <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
          </View>

          {/* Name + rating below the image */}
          <View style={styles.titleBlock}>
            <Text style={styles.title} numberOfLines={2}>{business?.name}</Text>
            <View style={styles.metaRow}>
              {business?.avg_rating && business.avg_rating > 0 ? (
                <View style={styles.ratingRow}>
                  <Ionicons name="star" size={14} color={INK} />
                  <Text style={styles.ratingText}>{business.avg_rating.toFixed(1)}{business.review_count ? ` · ${business.review_count} reviews` : ''}</Text>
                </View>
              ) : null}
              {hours.label ? (
                <View style={styles.openRow}>
                  <View style={[styles.dot, { backgroundColor: hours.open ? OPEN_GREEN : '#C0392B' }]} />
                  <Text style={[styles.openText, { color: hours.open ? OPEN_GREEN : '#C0392B' }]}>{hours.open ? 'Open' : 'Closed'}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* Tabs */}
          <View style={styles.tabs}>
            {(['details', 'services'] as const).map((t) => (
              <TouchableOpacity key={t} style={styles.tab} onPress={() => setTab(t)} activeOpacity={0.7}>
                <Text style={[styles.tabText, tab === t && { color: INK }]}>{t === 'details' ? 'Details' : 'Services'}</Text>
                {tab === t ? <View style={[styles.tabUnderline, { backgroundColor: accent }]} /> : null}
              </TouchableOpacity>
            ))}
          </View>

          {tab === 'details' ? (
            <View style={styles.tabBody}>
              {business?.description ? <Text style={styles.bio}>{business.description}</Text> : null}
              <View style={styles.infoCard}>
                {business?.category || business?.subcategory ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="pricetag-outline" size={18} color={MUTED} />
                    <Text style={styles.infoText}>{[business.category, business.subcategory].filter(Boolean).join(' · ')}</Text>
                  </View>
                ) : null}
                {hours.label ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="time-outline" size={18} color={MUTED} />
                    <Text style={styles.infoText}>Today {hours.label} · <Text style={{ color: hours.open ? OPEN_GREEN : '#C0392B', fontWeight: '700' }}>{hours.open ? 'Open now' : 'Closed'}</Text></Text>
                  </View>
                ) : null}
                {business?.avg_rating && business.avg_rating > 0 ? (
                  <View style={styles.infoRow}>
                    <Ionicons name="star-outline" size={18} color={MUTED} />
                    <Text style={styles.infoText}>{business.avg_rating.toFixed(1)} average · {business.review_count ?? 0} reviews</Text>
                  </View>
                ) : null}
              </View>
              {!business?.description && !hours.label ? <Text style={styles.empty}>No additional details yet.</Text> : null}
            </View>
          ) : (
            <View style={styles.tabBody}>
              {loading ? (
                <ActivityIndicator color={accent} style={{ marginTop: 30 }} />
              ) : services.length === 0 ? (
                <Text style={styles.empty}>No bookable services right now.</Text>
              ) : services.map((s) => (
                <TouchableOpacity key={s.id} style={styles.row} activeOpacity={0.85} onPress={() => setSheetService(s)}>
                  {s.image_url ? <Image source={{ uri: s.image_url }} style={styles.rowThumb} /> : <View style={[styles.rowThumb, { backgroundColor: accent }]} />}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
                    <Text style={styles.rowMeta}>
                      {s.service_type === 'event' ? 'Experience' : s.service_type === 'table' ? 'Reservation' : `${s.duration_minutes} min`}
                      {priceLabel(s) ? ` · ${priceLabel(s)}` : ''}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={MUTED} />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Back button over the hero */}
        <SafeAreaView style={styles.backBar} pointerEvents="box-none">
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
        </SafeAreaView>

        {sheetService ? (
          <ServiceSheet
            service={sheetService}
            tenantId={business?.id ?? ''}
            apiBase={apiBase}
            accent={accent}
            onClose={() => setSheetService(null)}
            onBook={(svc, sel) => { setSheetService(null); onBook(svc, sel); }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  hero: { width: '100%', height: 290, overflow: 'hidden' },

  backBar: { position: 'absolute', top: 0, left: 0 },
  backBtn: { margin: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 3 },

  titleBlock: { paddingHorizontal: 22, paddingTop: 18 },
  title: { fontSize: 28, fontWeight: '600', color: INK, fontFamily: DISPLAY, letterSpacing: 0.3 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  ratingText: { fontSize: 14, fontWeight: '600', color: INK },
  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  openText: { fontSize: 14, fontWeight: '700' },

  tabs: { flexDirection: 'row', gap: 28, paddingHorizontal: 22, marginTop: 22, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  tab: { paddingBottom: 12 },
  tabText: { fontSize: 16, fontWeight: '600', color: MUTED, fontFamily: DISPLAY },
  tabUnderline: { position: 'absolute', bottom: -1, left: 0, right: 0, height: 2.5, borderRadius: 2 },

  tabBody: { padding: 22 },
  bio: { fontSize: 15, color: '#4A453E', lineHeight: 23, marginBottom: 18 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: HAIRLINE, padding: 16, gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 14, color: INK, flex: 1 },
  empty: { fontSize: 14, color: MUTED, marginTop: 20, textAlign: 'center' },

  row: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff', borderRadius: 16, padding: 14, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1 },
  rowThumb: { width: 54, height: 54, borderRadius: 12 },
  rowName: { fontSize: 16, fontWeight: '700', color: INK },
  rowMeta: { fontSize: 13, color: MUTED, marginTop: 3 },

  // Service sheet
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, height: SCREEN_H * 0.86, backgroundColor: IVORY, borderTopLeftRadius: 22, borderTopRightRadius: 22, overflow: 'hidden' },
  sheetImage: { width: '100%', height: 180, backgroundColor: '#ddd' },
  sheetImageClose: { position: 'absolute', top: 14, right: 14, width: 34, height: 34, borderRadius: 17, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  sheetHandleLight: { position: 'absolute', top: 8, alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.75)' },
  sheetScroll: { paddingHorizontal: 22, paddingTop: 14, paddingBottom: 110 },
  sheetTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  sheetHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D8D2C8', marginTop: 10, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
  sheetTitle: { flex: 1, fontSize: 24, fontWeight: '600', color: INK, fontFamily: DISPLAY, letterSpacing: 0.2 },
  sheetClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: HAIRLINE, alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  sheetMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, marginBottom: 12 },
  sheetPrice: { fontSize: 18, fontWeight: '700', color: INK },
  sheetMeta: { fontSize: 14, color: MUTED },
  sheetDesc: { fontSize: 15, color: '#4A453E', lineHeight: 23, marginBottom: 6 },

  groupTitle: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700', color: MUTED, marginTop: 22, marginBottom: 12 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: HAIRLINE, padding: 14, marginBottom: 10 },
  optionName: { fontSize: 15, fontWeight: '600', color: INK },
  optionDesc: { fontSize: 13, color: MUTED, marginTop: 3, lineHeight: 18 },
  optionPrice: { fontSize: 15, fontWeight: '700', color: INK },
  radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#cfc8bd', alignItems: 'center', justifyContent: 'center' },
  radioDot: { width: 11, height: 11, borderRadius: 6 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#cfc8bd', alignItems: 'center', justifyContent: 'center' },

  fab: { position: 'absolute', bottom: 28, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 28, paddingVertical: 15, borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
