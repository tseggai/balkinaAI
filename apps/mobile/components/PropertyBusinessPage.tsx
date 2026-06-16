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
  SafeAreaView,
  Animated,
  Easing,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/currency';
import type { BookingService } from './PropertyBookingFlow';

const { height: SCREEN_H } = Dimensions.get('window');
const IVORY = '#F7F4EF';
const INK = '#1A1A1A';
const MUTED = '#6B655C';
const HAIRLINE = '#E4DED4';

export interface BusinessSummary {
  id: string;
  name: string;
  cover_image_url: string | null;
  logo_url: string | null;
  subcategory: string | null;
  description: string | null;
  avg_rating: number | null;
  review_count: number | null;
}

interface Props {
  visible: boolean;
  apiBase: string;
  accent: string;
  business: BusinessSummary | null;
  onClose: () => void;
  onBook: (service: BookingService) => void;
}

export default function PropertyBusinessPage({ visible, apiBase, accent, business, onClose, onBook }: Props) {
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const servicesY = useRef(0);

  useEffect(() => {
    if (!visible || !business) return;
    // Splash entrance: hero fills the screen, then eases down to a header
    // while the body content fades in.
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: 650,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();

    let cancelled = false;
    (async () => {
      setLoading(true);
      setServices([]);
      try {
        const res = await fetch(`${apiBase}/api/booking/services?tenantId=${business.id}`);
        const data = (await res.json()) as { services?: BookingService[] };
        if (!cancelled) setServices(data.services ?? []);
      } catch {
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, business?.id]);

  const experiences = services.filter((s) => s.service_type === 'event');
  const bookables = services.filter((s) => s.service_type !== 'event');
  const cover = business?.cover_image_url || business?.logo_url || null;

  const heroHeight = anim.interpolate({ inputRange: [0, 1], outputRange: [SCREEN_H, 300] });
  const heroScale = anim.interpolate({ inputRange: [0, 1], outputRange: [1.15, 1] });
  const bodyOpacity = anim.interpolate({ inputRange: [0, 0.55, 1], outputRange: [0, 0, 1] });

  const priceLabel = (s: BookingService) =>
    s.hide_price ? '' : `${formatPrice(Number(s.price))}${s.pricing_type === 'per_person' ? ' / guest' : ''}`;

  return (
    <Modal visible={visible} animationType="fade" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Animated hero */}
        <Animated.View style={[styles.hero, { height: heroHeight, backgroundColor: accent }]}>
          {cover ? (
            <Animated.Image source={{ uri: cover }} style={[StyleSheet.absoluteFill, { transform: [{ scale: heroScale }] }]} resizeMode="cover" />
          ) : null}
          <View style={styles.heroScrim} />
          <SafeAreaView style={styles.heroBar}>
            <TouchableOpacity onPress={onClose} style={styles.heroBtn} hitSlop={10}>
              <Ionicons name="arrow-back" size={22} color="#fff" />
            </TouchableOpacity>
          </SafeAreaView>
          <View style={styles.heroContent}>
            {business?.subcategory ? <Text style={styles.heroEyebrow}>{business.subcategory.toUpperCase()}</Text> : null}
            <Text style={styles.heroTitle} numberOfLines={2}>{business?.name}</Text>
            {business?.avg_rating && business.avg_rating > 0 ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color="#fff" />
                <Text style={styles.ratingText}>
                  {business.avg_rating.toFixed(1)}{business.review_count ? ` · ${business.review_count} reviews` : ''}
                </Text>
              </View>
            ) : null}
          </View>
        </Animated.View>

        {/* Body */}
        <Animated.View style={[styles.body, { opacity: bodyOpacity }]}>
          <ScrollView ref={scrollRef} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
            {business?.description ? (
              <Text style={styles.description}>{business.description}</Text>
            ) : null}

            <TouchableOpacity
              style={[styles.cta, { backgroundColor: accent }]}
              activeOpacity={0.9}
              onPress={() => scrollRef.current?.scrollTo({ y: servicesY.current, animated: true })}
            >
              <Text style={styles.ctaText}>Book now</Text>
              <Ionicons name="arrow-down" size={18} color="#fff" />
            </TouchableOpacity>

            {loading ? (
              <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
            ) : (
              <View onLayout={(e) => { servicesY.current = e.nativeEvent.layout.y; }}>
                {/* Experiences */}
                {experiences.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>Experiences</Text>
                    {experiences.map((s) => (
                      <TouchableOpacity key={s.id} style={styles.expCard} activeOpacity={0.85} onPress={() => onBook(s)}>
                        <View style={[styles.expThumb, { backgroundColor: accent }]}>
                          {s.image_url ? (
                            <Image source={{ uri: s.image_url }} style={styles.fill} resizeMode="cover" />
                          ) : (
                            <Ionicons name="sparkles-outline" size={24} color="rgba(255,255,255,0.85)" />
                          )}
                        </View>
                        <View style={styles.expBody}>
                          <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
                          {s.description ? <Text style={styles.rowDesc} numberOfLines={2}>{s.description}</Text> : null}
                          <View style={styles.expFooter}>
                            {priceLabel(s) ? <Text style={styles.price}>{priceLabel(s)}</Text> : <View />}
                            <View style={[styles.pill, { borderColor: accent }]}>
                              <Text style={[styles.pillText, { color: accent }]}>Reserve</Text>
                            </View>
                          </View>
                        </View>
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {/* Services */}
                {bookables.length > 0 && (
                  <>
                    <Text style={styles.sectionTitle}>{experiences.length > 0 ? 'Services' : 'Book'}</Text>
                    {bookables.map((s) => (
                      <TouchableOpacity key={s.id} style={styles.row} activeOpacity={0.85} onPress={() => onBook(s)}>
                        {s.image_url ? (
                          <Image source={{ uri: s.image_url }} style={styles.rowThumb} />
                        ) : (
                          <View style={[styles.rowThumb, { backgroundColor: accent }]} />
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
                          <Text style={styles.rowMeta}>
                            {s.service_type === 'table' ? 'Reservation' : `${s.duration_minutes} min`}
                            {priceLabel(s) ? ` · ${priceLabel(s)}` : ''}
                          </Text>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color={MUTED} />
                      </TouchableOpacity>
                    ))}
                  </>
                )}

                {!loading && services.length === 0 && (
                  <Text style={styles.empty}>No bookable services right now.</Text>
                )}
              </View>
            )}
            <View style={{ height: 60 }} />
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  hero: { width: '100%', overflow: 'hidden', justifyContent: 'flex-end' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.34)' },
  heroBar: { position: 'absolute', top: 0, left: 0, right: 0 },
  heroBtn: {
    margin: 12, width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center',
  },
  heroContent: { padding: 24, paddingBottom: 28 },
  heroEyebrow: { color: 'rgba(255,255,255,0.85)', fontSize: 11, letterSpacing: 2.4, fontWeight: '700', marginBottom: 8 },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '700', letterSpacing: 0.3 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 10 },
  ratingText: { color: '#fff', fontSize: 13, fontWeight: '600' },

  body: { flex: 1 },
  scrollContent: { padding: 20 },
  description: { fontSize: 15, color: MUTED, lineHeight: 22, marginBottom: 18 },

  cta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 15 },
  ctaText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  sectionTitle: { fontSize: 13, letterSpacing: 2, fontWeight: '700', color: INK, marginTop: 28, marginBottom: 14, textTransform: 'uppercase' },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff',
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: HAIRLINE, marginBottom: 12,
  },
  rowThumb: { width: 52, height: 52, borderRadius: 10 },
  rowName: { fontSize: 16, fontWeight: '700', color: INK },
  rowMeta: { fontSize: 13, color: MUTED, marginTop: 3 },
  rowDesc: { fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 18 },

  expCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: HAIRLINE, overflow: 'hidden', marginBottom: 14 },
  expThumb: { height: 150, alignItems: 'center', justifyContent: 'center' },
  expBody: { padding: 16 },
  expFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },
  price: { fontSize: 15, fontWeight: '700', color: INK },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 6 },
  pillText: { fontSize: 13, fontWeight: '700' },

  fill: { width: '100%', height: '100%' },
  empty: { fontSize: 14, color: MUTED, marginTop: 28, textAlign: 'center' },
});
