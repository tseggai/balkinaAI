import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  Image,
  SafeAreaView,
  Linking,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const IVORY = '#F8F6F2';
const INK = '#171513';
const MUTED = '#8A837A';
const HAIRLINE = '#ECE7DE';
const DISPLAY = Platform.select({ ios: 'Avenir Next', default: undefined });

export interface Campaign {
  id: string;
  title: string;
  blurb: string | null;
  description: string | null;
  image_url: string | null;
  campaign_type: string;
  starts_at: string | null;
  ends_at: string | null;
  location: string | null;
  is_property_only: boolean;
  cta_label: string | null;
  cta_url: string | null;
  tenant_ids: string[];
}

const TYPE_LABEL: Record<string, string> = {
  promotion: 'Promotion', event: 'Event', contest: 'Contest', other: 'Happening',
};

function dateRange(start: string | null, end: string | null): string | null {
  if (!start && !end) return null;
  const fmt = (s: string) => new Date(s).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  if (start && end) {
    const sameDay = new Date(start).toDateString() === new Date(end).toDateString();
    return sameDay ? fmt(start) : `${fmt(start)} – ${fmt(end)}`;
  }
  return fmt((start || end)!);
}

interface Props {
  visible: boolean;
  accent: string;
  campaign: Campaign | null;
  partnerNames: string[];
  onClose: () => void;
}

export default function PropertyCampaignDetail({ visible, accent, campaign, partnerNames, onClose }: Props) {
  if (!campaign) return null;
  const range = dateRange(campaign.starts_at, campaign.ends_at);
  const time = campaign.starts_at ? new Date(campaign.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: campaign.cta_url ? 110 : 40 }}>
          <View style={[styles.hero, { backgroundColor: accent }]}>
            {campaign.image_url ? <Image source={{ uri: campaign.image_url }} style={StyleSheet.absoluteFill} resizeMode="cover" /> : null}
            <View style={styles.heroScrim} />
            <View style={styles.heroContent}>
              <View style={styles.typeChip}><Text style={styles.typeChipText}>{(TYPE_LABEL[campaign.campaign_type] ?? 'Happening').toUpperCase()}</Text></View>
              <Text style={styles.heroTitle}>{campaign.title}</Text>
              {campaign.blurb ? <Text style={styles.heroBlurb}>{campaign.blurb}</Text> : null}
            </View>
          </View>

          <View style={styles.body}>
            <View style={styles.infoCard}>
              {range ? (
                <View style={styles.infoRow}>
                  <Ionicons name="calendar-outline" size={18} color={MUTED} />
                  <Text style={styles.infoText}>{range}{time ? ` · ${time}` : ''}</Text>
                </View>
              ) : null}
              {campaign.location ? (
                <View style={styles.infoRow}>
                  <Ionicons name="location-outline" size={18} color={MUTED} />
                  <Text style={styles.infoText}>{campaign.location}</Text>
                </View>
              ) : null}
              <View style={styles.infoRow}>
                <Ionicons name="business-outline" size={18} color={MUTED} />
                <Text style={styles.infoText}>{campaign.is_property_only ? 'Hosted by the property' : `With ${partnerNames.length} participating business${partnerNames.length === 1 ? '' : 'es'}`}</Text>
              </View>
            </View>

            {campaign.description ? <Text style={styles.description}>{campaign.description}</Text> : null}

            {!campaign.is_property_only && partnerNames.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>PARTICIPATING</Text>
                <View style={styles.partnerWrap}>
                  {partnerNames.map((n) => (
                    <View key={n} style={styles.partnerChip}><Text style={styles.partnerChipText}>{n}</Text></View>
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>

        <SafeAreaView style={styles.backBar} pointerEvents="box-none">
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={10}>
            <Ionicons name="arrow-back" size={22} color={INK} />
          </TouchableOpacity>
        </SafeAreaView>

        {campaign.cta_url ? (
          <TouchableOpacity style={[styles.fab, { backgroundColor: accent }]} activeOpacity={0.9} onPress={() => Linking.openURL(campaign.cta_url!)}>
            <Text style={styles.fabText}>{campaign.cta_label || 'Learn more'}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: IVORY },
  hero: { width: '100%', height: 320, justifyContent: 'flex-end', overflow: 'hidden' },
  heroScrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.42)' },
  heroContent: { padding: 24, paddingBottom: 28 },
  typeChip: { alignSelf: 'flex-start', backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, marginBottom: 12 },
  typeChipText: { fontSize: 11, fontWeight: '800', letterSpacing: 1, color: INK },
  heroTitle: { color: '#fff', fontSize: 32, fontWeight: '600', fontFamily: DISPLAY, letterSpacing: 0.3 },
  heroBlurb: { color: 'rgba(255,255,255,0.92)', fontSize: 15, marginTop: 8, lineHeight: 21 },

  backBar: { position: 'absolute', top: 0, left: 0 },
  backBtn: { margin: 12, width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },

  body: { padding: 22 },
  infoCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: HAIRLINE, padding: 16, gap: 14 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoText: { fontSize: 14, color: INK, flex: 1 },
  description: { fontSize: 15, color: '#4A453E', lineHeight: 24, marginTop: 20 },

  sectionTitle: { fontSize: 11, letterSpacing: 1.6, fontWeight: '700', color: MUTED, marginTop: 26, marginBottom: 12 },
  partnerWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  partnerChip: { backgroundColor: '#fff', borderWidth: 1, borderColor: HAIRLINE, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 },
  partnerChipText: { fontSize: 13, fontWeight: '600', color: INK },

  fab: { position: 'absolute', bottom: 30, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 30, paddingVertical: 16, borderRadius: 999, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  fabText: { color: '#fff', fontSize: 16, fontWeight: '700', letterSpacing: 0.3 },
});
