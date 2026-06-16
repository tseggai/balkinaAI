import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  SafeAreaView,
  Animated,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/currency';

const { width: SCREEN_W } = Dimensions.get('window');
const IVORY = '#F8F6F2';
const INK = '#171513';
const MUTED = '#8A837A';
const HAIRLINE = '#ECE7DE';
const OPEN_GREEN = '#1E9E63';
// A refined display face for headings (iOS ships Didot/Optima); falls back to
// the system sans elsewhere. Names/headers lean editorial + airy.
const DISPLAY = Platform.select({ ios: 'Optima', default: undefined });

export interface StorefrontTenant {
  id: string;
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  subcategory: string | null;
  description: string | null;
  slug: string | null;
  avg_rating: number | null;
  review_count: number | null;
  featured?: boolean;
}

interface EventService {
  id: string;
  tenant_id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price: number;
  pricing_type: string | null;
  duration_minutes: number;
  service_type: string;
  capacity: number | null;
  deposit_enabled?: boolean;
  hide_price?: boolean;
  event_dates?: { date: string; start_time: string | null }[];
  timesheet?: Record<string, { enabled?: boolean; start?: string; end?: string }> | null;
}

/** True if the service's open-hours timesheet covers the current local time. */
function isOpenNow(ts: Record<string, { enabled?: boolean; start?: string; end?: string }> | null | undefined): boolean {
  if (!ts) return false;
  const now = new Date();
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const day = ts[weekday];
  if (!day || day.enabled === false || !day.start || !day.end) return false;
  const [sh, sm] = day.start.split(':').map(Number);
  const [eh, em] = day.end.split(':').map(Number);
  const mins = now.getHours() * 60 + now.getMinutes();
  return mins >= sh! * 60 + (sm ?? 0) && mins <= eh! * 60 + (em ?? 0);
}

export interface StorefrontProperty {
  id: string;
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  welcome_message: string;
  primary_color: string;
  tenants: StorefrontTenant[];
}

interface Props {
  property: StorefrontProperty;
  apiBase: string;
  isLoggedIn?: boolean;
  onAccountPress?: () => void;
  onSelectBusiness: (tenant: StorefrontTenant) => void;
  onSelectEvent: (event: EventService, tenantName: string) => void;
}

function coverFor(t: StorefrontTenant): string | null {
  return t.cover_image_url || t.logo_url;
}

function Monogram({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <View style={[styles.monogram, { width: size, height: size, backgroundColor: color }]}>
      <Text style={[styles.monogramText, { fontSize: size * 0.36 }]}>{name.trim().charAt(0).toUpperCase()}</Text>
    </View>
  );
}

function Rating({ avg, count }: { avg: number | null; count: number | null }) {
  if (!avg || avg <= 0) return null;
  return (
    <View style={styles.ratingRow}>
      <Ionicons name="star" size={11} color={INK} />
      <Text style={styles.ratingText}>{avg.toFixed(1)}{count ? ` · ${count}` : ''}</Text>
    </View>
  );
}

