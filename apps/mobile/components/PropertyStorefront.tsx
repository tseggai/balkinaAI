import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/currency';

const { width: SCREEN_W } = Dimensions.get('window');
const IVORY = '#F7F4EF';
const INK = '#1A1A1A';
const MUTED = '#6B655C';
const HAIRLINE = '#E4DED4';

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
  onSelectBusiness: (tenant: StorefrontTenant) => void;
  onSelectEvent: (event: EventService, tenantName: string) => void;
}

/** The best available photo for a business — cover first, then logo. */
function coverFor(t: StorefrontTenant): string | null {
  return t.cover_image_url || t.logo_url;
}

/** A monogram used when a business/property has no photo at all. */
function Monogram({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <View style={[styles.monogram, { width: size, height: size, backgroundColor: color }]}>
      <Text style={[styles.monogramText, { fontSize: size * 0.36 }]}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function Rating({ avg, count, light }: { avg: number | null; count: number | null; light?: boolean }) {
  if (!avg || avg <= 0) return null;
  const color = light ? '#fff' : INK;
  return (
    <View style={styles.ratingRow}>
      <Ionicons name="star" size={11} color={color} />
      <Text style={[styles.ratingText, { color }]}>
        {avg.toFixed(1)}
        {count ? ` · ${count}` : ''}
      </Text>
    </View>
  );
}

export default function PropertyStorefront({ property, apiBase, onSelectBusiness, onSelectEvent }: Props) {
  const accent = property.primary_color || '#1a365d';
  const [events, setEvents] = useState<EventService[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);

  const tenantById = useMemo(() => {
    const m = new Map<string, StorefrontTenant>();
    property.tenants.forEach((t) => m.set(t.id, t));
    return m;
  }, [property.tenants]);

  useEffect(() => {
    const ids = property.tenants.map((t) => t.id);
    if (ids.length === 0) {
      setEventsLoading(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${apiBase}/api/booking/services?tenantIds=${ids.join(',')}&serviceType=event`);
        if (!res.ok) return;
        const data = (await res.json()) as { services?: EventService[] };
        // Defensive: only surface true events as Experiences.
        if (!cancelled) setEvents((data.services ?? []).filter((s) => s.service_type === 'event'));
      } catch {
        /* ignore — events section simply hides */
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiBase, property.tenants]);

  const featured = property.tenants.filter((t) => t.featured);

  // Group the remaining businesses by subcategory for the editorial sections.
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

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {/* ── Hero (full-bleed cover) ────────────────────────── */}
      <View style={[styles.hero, { backgroundColor: accent }]}>
        {property.cover_image_url ? (
          <>
            <Image source={{ uri: property.cover_image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" />
            <View style={styles.heroScrim} />
          </>
        ) : null}
        <View style={styles.heroContent}>
          {property.logo_url ? (
            <Image source={{ uri: property.logo_url }} style={styles.heroLogo} />
          ) : null}
          <Text style={styles.heroEyebrow}>WELCOME TO</Text>
          <Text style={styles.heroTitle}>{property.name}</Text>
          <Text style={styles.heroSubtitle}>{property.welcome_message}</Text>
        </View>
      </View>

      {/* ── Featured ───────────────────────────────────────── */}
      {featured.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>FEATURED</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.featuredRow}
          >
            {featured.map((t) => {
              const img = coverFor(t);
              return (
                <TouchableOpacity
                  key={t.id}
                  style={styles.featuredCard}
                  activeOpacity={0.85}
                  onPress={() => onSelectBusiness(t)}
                >
                  <View style={[styles.featuredImage, { backgroundColor: accent }]}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.fillImage} resizeMode="cover" />
                    ) : (
                      <Monogram name={t.name} color="rgba(255,255,255,0.2)" size={64} />
                    )}
                  </View>
                  <Text style={styles.featuredName} numberOfLines={1}>{t.name}</Text>
                  {t.subcategory ? <Text style={styles.cardMeta} numberOfLines={1}>{t.subcategory}</Text> : null}
                  <Rating avg={t.avg_rating} count={t.review_count} />
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      )}

      {/* ── Experiences / Events ───────────────────────────── */}
      {eventsLoading ? (
        <ActivityIndicator size="small" color={accent} style={{ marginVertical: 24 }} />
      ) : events.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>EXPERIENCES</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.featuredRow}>
            {events.map((ev) => {
              const tenant = tenantById.get(ev.tenant_id);
              const perPerson = ev.pricing_type === 'per_person';
              const img = ev.image_url || (tenant ? coverFor(tenant) : null);
              return (
                <TouchableOpacity
                  key={ev.id}
                  style={styles.eventCard}
                  activeOpacity={0.85}
                  onPress={() => onSelectEvent(ev, tenant?.name ?? '')}
                >
                  <View style={[styles.eventBanner, { backgroundColor: accent }]}>
                    {img ? (
                      <Image source={{ uri: img }} style={styles.fillImage} resizeMode="cover" />
                    ) : (
                      <Ionicons name="sparkles-outline" size={26} color="rgba(255,255,255,0.85)" />
                    )}
                  </View>
                  <Text style={styles.eventName} numberOfLines={1}>{ev.name}</Text>
                  {tenant?.name ? <Text style={styles.cardMeta} numberOfLines={1}>{tenant.name}</Text> : null}
                  <View style={styles.eventFooter}>
                    <Text style={styles.eventPrice}>
                      {formatPrice(Number(ev.price))}
                      {perPerson ? ' / guest' : ''}
                    </Text>
                    <View style={[styles.reservePill, { borderColor: accent }]}>
                      <Text style={[styles.reservePillText, { color: accent }]}>Reserve</Text>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {/* ── Editorial sections by category (large photo cards) ─ */}
      {sections.map(([title, tenants]) => (
        <View key={title} style={styles.section}>
          <Text style={styles.eyebrow}>{title.toUpperCase()}</Text>
          <View style={{ gap: 16 }}>
            {tenants.map((t) => {
              const img = coverFor(t);
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[styles.photoCard, { backgroundColor: accent }]}
                  activeOpacity={0.88}
                  onPress={() => onSelectBusiness(t)}
                >
                  {img ? (
                    <Image source={{ uri: img }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  ) : (
                    <View style={styles.photoCardMonogram}>
                      <Monogram name={t.name} color="rgba(255,255,255,0.18)" size={72} />
                    </View>
                  )}
                  <View style={styles.photoCardScrim} />
                  <View style={styles.photoCardContent}>
                    {t.subcategory ? <Text style={styles.photoCardMeta}>{t.subcategory.toUpperCase()}</Text> : null}
                    <Text style={styles.photoCardName} numberOfLines={1}>{t.name}</Text>
                    {t.description ? (
                      <Text style={styles.photoCardDesc} numberOfLines={1}>{t.description}</Text>
                    ) : null}
                    <Rating avg={t.avg_rating} count={t.review_count} light />
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ))}

      <View style={{ height: 120 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1, backgroundColor: IVORY },
  scrollContent: { paddingBottom: 24 },

  hero: { minHeight: 300, justifyContent: 'flex-end', overflow: 'hidden' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  heroContent: { paddingHorizontal: 28, paddingTop: 56, paddingBottom: 36, alignItems: 'center' },
  heroLogo: { width: 72, height: 72, borderRadius: 16, marginBottom: 18 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 20,
    maxWidth: 300,
  },

  section: { paddingHorizontal: 20, marginTop: 28 },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 2.5,
    fontWeight: '700',
    color: INK,
    marginBottom: 14,
  },

  // Featured
  featuredRow: { gap: 14, paddingRight: 20 },
  featuredCard: { width: SCREEN_W * 0.62, maxWidth: 260 },
  featuredImage: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  featuredName: { fontSize: 16, fontWeight: '700', color: INK },

  // Events (horizontal carousel cards)
  eventCard: { width: SCREEN_W * 0.7, maxWidth: 300 },
  eventBanner: {
    width: '100%',
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  eventName: { fontSize: 16, fontWeight: '700', color: INK },
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  eventPrice: { fontSize: 14, fontWeight: '700', color: INK },
  reservePill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  reservePillText: { fontSize: 13, fontWeight: '700' },

  // Large editorial photo cards
  photoCard: {
    height: 200,
    borderRadius: 18,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  photoCardMonogram: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  photoCardScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  photoCardContent: { padding: 18 },
  photoCardMeta: { color: 'rgba(255,255,255,0.85)', fontSize: 11, letterSpacing: 1.8, fontWeight: '700', marginBottom: 6 },
  photoCardName: { color: '#fff', fontSize: 22, fontWeight: '700', letterSpacing: 0.3 },
  photoCardDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 13, marginTop: 4 },

  // Shared
  fillImage: { width: '100%', height: '100%' },
  cardMeta: { fontSize: 12, color: MUTED, marginTop: 3, letterSpacing: 0.3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ratingText: { fontSize: 12, fontWeight: '600' },
  monogram: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monogramText: { color: '#fff', fontWeight: '700' },
});
