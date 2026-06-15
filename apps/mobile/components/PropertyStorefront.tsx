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

/** A small two-letter monogram used when a business/property has no logo. */
function Monogram({ name, color, size }: { name: string; color: string; size: number }) {
  return (
    <View style={[styles.monogram, { width: size, height: size, backgroundColor: color }]}>
      <Text style={[styles.monogramText, { fontSize: size * 0.36 }]}>
        {name.trim().charAt(0).toUpperCase()}
      </Text>
    </View>
  );
}

function Rating({ avg, count }: { avg: number | null; count: number | null }) {
  if (!avg || avg <= 0) return null;
  return (
    <View style={styles.ratingRow}>
      <Ionicons name="star" size={11} color={INK} />
      <Text style={styles.ratingText}>
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
        if (!cancelled) setEvents(data.services ?? []);
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
      {/* ── Hero ───────────────────────────────────────────── */}
      <View style={[styles.hero, { backgroundColor: accent }]}>
        {property.logo_url ? (
          <Image source={{ uri: property.logo_url }} style={styles.heroLogo} />
        ) : (
          <Monogram name={property.name} color="rgba(255,255,255,0.18)" size={72} />
        )}
        <Text style={styles.heroEyebrow}>WELCOME TO</Text>
        <Text style={styles.heroTitle}>{property.name}</Text>
        <Text style={styles.heroSubtitle}>{property.welcome_message}</Text>
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
            {featured.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.featuredCard}
                activeOpacity={0.85}
                onPress={() => onSelectBusiness(t)}
              >
                <View style={[styles.featuredImage, { backgroundColor: accent }]}>
                  {t.logo_url ? (
                    <Image source={{ uri: t.logo_url }} style={styles.featuredImageInner} />
                  ) : (
                    <Monogram name={t.name} color="rgba(255,255,255,0.2)" size={64} />
                  )}
                </View>
                <Text style={styles.featuredName} numberOfLines={1}>{t.name}</Text>
                {t.subcategory ? <Text style={styles.cardMeta} numberOfLines={1}>{t.subcategory}</Text> : null}
                <Rating avg={t.avg_rating} count={t.review_count} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* ── Experiences / Events ───────────────────────────── */}
      {eventsLoading ? (
        <ActivityIndicator size="small" color={accent} style={{ marginVertical: 24 }} />
      ) : events.length > 0 ? (
        <View style={styles.section}>
          <Text style={styles.eyebrow}>EXPERIENCES</Text>
          <View style={{ gap: 14 }}>
            {events.map((ev) => {
              const tenant = tenantById.get(ev.tenant_id);
              const perPerson = ev.pricing_type === 'per_person';
              return (
                <TouchableOpacity
                  key={ev.id}
                  style={styles.eventCard}
                  activeOpacity={0.85}
                  onPress={() => onSelectEvent(ev, tenant?.name ?? '')}
                >
                  <View style={[styles.eventBanner, { backgroundColor: accent }]}>
                    {ev.image_url ? (
                      <Image source={{ uri: ev.image_url }} style={styles.eventBannerImg} />
                    ) : (
                      <Ionicons name="sparkles-outline" size={26} color="rgba(255,255,255,0.85)" />
                    )}
                  </View>
                  <View style={styles.eventBody}>
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
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      ) : null}

      {/* ── Editorial sections by category ─────────────────── */}
      {sections.map(([title, tenants]) => (
        <View key={title} style={styles.section}>
          <Text style={styles.eyebrow}>{title.toUpperCase()}</Text>
          <View style={{ gap: 12 }}>
            {tenants.map((t) => (
              <TouchableOpacity
                key={t.id}
                style={styles.listCard}
                activeOpacity={0.85}
                onPress={() => onSelectBusiness(t)}
              >
                {t.logo_url ? (
                  <Image source={{ uri: t.logo_url }} style={styles.listThumb} />
                ) : (
                  <Monogram name={t.name} color={accent} size={56} />
                )}
                <View style={styles.listBody}>
                  <Text style={styles.listName} numberOfLines={1}>{t.name}</Text>
                  {t.description ? (
                    <Text style={styles.listDesc} numberOfLines={2}>{t.description}</Text>
                  ) : null}
                  <Rating avg={t.avg_rating} count={t.review_count} />
                </View>
                <Ionicons name="arrow-forward" size={16} color={MUTED} />
              </TouchableOpacity>
            ))}
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

  hero: {
    paddingTop: 48,
    paddingBottom: 40,
    paddingHorizontal: 28,
    alignItems: 'center',
  },
  heroLogo: { width: 76, height: 76, borderRadius: 16, marginBottom: 18 },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 11,
    letterSpacing: 3,
    fontWeight: '600',
    marginBottom: 8,
  },
  heroTitle: {
    color: '#fff',
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.82)',
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
  featuredImageInner: { width: '100%', height: '100%' },
  featuredName: { fontSize: 16, fontWeight: '700', color: INK },

  // Events
  eventCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  eventBanner: { width: 92, alignItems: 'center', justifyContent: 'center' },
  eventBannerImg: { width: '100%', height: '100%' },
  eventBody: { flex: 1, padding: 14 },
  eventName: { fontSize: 16, fontWeight: '700', color: INK },
  eventFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  eventPrice: { fontSize: 14, fontWeight: '700', color: INK },
  reservePill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  reservePillText: { fontSize: 13, fontWeight: '700' },

  // List
  listCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    borderWidth: 1,
    borderColor: HAIRLINE,
  },
  listThumb: { width: 56, height: 56, borderRadius: 12 },
  listBody: { flex: 1 },
  listName: { fontSize: 16, fontWeight: '700', color: INK },
  listDesc: { fontSize: 13, color: MUTED, marginTop: 3, lineHeight: 18 },

  // Shared
  cardMeta: { fontSize: 12, color: MUTED, marginTop: 3, letterSpacing: 0.3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  ratingText: { fontSize: 12, color: INK, fontWeight: '600' },
  monogram: { borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  monogramText: { color: '#fff', fontWeight: '700' },
});
