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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatPrice } from '@/lib/currency';
import type { BookingService } from './PropertyBookingFlow';

const IVORY = '#F8F6F2';
const INK = '#171513';
const MUTED = '#8A837A';
const HAIRLINE = '#ECE7DE';
const OPEN_GREEN = '#1E9E63';
const DISPLAY = Platform.select({ ios: 'Optima', default: undefined });

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

function to12h(t: string): string {
  const [hStr, mStr] = t.split(':');
  let h = parseInt(hStr ?? '0', 10);
  const mer = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${mStr ?? '00'} ${mer}`;
}

/** Today's open window + open-now flag derived from any service timesheet. */
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

export default function PropertyBusinessPage({ visible, apiBase, accent, business, onClose, onBook }: Props) {
  const [services, setServices] = useState<BookingService[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const servicesY = useRef(0);

  useEffect(() => {
    if (!visible || !business) return;
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
  const hours = deriveHours(services);
  const bookableCount = services.length;

  const priceLabel = (s: BookingService) =>
    s.hide_price ? '' : `${formatPrice(Number(s.price))}${s.pricing_type === 'per_person' ? ' / guest' : ''}`;

  const onBookPress = () => {
    if (bookableCount === 1) onBook(services[0]!);
    else scrollRef.current?.scrollTo({ y: servicesY.current, animated: true });
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header — name, status, close (above the image, maps-sheet style) */}
        <View style={styles.handle} />
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={2}>{business?.name}</Text>
            <View style={styles.metaRow}>
              {hours.label ? (
                <>
                  <View style={[styles.dot, { backgroundColor: hours.open ? OPEN_GREEN : '#C0392B' }]} />
                  <Text style={[styles.metaStrong, { color: hours.open ? OPEN_GREEN : '#C0392B' }]}>{hours.open ? 'Open' : 'Closed'}</Text>
                  <Text style={styles.metaDim}>· {hours.label}</Text>
                </>
              ) : business?.subcategory ? (
                <Text style={styles.metaDim}>{business.subcategory}</Text>
              ) : null}
            </View>
            {business?.avg_rating && business.avg_rating > 0 ? (
              <View style={styles.ratingRow}>
                <Ionicons name="star" size={13} color={INK} />
                <Text style={styles.ratingText}>{business.avg_rating.toFixed(1)}{business.review_count ? ` · ${business.review_count} reviews` : ''}</Text>
              </View>
            ) : null}
          </View>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} hitSlop={10}>
            <Ionicons name="close" size={22} color={INK} />
          </TouchableOpacity>
        </View>

        <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
          {/* Cover image */}
          <View style={[styles.cover, { backgroundColor: accent }]}>
            {cover ? <Image source={{ uri: cover }} style={styles.fill} resizeMode="cover" /> : null}
          </View>

          {business?.description ? <Text style={styles.description}>{business.description}</Text> : null}

          {loading ? (
            <ActivityIndicator color={accent} style={{ marginTop: 40 }} />
          ) : (
            <View onLayout={(e) => { servicesY.current = e.nativeEvent.layout.y; }}>
              {experiences.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>EXPERIENCES.</Text>
                  {experiences.map((s) => (
                    <TouchableOpacity key={s.id} style={styles.expCard} activeOpacity={0.9} onPress={() => onBook(s)}>
                      <View style={[styles.expImage, { backgroundColor: accent }]}>
                        {s.image_url ? <Image source={{ uri: s.image_url }} style={styles.fill} resizeMode="cover" />
                                     : <Ionicons name="sparkles-outline" size={24} color="rgba(255,255,255,0.85)" />}
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

              {bookables.length > 0 && (
                <>
                  <Text style={styles.sectionTitle}>{experiences.length > 0 ? 'SERVICES.' : 'BOOK.'}</Text>
                  {bookables.map((s) => (
                    <TouchableOpacity key={s.id} style={styles.row} activeOpacity={0.85} onPress={() => onBook(s)}>
                      {s.image_url ? <Image source={{ uri: s.image_url }} style={styles.rowThumb} />
                                   : <View style={[styles.rowThumb, { backgroundColor: accent }]} />}
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

              {!loading && services.length === 0 && <Text style={styles.empty}>No bookable services right now.</Text>}
            </View>
          )}
        </ScrollView>

        {/* Floating Book button — consistent with the concierge pill */}
        {bookableCount > 0 ? (
          <TouchableOpacity style={[styles.fab, { backgroundColor: accent }]} activeOpacity={0.9} onPress={onBookPress}>
            <Ionicons name="calendar-outline" size={18} color="#fff" />
            <Text style={styles.fabText}>Book</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  handle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D8D2C8', marginTop: 8, marginBottom: 6 },

  header: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 22, paddingTop: 6, paddingBottom: 16 },
  title: { fontSize: 30, fontWeight: '800', color: INK, fontFamily: DISPLAY, letterSpacing: 0.2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  metaStrong: { fontSize: 14, fontWeight: '700' },
  metaDim: { fontSize: 14, color: MUTED },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  ratingText: { fontSize: 13, fontWeight: '600', color: INK },
  closeBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#fff', borderWidth: 1, borderColor: HAIRLINE, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  dot: { width: 8, height: 8, borderRadius: 4 },

  cover: { width: '100%', height: 240, overflow: 'hidden' },
  description: { fontSize: 15, color: '#4A453E', lineHeight: 23, paddingHorizontal: 22, paddingTop: 22 },

  sectionTitle: { fontSize: 20, fontWeight: '800', color: INK, letterSpacing: -0.3, marginTop: 30, marginBottom: 16, paddingHorizontal: 22 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: '#fff',
    borderRadius: 16, padding: 14, marginHorizontal: 22, marginBottom: 12,
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 1,
  },
  rowThumb: { width: 54, height: 54, borderRadius: 12 },
  rowName: { fontSize: 16, fontWeight: '700', color: INK },
  rowMeta: { fontSize: 13, color: MUTED, marginTop: 3 },
  rowDesc: { fontSize: 13, color: MUTED, marginTop: 5, lineHeight: 19 },

  expCard: { backgroundColor: '#fff', borderRadius: 20, overflow: 'hidden', marginHorizontal: 22, marginBottom: 16, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 2 },
  expImage: { height: 160, alignItems: 'center', justifyContent: 'center' },
  expBody: { padding: 18 },
  expFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 14 },
  price: { fontSize: 16, fontWeight: '700', color: INK },
  pill: { borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 7 },
  pillText: { fontSize: 13, fontWeight: '700' },

  fab: {
    position: 'absolute', bottom: 28, alignSelf: 'center',
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 26, paddingVertical: 15, borderRadius: 999,
    shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7,
  },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },

  fill: { width: '100%', height: '100%' },
  empty: { fontSize: 14, color: MUTED, marginTop: 28, textAlign: 'center' },
});
