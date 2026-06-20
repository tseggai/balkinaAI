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
import type { Campaign } from './PropertyCampaignDetail';

const IVORY = '#F8F6F2';
const INK = '#171513';
const MUTED = '#8A837A';
const HAIRLINE = '#ECE7DE';
const DISPLAY = Platform.select({ ios: 'Avenir Next', default: undefined });

const TYPE_LABEL: Record<string, string> = { promotion: 'Promotion', event: 'Event', contest: 'Contest', other: 'Happening' };

interface Props {
  visible: boolean;
  accent: string;
  campaigns: Campaign[];
  heroImage?: string | null;
  onSelect: (c: Campaign) => void;
  onClose: () => void;
}

interface DayGroup {
  key: string;
  label: string;
  sublabel: string;
  items: Campaign[];
}

function startOfDay(d: Date): number {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
}

/** Group campaigns into day sections (dated events first, then ongoing). */
function groupByDay(campaigns: Campaign[]): { dated: DayGroup[]; ongoing: Campaign[] } {
  const todayStart = startOfDay(new Date());
  const map = new Map<number, Campaign[]>();
  const ongoing: Campaign[] = [];

  for (const c of campaigns) {
    if (!c.starts_at) { ongoing.push(c); continue; }
    const start = new Date(c.starts_at);
    const day = startOfDay(start);
    // Skip days fully in the past (the event's end, if any, also passed).
    const endDay = c.ends_at ? startOfDay(new Date(c.ends_at)) : day;
    if (endDay < todayStart) { ongoing.push(c); continue; }
    const showDay = Math.max(day, todayStart);
    const arr = map.get(showDay) ?? [];
    arr.push(c);
    map.set(showDay, arr);
  }

  const dated: DayGroup[] = Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([ts, items]) => {
      const d = new Date(ts);
      const isToday = ts === todayStart;
      const isTomorrow = ts === todayStart + 86400000;
      const weekday = d.toLocaleDateString('en-US', { weekday: 'long' });
      const rest = d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
      return {
        key: String(ts),
        label: isToday ? 'Today' : isTomorrow ? 'Tomorrow' : weekday,
        sublabel: rest,
        items: items.sort((a, b) => new Date(a.starts_at!).getTime() - new Date(b.starts_at!).getTime()),
      };
    });

  return { dated, ongoing };
}