export default function PropertyStorefront({ property, apiBase, isLoggedIn, onAccountPress, onSelectBusiness, onSelectEvent }: Props) {
  const accent = property.primary_color || '#1a365d';
  const [allServices, setAllServices] = useState<EventService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [openNow, setOpenNow] = useState(false);
  const [headerH, setHeaderH] = useState(150);

  const scrollY = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 420, useNativeDriver: true }).start();
  }, [fade]);

  const tenantById = useMemo(() => {
    const m = new Map<string, StorefrontTenant>();
    property.tenants.forEach((t) => m.set(t.id, t));
    return m;
  }, [property.tenants]);

  useEffect(() => {
    const ids = property.tenants.map((t) => t.id);
    if (ids.length === 0) { setServicesLoading(false); return; }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/booking/services?tenantIds=${ids.join(',')}`);
        if (!res.ok) return;
        const data = (await res.json()) as { services?: EventService[] };
        if (!cancelled) setAllServices(data.services ?? []);
      } catch { /* sections degrade gracefully */ } finally {
        if (!cancelled) setServicesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [apiBase, property.tenants]);

  const events = useMemo(() => allServices.filter((s) => s.service_type === 'event'), [allServices]);
  const featured = property.tenants.filter((t) => t.featured);

  const openByTenant = useMemo(() => {
    const byTenant = new Map<string, EventService[]>();
    allServices.forEach((s) => {
      const a = byTenant.get(s.tenant_id) ?? [];
      a.push(s);
      byTenant.set(s.tenant_id, a);
    });
    const map = new Map<string, boolean | null>();
    property.tenants.forEach((t) => {
      const withHours = (byTenant.get(t.id) ?? []).filter((s) => s.timesheet && Object.keys(s.timesheet).length > 0);
      map.set(t.id, withHours.length === 0 ? null : withHours.some((s) => isOpenNow(s.timesheet)));
    });
    return map;
  }, [allServices, property.tenants]);

  const passesOpen = (id: string) => !openNow || openByTenant.get(id) !== false;

  const sections = useMemo(() => {
    const groups = new Map<string, StorefrontTenant[]>();
    property.tenants.forEach((t) => {
      const key = t.subcategory?.trim() || 'Discover';
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    });
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [property.tenants]);

  const categories = useMemo(() => sections.map(([title]) => title), [sections]);
  const tabs = useMemo(() => ['All', ...categories], [categories]);

  // Collapsing hero: big logo fades out, compact header logo fades in.
  const heroOpacity = scrollY.interpolate({ inputRange: [0, 150], outputRange: [1, 0], extrapolate: 'clamp' });
  const heroTranslate = scrollY.interpolate({ inputRange: [0, 220], outputRange: [0, -40], extrapolate: 'clamp' });
  const miniOpacity = scrollY.interpolate({ inputRange: [110, 190], outputRange: [0, 1], extrapolate: 'clamp' });

  // ── Cards (image-top, white detail below — luxury editorial) ──
  const OpenDot = ({ id }: { id: string }) => {
    const state = openByTenant.get(id);
    if (state === null || state === undefined) return null;
    return (
      <View style={styles.openRow}>
        <View style={[styles.dot, { backgroundColor: state ? OPEN_GREEN : '#C0392B' }]} />
        <Text style={[styles.openText, { color: state ? OPEN_GREEN : '#C0392B' }]}>{state ? 'Open now' : 'Closed'}</Text>
      </View>
    );
  };

  const BizCard = ({ t, wide }: { t: StorefrontTenant; wide?: boolean }) => {
    const img = coverFor(t);
    return (
      <TouchableOpacity style={[styles.card, wide ? styles.cardWide : styles.cardCarousel]} activeOpacity={0.9} onPress={() => onSelectBusiness(t)}>
        <View style={[styles.cardImage, wide ? styles.cardImageWide : styles.cardImageCarousel, { backgroundColor: accent }]}>
          {img ? <Image source={{ uri: img }} style={styles.fill} resizeMode="cover" />
               : <Monogram name={t.name} color="rgba(255,255,255,0.2)" size={60} />}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>{t.name}</Text>
          {t.subcategory ? <Text style={styles.cardEyebrow}>{t.subcategory.toUpperCase()}</Text> : null}
          {wide && t.description ? <Text style={styles.cardDesc} numberOfLines={2}>{t.description}</Text> : null}
          <View style={styles.cardFooter}>
            <Rating avg={t.avg_rating} count={t.review_count} />
            <OpenDot id={t.id} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const SectionHeader = ({ title, onSeeAll, count }: { title: string; onSeeAll?: () => void; count?: number }) => (
    <View style={styles.sectionHead}>
      <Text style={styles.sectionTitle}>{title.toUpperCase()}.</Text>
      {onSeeAll ? (
        <TouchableOpacity onPress={onSeeAll} hitSlop={8}>
          <Text style={[styles.seeAll, { color: accent }]}>See all{count ? ` (${count})` : ''}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );

  return (
    <View style={styles.scroll}>
      {/* ── Fixed luxury header (compact logo + scrollable tabs) ── */}
      <SafeAreaView style={styles.header} onLayout={(e) => setHeaderH(e.nativeEvent.layout.height)}>
        <View style={styles.headerTop}>
          <Animated.View style={[styles.headerBrand, { opacity: miniOpacity }]}>
            {property.logo_url ? <Image source={{ uri: property.logo_url }} style={styles.headerLogo} /> : null}
            <Text style={styles.headerName} numberOfLines={1}>{property.name}</Text>
          </Animated.View>
          {onAccountPress ? (
            <TouchableOpacity style={[styles.accountBtn, { borderColor: HAIRLINE }]} onPress={onAccountPress} activeOpacity={0.8} hitSlop={8}>
              <Ionicons name={isLoggedIn ? 'person' : 'person-outline'} size={19} color={INK} />
            </TouchableOpacity>
          ) : null}
        </View>
        {tabs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {tabs.map((t) => {
              const key = t === 'All' ? 'all' : t;
              const active = filter === key;
              return (
                <TouchableOpacity key={t} onPress={() => setFilter(key)} style={styles.tab} activeOpacity={0.7}>
                  <Text style={[styles.tabText, active && { color: INK }]}>{t}</Text>
                  {active ? <View style={[styles.tabUnderline, { backgroundColor: accent }]} /> : null}
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={() => setOpenNow((o) => !o)} style={[styles.openChip, openNow && { backgroundColor: accent, borderColor: accent }]} activeOpacity={0.8}>
              <View style={[styles.dot, { backgroundColor: openNow ? '#fff' : OPEN_GREEN }]} />
              <Text style={[styles.openChipText, openNow && { color: '#fff' }]}>Open now</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </SafeAreaView>

      <Animated.ScrollView
        style={{ opacity: fade }}
        contentContainerStyle={{ paddingTop: headerH, paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {/* ── Hero banner (big logo fades on scroll) ── */}
        <Animated.View style={[styles.banner, { backgroundColor: accent, opacity: heroOpacity, transform: [{ translateY: heroTranslate }] }]}>
          {property.cover_image_url ? (
            <>
              <Image source={{ uri: property.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
              <View style={styles.bannerScrim} />
            </>
          ) : null}
          <View style={styles.bannerContent}>
            {property.logo_url ? <Image source={{ uri: property.logo_url }} style={styles.bannerLogo} /> : null}
            <Text style={styles.bannerEyebrow}>WELCOME TO</Text>
            <Text style={styles.bannerTitle}>{property.name}</Text>
            <Text style={styles.bannerSubtitle}>{property.welcome_message}</Text>
          </View>
        </Animated.View>

        {/* ── Featured ── */}
        {filter === 'all' && featured.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Featured" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselRow}>
              {featured.map((t) => <BizCard key={t.id} t={t} />)}
            </ScrollView>
          </View>
        )}

        {/* ── Experiences ── */}
        {filter === 'all' && (servicesLoading ? (
          <ActivityIndicator size="small" color={accent} style={{ marginVertical: 28 }} />
        ) : events.length > 0 ? (
          <View style={styles.section}>
            <SectionHeader title="Experiences" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselRow}>
              {events.map((ev) => {
                const tenant = tenantById.get(ev.tenant_id);
                const perPerson = ev.pricing_type === 'per_person';
                const img = ev.image_url || (tenant ? coverFor(tenant) : null);
                return (
                  <TouchableOpacity key={ev.id} style={[styles.card, styles.cardCarousel]} activeOpacity={0.9} onPress={() => onSelectEvent(ev, tenant?.name ?? '')}>
                    <View style={[styles.cardImage, styles.cardImageCarousel, { backgroundColor: accent }]}>
                      {img ? <Image source={{ uri: img }} style={styles.fill} resizeMode="cover" />
                           : <Ionicons name="sparkles-outline" size={26} color="rgba(255,255,255,0.85)" />}
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardName} numberOfLines={1}>{ev.name}</Text>
                      {tenant?.name ? <Text style={styles.cardEyebrow}>{tenant.name.toUpperCase()}</Text> : null}
                      <View style={styles.cardFooter}>
                        <Text style={styles.price}>{formatPrice(Number(ev.price))}{perPerson ? ' / guest' : ''}</Text>
                        <View style={[styles.reservePill, { borderColor: accent }]}>
                          <Text style={[styles.reservePillText, { color: accent }]}>Reserve</Text>
                        </View>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null)}

        {/* ── Discover ── */}
        {filter === 'all' ? (
          sections.map(([title, tenants]) => {
            const visible = tenants.filter((t) => passesOpen(t.id));
            if (visible.length === 0) return null;
            return (
              <View key={title} style={styles.section}>
                <SectionHeader title={title} onSeeAll={visible.length > 2 ? () => setFilter(title) : undefined} count={visible.length} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselRow}>
                  {visible.slice(0, 8).map((t) => <BizCard key={t.id} t={t} />)}
                </ScrollView>
              </View>
            );
          })
        ) : (
          (() => {
            const tenants = (sections.find(([title]) => title === filter)?.[1] ?? []).filter((t) => passesOpen(t.id));
            return (
              <View style={styles.section}>
                <SectionHeader title={filter} />
                {tenants.length === 0 ? (
                  <Text style={styles.emptyText}>{openNow ? 'Nothing open right now.' : 'Nothing here yet.'}</Text>
                ) : (
                  <View style={{ gap: 22 }}>
                    {tenants.map((t) => <BizCard key={t.id} t={t} wide />)}
                  </View>
                )}
              </View>
            );
          })()
        )}
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: IVORY },

  // Fixed header
  header: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30,
    backgroundColor: 'rgba(248,246,242,0.96)', borderBottomWidth: 1, borderBottomColor: HAIRLINE,
  },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 8, minHeight: 44 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  headerLogo: { width: 30, height: 30, borderRadius: 8 },
  headerName: { fontSize: 19, fontWeight: '600', color: INK, fontFamily: DISPLAY, letterSpacing: 0.3 },
  accountBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', borderWidth: 1, backgroundColor: '#fff' },

  tabsRow: { gap: 22, paddingHorizontal: 20, paddingTop: 12, alignItems: 'flex-end' },
  tab: { paddingBottom: 12 },
  tabText: { fontSize: 15, fontWeight: '600', color: MUTED, letterSpacing: 0.2 },
  tabUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, borderRadius: 2 },
  openChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: HAIRLINE, backgroundColor: '#fff',
  },
  openChipText: { fontSize: 12, fontWeight: '700', color: INK },

  // Banner
  banner: { minHeight: 300, justifyContent: 'flex-end', overflow: 'hidden' },
  bannerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  bannerContent: { paddingHorizontal: 28, paddingTop: 40, paddingBottom: 40, alignItems: 'center' },
  bannerLogo: { width: 76, height: 76, borderRadius: 18, marginBottom: 20 },
  bannerEyebrow: { color: 'rgba(255,255,255,0.82)', fontSize: 11, letterSpacing: 3.5, fontWeight: '600', marginBottom: 12 },
  bannerTitle: { color: '#fff', fontSize: 38, fontFamily: DISPLAY, fontWeight: '600', letterSpacing: 0.5, textAlign: 'center' },
  bannerSubtitle: { color: 'rgba(255,255,255,0.92)', fontSize: 15, textAlign: 'center', marginTop: 14, lineHeight: 22, maxWidth: 300 },

  // Sections
  section: { paddingHorizontal: 20, marginTop: 40 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 18 },
  sectionTitle: { fontSize: 26, fontWeight: '800', color: INK, letterSpacing: -0.5 },
  seeAll: { fontSize: 14, fontWeight: '700' },
  emptyText: { fontSize: 14, color: MUTED, paddingVertical: 8 },
  carouselRow: { gap: 18, paddingRight: 20 },

  // Cards (image-top, white body)
  card: {
    backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden',
    shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 16, shadowOffset: { width: 0, height: 6 }, elevation: 2,
  },
  cardCarousel: { width: SCREEN_W * 0.72, maxWidth: 320 },
  cardWide: { width: '100%' },
  cardImage: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardImageCarousel: { height: 170 },
  cardImageWide: { height: 210 },
  cardBody: { padding: 18 },
  cardName: { fontSize: 20, fontWeight: '700', color: INK, fontFamily: DISPLAY, letterSpacing: 0.2 },
  cardEyebrow: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700', color: MUTED, marginTop: 6 },
  cardDesc: { fontSize: 14, color: MUTED, marginTop: 10, lineHeight: 20 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  price: { fontSize: 16, fontWeight: '700', color: INK },
  reservePill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  reservePillText: { fontSize: 13, fontWeight: '700' },

  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  openText: { fontSize: 12, fontWeight: '700' },

  fill: { width: '100%', height: '100%' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 13, fontWeight: '600', color: INK },
  monogram: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  monogramText: { color: '#fff', fontWeight: '700' },
});
