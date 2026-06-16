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
  Animated,
  Platform,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/currency';
import PropertySectionList from './PropertySectionList';
import PropertySearch from './PropertySearch';

const { width: SCREEN_W } = Dimensions.get('window');
const IVORY = '#F8F6F2';
const INK = '#171513';
const MUTED = '#8A837A';
const HAIRLINE = '#ECE7DE';
const OPEN_GREEN = '#1E9E63';
const DISPLAY = Platform.select({ ios: 'Avenir Next', default: undefined });

// The storefront renders inside a SafeAreaView (top inset already applied on
// iOS), so the header only needs a little breathing room — not a full inset.
const TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 24) + 4 : 8;
const BANNER_H = 300;
const TABS_H = 54;
const MINI_H = TOP_INSET + 46;

export interface StorefrontTenant {
  id: string;
  name: string;
  logo_url: string | null;
  cover_image_url: string | null;
  category: string | null;
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

type SectionTarget = { title: string; mode: 'business' | 'event'; tenants?: StorefrontTenant[]; events?: EventService[] };

export default function PropertyStorefront({ property, apiBase, isLoggedIn, onAccountPress, onSelectBusiness, onSelectEvent }: Props) {
  const accent = property.primary_color || '#1a365d';
  const [allServices, setAllServices] = useState<EventService[]>([]);
  const [servicesLoading, setServicesLoading] = useState(true);
  const [sectionList, setSectionList] = useState<SectionTarget | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const scrollY = useRef(new Animated.Value(0)).current;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const scrollRef = useRef<any>(null);
  const sectionY = useRef<Record<string, number>>({});
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
  const featured = useMemo(() => property.tenants.filter((t) => t.featured), [property.tenants]);
  const popular = useMemo(
    () => [...property.tenants].filter((t) => (t.review_count ?? 0) > 0).sort((a, b) => (b.review_count ?? 0) - (a.review_count ?? 0)).slice(0, 12),
    [property.tenants],
  );
  const trending = useMemo(
    () => [...property.tenants].filter((t) => (t.avg_rating ?? 0) > 0).sort((a, b) => (b.avg_rating ?? 0) - (a.avg_rating ?? 0)).slice(0, 12),
    [property.tenants],
  );

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

  const sections = useMemo(() => {
    const groups = new Map<string, StorefrontTenant[]>();
    property.tenants.forEach((t) => {
      const key = t.category?.trim() || t.subcategory?.trim() || 'Discover';
      const arr = groups.get(key) ?? [];
      arr.push(t);
      groups.set(key, arr);
    });
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [property.tenants]);

  // Top bar = simple navigation: tap scrolls to the section below.
  const navTabs = useMemo(() => {
    const arr: string[] = [];
    if (featured.length) arr.push('Featured');
    if (events.length) arr.push('Experiences');
    if (popular.length) arr.push('Popular');
    if (trending.length) arr.push('Trending');
    sections.forEach(([title]) => arr.push(title));
    return arr;
  }, [featured.length, events.length, popular.length, trending.length, sections]);

  const scrollToSection = (title: string) => {
    const y = sectionY.current[title];
    if (y == null) return;
    scrollRef.current?.scrollTo({ y: Math.max(0, y - MINI_H - 6), animated: true });
  };

  const heroOpacity = scrollY.interpolate({ inputRange: [0, BANNER_H - MINI_H], outputRange: [1, 0], extrapolate: 'clamp' });
  const miniBg = scrollY.interpolate({ inputRange: [BANNER_H - MINI_H - 50, BANNER_H - MINI_H], outputRange: [0, 1], extrapolate: 'clamp' });
  const tabsTranslate = scrollY.interpolate({ inputRange: [0, BANNER_H - MINI_H], outputRange: [BANNER_H, MINI_H], extrapolateLeft: 'extend', extrapolateRight: 'clamp' });

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

  const BizCard = ({ t }: { t: StorefrontTenant }) => {
    const img = coverFor(t);
    return (
      <TouchableOpacity style={[styles.card, styles.cardCarousel]} activeOpacity={0.9} onPress={() => onSelectBusiness(t)}>
        <View style={[styles.cardImage, styles.cardImageCarousel, { backgroundColor: accent }]}>
          {img ? <Image source={{ uri: img }} style={styles.fill} resizeMode="cover" />
               : <Monogram name={t.name} color="rgba(255,255,255,0.2)" size={56} />}
        </View>
        <View style={styles.cardBody}>
          <Text style={styles.cardName} numberOfLines={1}>{t.name}</Text>
          {(t.subcategory || t.category) ? <Text style={styles.cardEyebrow}>{(t.subcategory || t.category)!.toUpperCase()}</Text> : null}
          <View style={styles.cardFooter}>
            <Rating avg={t.avg_rating} count={t.review_count} />
            <OpenDot id={t.id} />
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const EventCard = ({ ev }: { ev: EventService }) => {
    const tenant = tenantById.get(ev.tenant_id);
    const perPerson = ev.pricing_type === 'per_person';
    const img = ev.image_url || (tenant ? coverFor(tenant) : null);
    return (
      <TouchableOpacity style={[styles.card, styles.cardCarousel]} activeOpacity={0.9} onPress={() => onSelectEvent(ev, tenant?.name ?? '')}>
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

  const BizSection = ({ title, list }: { title: string; list: StorefrontTenant[] }) => {
    if (list.length === 0) return null;
    return (
      <View style={styles.section} onLayout={(e) => { sectionY.current[title] = e.nativeEvent.layout.y; }}>
        <SectionHeader title={title} count={list.length} onSeeAll={list.length > 2 ? () => setSectionList({ title, mode: 'business', tenants: list }) : undefined} />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselRow}>
          {list.slice(0, 8).map((t) => <BizCard key={`${title}-${t.id}`} t={t} />)}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.scroll}>
      <Animated.ScrollView
        ref={scrollRef}
        style={{ opacity: fade }}
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
      >
        {/* Hero banner */}
        <Animated.View style={[styles.banner, { backgroundColor: accent, opacity: heroOpacity }]}>
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

        <View style={{ height: TABS_H }} />

        <BizSection title="Featured" list={featured} />

        {/* Experiences */}
        {servicesLoading ? (
          <ActivityIndicator size="small" color={accent} style={{ marginVertical: 28 }} />
        ) : events.length > 0 ? (
          <View style={styles.section} onLayout={(e) => { sectionY.current['Experiences'] = e.nativeEvent.layout.y; }}>
            <SectionHeader title="Experiences" count={events.length} onSeeAll={events.length > 2 ? () => setSectionList({ title: 'Experiences', mode: 'event', events }) : undefined} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.carouselRow}>
              {events.map((ev) => <EventCard key={ev.id} ev={ev} />)}
            </ScrollView>
          </View>
        ) : null}

        <BizSection title="Popular" list={popular} />
        <BizSection title="Trending" list={trending} />
        {sections.map(([title, tenants]) => <BizSection key={title} title={title} list={tenants} />)}
      </Animated.ScrollView>

      {/* Sticky nav bar */}
      {navTabs.length > 0 && (
        <Animated.View style={[styles.tabsBar, { transform: [{ translateY: tabsTranslate }] }]}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
            {navTabs.map((t) => (
              <TouchableOpacity key={t} onPress={() => scrollToSection(t)} style={styles.tab} activeOpacity={0.7}>
                <Text style={styles.tabText}>{t.toUpperCase()}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </Animated.View>
      )}

      {/* Compact header + account */}
      <View style={[styles.miniHeader, { height: MINI_H, paddingTop: TOP_INSET }]} pointerEvents="box-none">
        <Animated.View style={[StyleSheet.absoluteFill, styles.miniBgFill, { opacity: miniBg }]} pointerEvents="none" />
        <Animated.View style={[styles.miniBrand, { opacity: miniBg }]} pointerEvents="none">
          {property.logo_url ? <Image source={{ uri: property.logo_url }} style={styles.miniLogo} /> : null}
          <Text style={styles.miniName} numberOfLines={1}>{property.name}</Text>
        </Animated.View>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.accountBtn} onPress={() => setSearchOpen(true)} activeOpacity={0.8} hitSlop={8}>
            <Ionicons name="search" size={18} color={INK} />
          </TouchableOpacity>
          {onAccountPress ? (
            <TouchableOpacity style={styles.accountBtn} onPress={onAccountPress} activeOpacity={0.8} hitSlop={8}>
              <Ionicons name={isLoggedIn ? 'person' : 'person-outline'} size={18} color={INK} />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* See-all drill-down */}
      <PropertySectionList
        visible={!!sectionList}
        accent={accent}
        title={sectionList?.title ?? ''}
        mode={sectionList?.mode ?? 'business'}
        tenants={sectionList?.tenants}
        events={sectionList?.events}
        openByTenant={openByTenant}
        tenantName={(id) => tenantById.get(id)?.name}
        onClose={() => setSectionList(null)}
        onSelectBusiness={(t) => { setSectionList(null); setTimeout(() => onSelectBusiness(t), 320); }}
        onSelectEvent={(e) => {
          const full = events.find((ev) => ev.id === e.id);
          setSectionList(null);
          if (full) setTimeout(() => onSelectEvent(full, tenantById.get(full.tenant_id)?.name ?? ''), 320);
        }}
      />

      {/* Search (autocomplete) */}
      <PropertySearch
        visible={searchOpen}
        accent={accent}
        tenants={property.tenants}
        events={events}
        tenantName={(id) => tenantById.get(id)?.name}
        onClose={() => setSearchOpen(false)}
        onSelectBusiness={(t) => { setSearchOpen(false); setTimeout(() => onSelectBusiness(t), 320); }}
        onSelectEvent={(e) => {
          const full = events.find((ev) => ev.id === e.id);
          setSearchOpen(false);
          if (full) setTimeout(() => onSelectEvent(full, tenantById.get(full.tenant_id)?.name ?? ''), 320);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: IVORY },

  miniHeader: { position: 'absolute', top: 0, left: 0, right: 0, zIndex: 30, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
  miniBgFill: { backgroundColor: 'rgba(248,246,242,0.97)', borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  miniBrand: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  miniLogo: { width: 26, height: 26, borderRadius: 7 },
  miniName: { fontSize: 16, fontWeight: '500', color: INK, fontFamily: DISPLAY, letterSpacing: 0.3 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  accountBtn: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: HAIRLINE, backgroundColor: 'rgba(255,255,255,0.92)' },

  tabsBar: { position: 'absolute', top: 0, left: 0, right: 0, height: TABS_H, zIndex: 20, backgroundColor: IVORY, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  tabsRow: { gap: 24, paddingHorizontal: 20, alignItems: 'center', height: TABS_H },
  tab: { justifyContent: 'center', height: TABS_H },
  tabText: { fontSize: 12.5, fontWeight: '600', color: INK, letterSpacing: 1.3 },

  banner: { height: BANNER_H, justifyContent: 'flex-end', overflow: 'hidden' },
  bannerScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  bannerContent: { paddingHorizontal: 28, paddingTop: 40, paddingBottom: 36, alignItems: 'center' },
  bannerLogo: { width: 70, height: 70, borderRadius: 16, marginBottom: 18 },
  bannerEyebrow: { color: 'rgba(255,255,255,0.82)', fontSize: 10.5, letterSpacing: 3.5, fontWeight: '500', marginBottom: 12 },
  bannerTitle: { color: '#fff', fontSize: 30, fontFamily: DISPLAY, fontWeight: '500', letterSpacing: 0.4, textAlign: 'center' },
  bannerSubtitle: { color: 'rgba(255,255,255,0.92)', fontSize: 14, textAlign: 'center', marginTop: 12, lineHeight: 21, maxWidth: 300 },

  section: { paddingHorizontal: 20, marginTop: 36 },
  sectionHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16 },
  sectionTitle: { fontSize: 19, fontWeight: '600', color: INK, fontFamily: DISPLAY, letterSpacing: 0.3 },
  seeAll: { fontSize: 13, fontWeight: '600' },
  carouselRow: { gap: 18, paddingRight: 20 },

  card: { backgroundColor: '#fff', borderRadius: 18, overflow: 'hidden', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 14, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  cardCarousel: { width: SCREEN_W * 0.7, maxWidth: 310 },
  cardImage: { width: '100%', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cardImageCarousel: { height: 160 },
  cardBody: { padding: 16 },
  cardName: { fontSize: 17, fontWeight: '600', color: INK, fontFamily: DISPLAY, letterSpacing: 0.2 },
  cardEyebrow: { fontSize: 10.5, letterSpacing: 1.4, fontWeight: '600', color: MUTED, marginTop: 6 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  price: { fontSize: 15, fontWeight: '600', color: INK },
  reservePill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  reservePillText: { fontSize: 12.5, fontWeight: '600' },

  openRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  openText: { fontSize: 11.5, fontWeight: '600' },

  fill: { width: '100%', height: '100%' },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12.5, fontWeight: '600', color: INK },
  monogram: { borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  monogramText: { color: '#fff', fontWeight: '700' },
});