function timeOf(c: Campaign): string | null {
  if (!c.starts_at) return null;
  return new Date(c.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function PropertyEventsCalendar({ visible, accent, campaigns, heroImage, onSelect, onClose }: Props) {
  const { dated, ongoing } = useMemo(() => groupByDay(campaigns), [campaigns]);
  const [filter, setFilter] = useState<string>('all'); // 'all' | day key
  const isEmpty = dated.length === 0 && ongoing.length === 0;

  // Date filter pills: All + each upcoming day. Selecting one narrows the list.
  const pills = useMemo(() => [{ key: 'all', label: 'All' }, ...dated.map((g) => ({
    key: g.key,
    label: g.label === 'Today' || g.label === 'Tomorrow' ? g.label : g.sublabel,
  }))], [dated]);
  const shownDated = filter === 'all' ? dated : dated.filter((g) => g.key === filter);
  const shownOngoing = filter === 'all' ? ongoing : [];

  const Card = ({ c }: { c: Campaign }) => {
    const time = timeOf(c);
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.9} onPress={() => onSelect(c)}>
        <View style={styles.cardImageWrap}>
          {c.image_url ? <Image source={{ uri: c.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : <View style={[StyleSheet.absoluteFill, { backgroundColor: accent }]} />}
        </View>
        <View style={styles.cardBody}>
          <View style={[styles.typeTag, { backgroundColor: `${accent}1A` }]}>
            <Text style={[styles.typeTagText, { color: accent }]}>{(TYPE_LABEL[c.campaign_type] ?? 'Happening').toUpperCase()}</Text>
          </View>
          <Text style={styles.cardTitle} numberOfLines={2}>{c.title}</Text>
          {c.blurb ? <Text style={styles.cardBlurb} numberOfLines={2}>{c.blurb}</Text> : null}
          <View style={styles.cardMetaRow}>
            {time ? (
              <View style={styles.metaItem}><Ionicons name="time-outline" size={13} color={MUTED} /><Text style={styles.metaText}>{time}</Text></View>
            ) : null}
            {c.location ? (
              <View style={styles.metaItem}><Ionicons name="location-outline" size={13} color={MUTED} /><Text style={styles.metaText} numberOfLines={1}>{c.location}</Text></View>
            ) : null}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Hero header */}
        <View style={[styles.hero, { backgroundColor: accent }]}>
          {heroImage ? <Image source={{ uri: heroImage }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={8} /> : null}
          <View style={styles.heroScrim} />
          <SafeAreaView>
            <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={10}><Ionicons name="arrow-back" size={22} color="#fff" /></TouchableOpacity>
          </SafeAreaView>
          <Text style={styles.heroTitle}>EVENTS CALENDAR</Text>
          <Text style={styles.heroSub}>Everything happening at the property</Text>
        </View>

        {/* Date filter */}
        {dated.length > 0 ? (
          <View style={styles.filterBar}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
              {pills.map((p) => {
                const on = filter === p.key;
                return (
                  <TouchableOpacity
                    key={p.key}
                    onPress={() => setFilter(p.key)}
                    activeOpacity={0.8}
                    style={[styles.pill, on ? { backgroundColor: accent, borderColor: accent } : null]}
                  >
                    <Text style={[styles.pillText, on ? { color: '#fff' } : null]}>{p.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        ) : null}

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {isEmpty ? (
            <View style={styles.empty}>
              <Ionicons name="calendar-outline" size={48} color={HAIRLINE} />
              <Text style={styles.emptyTitle}>Nothing scheduled yet</Text>
              <Text style={styles.emptySub}>Check back soon for events and happenings.</Text>
            </View>
          ) : (
            <View style={styles.body}>
              {shownDated.map((g) => (
                <View key={g.key} style={styles.daySection}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>{g.label}</Text>
                    <Text style={styles.daySub}>{g.sublabel}</Text>
                  </View>
                  {g.items.map((c) => <Card key={c.id} c={c} />)}
                </View>
              ))}

              {shownOngoing.length > 0 ? (
                <View style={styles.daySection}>
                  <View style={styles.dayHeader}>
                    <Text style={styles.dayLabel}>Ongoing</Text>
                    <Text style={styles.daySub}>Available anytime</Text>
                  </View>
                  {shownOngoing.map((c) => <Card key={c.id} c={c} />)}
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  hero: { paddingBottom: 26, overflow: 'hidden' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  backBtn: { margin: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.25)', alignItems: 'center', justifyContent: 'center' },
  heroTitle: { color: '#fff', fontSize: 34, fontWeight: '700', fontFamily: DISPLAY, letterSpacing: 2, textAlign: 'center', marginTop: 6 },
  heroSub: { color: 'rgba(255,255,255,0.9)', fontSize: 14, textAlign: 'center', marginTop: 6 },

  filterBar: { borderBottomWidth: 1, borderBottomColor: HAIRLINE, backgroundColor: IVORY },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 12 },
  pill: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: HAIRLINE, backgroundColor: '#fff' },
  pillText: { fontSize: 13, fontWeight: '600', color: INK },

  body: { padding: 20 },
  daySection: { marginBottom: 26 },
  dayHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 12 },
  dayLabel: { fontSize: 19, fontWeight: '700', color: INK, fontFamily: DISPLAY },
  daySub: { fontSize: 14, color: MUTED },

  card: { flexDirection: 'row', backgroundColor: '#fff', borderRadius: 18, borderWidth: 1, borderColor: HAIRLINE, overflow: 'hidden', marginBottom: 12 },
  cardImageWrap: { width: 110, alignSelf: 'stretch', backgroundColor: HAIRLINE, overflow: 'hidden' },
  cardBody: { flex: 1, padding: 14 },
  typeTag: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, marginBottom: 8 },
  typeTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: INK, lineHeight: 21 },
  cardBlurb: { fontSize: 13, color: MUTED, marginTop: 4, lineHeight: 18 },
  cardMetaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
  metaText: { fontSize: 12, color: MUTED },

  empty: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 40, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: INK, marginTop: 10 },
  emptySub: { fontSize: 14, color: MUTED, textAlign: 'center' },
});
