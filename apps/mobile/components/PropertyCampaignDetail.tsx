import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  SafeAreaView,
  Linking,
  Share,
  Animated,
  Dimensions,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';

const { height: SCREEN_H } = Dimensions.get('window');
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
  cta_type: string;
  cta_fields: string[];
  cta_required?: string[];
  cta_plus_one_limit?: number | null;
  audience?: string;
  tenant_ids: string[];
}

const TYPE_LABEL: Record<string, string> = { promotion: 'Promotion', event: 'Event', contest: 'Contest', other: 'Happening' };
const FIELD_LABEL: Record<string, string> = { first_name: 'First name', last_name: 'Last name', email: 'Email', phone: 'Phone', notes: 'Notes' };

function qrFor(entryId: string, i: number): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=460x460&margin=10&data=${entryId}.${i}`;
}

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
  apiBase: string;
  campaign: Campaign | null;
  partnerNames: string[];
  customer: { userId: string | null; name: string | null; phone: string | null; email: string | null };
  onClose: () => void;
}

export default function PropertyCampaignDetail({ visible, accent, apiBase, campaign, partnerNames, customer, onClose }: Props) {
  const [rsvpOpen, setRsvpOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [plusCount, setPlusCount] = useState(0);
  const [plusNames, setPlusNames] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [entryId, setEntryId] = useState<string | null>(null);
  const [submittedGuests, setSubmittedGuests] = useState<{ name: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const kb = useKeyboardHeight();

  const slide = useRef(new Animated.Value(SCREEN_H)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!visible) { setRsvpOpen(false); setSubmitted(false); }
  }, [visible]);

  const openRsvp = () => {
    const first = (customer.name ?? '').split(' ')[0] ?? '';
    const last = (customer.name ?? '').split(' ').slice(1).join(' ');
    setValues({ first_name: first, last_name: last, email: customer.email ?? '', phone: customer.phone ?? '' });
    setPlusCount(0);
    setPlusNames([]);
    setSubmitted(false);
    setEntryId(null);
    setError(null);
    setRsvpOpen(true);
    slide.setValue(SCREEN_H); fade.setValue(0);
    Animated.parallel([
      Animated.timing(slide, { toValue: 0, duration: 280, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 1, duration: 280, useNativeDriver: true }),
    ]).start();
  };
  const closeRsvp = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: SCREEN_H, duration: 200, useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setRsvpOpen(false));
  };

  const submit = async () => {
    if (!campaign) return;
    const required = campaign.cta_required ?? [];
    const missing = required.find((f) => f !== 'plus_ones' && !(values[f] ?? '').trim());
    if (missing) { setError(`${FIELD_LABEL[missing] ?? missing} is required.`); return; }
    // A plus-one always needs a name (so their ticket is identifiable at the door).
    if (campaign.cta_fields.includes('plus_ones') && plusCount > 0) {
      for (let i = 0; i < plusCount; i++) {
        if (!(plusNames[i] ?? '').trim()) { setError(`Please enter a name for guest ${i + 1}.`); return; }
      }
    }
    setError(null);
    setSubmitting(true);
    const data: Record<string, unknown> = {};
    for (const f of campaign.cta_fields) {
      if (f === 'plus_ones') {
        const names = plusNames.slice(0, plusCount).filter(Boolean);
        data.plus_ones = names.length ? `${plusCount} — ${names.join(', ')}` : String(plusCount);
      } else {
        data[f] = values[f] ?? '';
      }
    }
    // Per-guest tickets: index 0 = the RSVPer, then each plus-one. Each guest
    // shares their own QR from the confirmation sheet / My Bookings.
    const primaryName = [values.first_name, values.last_name].filter(Boolean).join(' ').trim() || (customer.name ?? '').trim() || 'Guest';
    const guests: { name: string }[] = [{ name: primaryName }];
    if (campaign.cta_fields.includes('plus_ones')) {
      plusNames.slice(0, plusCount).forEach((n) => guests.push({ name: (n || '').trim() || 'Guest' }));
    }
    data.guests = guests;
    setSubmittedGuests(guests);
    try {
      const res = await fetch(`${apiBase}/api/campaigns/${campaign.id}/rsvp`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data, userId: customer.userId ?? undefined }),
      });
      const json = await res.json().catch(() => ({}));
      if (json.entryId) setEntryId(json.entryId);
      setSubmitted(true);
    } catch { /* ignore */ } finally {
      setSubmitting(false);
    }
  };

  if (!campaign) return null;
  const range = dateRange(campaign.starts_at, campaign.ends_at);
  const time = campaign.starts_at ? new Date(campaign.starts_at).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }) : null;
  const isForm = campaign.cta_type === 'rsvp' || campaign.cta_type === 'signup';
  const ctaLabel = campaign.cta_label || (campaign.cta_type === 'signup' ? 'Sign up' : campaign.cta_type === 'rsvp' ? 'RSVP' : 'Learn more');
  const showCta = isForm || !!campaign.cta_url;
  const fields = campaign.cta_fields.filter((f) => f !== 'plus_ones');
  const hasPlusOnes = campaign.cta_fields.includes('plus_ones');

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.container}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: showCta ? 110 : 40 }}>
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
                <View style={styles.infoRow}><Ionicons name="calendar-outline" size={18} color={MUTED} /><Text style={styles.infoText}>{range}{time ? ` · ${time}` : ''}</Text></View>
              ) : null}
              {campaign.location ? (
                <View style={styles.infoRow}><Ionicons name="location-outline" size={18} color={MUTED} /><Text style={styles.infoText}>{campaign.location}</Text></View>
              ) : null}
              <View style={styles.infoRow}><Ionicons name="business-outline" size={18} color={MUTED} /><Text style={styles.infoText}>{campaign.is_property_only ? 'Hosted by the property' : `With ${partnerNames.length} participating business${partnerNames.length === 1 ? '' : 'es'}`}</Text></View>
            </View>

            {campaign.description ? <Text style={styles.description}>{campaign.description}</Text> : null}

            {!campaign.is_property_only && partnerNames.length > 0 ? (
              <>
                <Text style={styles.sectionTitle}>PARTICIPATING</Text>
                <View style={styles.partnerWrap}>
                  {partnerNames.map((n) => <View key={n} style={styles.partnerChip}><Text style={styles.partnerChipText}>{n}</Text></View>)}
                </View>
              </>
            ) : null}
          </View>
        </ScrollView>

        <SafeAreaView style={styles.backBar} pointerEvents="box-none">
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={10}><Ionicons name="arrow-back" size={22} color={INK} /></TouchableOpacity>
        </SafeAreaView>

        {showCta ? (
          <TouchableOpacity style={[styles.fab, { backgroundColor: accent }]} activeOpacity={0.9}
            onPress={() => (isForm ? openRsvp() : Linking.openURL(campaign.cta_url!))}>
            <Text style={styles.fabText}>{ctaLabel}</Text>
          </TouchableOpacity>
        ) : null}

        {/* RSVP / sign-up form */}
        {rsvpOpen ? (
          <View style={StyleSheet.absoluteFill}>
            <Animated.View style={[styles.sheetBackdrop, { opacity: fade }]}>
              <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={closeRsvp} />
            </Animated.View>
            <Animated.View style={[styles.sheet, { transform: [{ translateY: slide }], bottom: kb }]}>
              <View style={styles.sheetHandle} />
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>{ctaLabel}</Text>
                <TouchableOpacity onPress={closeRsvp} style={styles.sheetClose} hitSlop={10}><Ionicons name="close" size={22} color={INK} /></TouchableOpacity>
              </View>

              {submitted ? (
                <View style={styles.doneWrap}>
                  <View style={[styles.doneIcon, { backgroundColor: accent }]}><Ionicons name="checkmark" size={34} color="#fff" /></View>
                  <Text style={styles.doneTitle}>You&apos;re in!</Text>
                  <Text style={styles.doneSub}>Thanks — {campaign.title} has your entry.</Text>
                  {entryId ? (
                    <View style={{ width: '100%' }}>
                      <View style={styles.qrWrap}>
                        <Image source={{ uri: qrFor(entryId, 0) }} style={styles.qr} />
                        <Text style={styles.qrHint}>Your check-in QR — show at the door</Text>
                        <TouchableOpacity style={[styles.shareBtn, { borderColor: accent }]} onPress={() => Share.share({ url: qrFor(entryId, 0), message: `My ${campaign.title} ticket` })}>
                          <Ionicons name="share-outline" size={16} color={accent} />
                          <Text style={[styles.shareText, { color: accent }]}>Share / Save</Text>
                        </TouchableOpacity>
                      </View>

                      {submittedGuests.length > 1 ? (
                        <>
                          <Text style={styles.sectionTitle}>GUEST TICKETS</Text>
                          {submittedGuests.slice(1).map((g, idx) => {
                            const i = idx + 1;
                            return (
                              <View key={i} style={styles.guestRow}>
                                <Image source={{ uri: qrFor(entryId, i) }} style={styles.guestQr} />
                                <View style={{ flex: 1 }}>
                                  <Text style={styles.guestName} numberOfLines={1}>{g.name}</Text>
                                  <Text style={styles.guestSub}>Their own check-in QR</Text>
                                </View>
                                <TouchableOpacity onPress={() => Share.share({ url: qrFor(entryId, i), message: `Your ${campaign.title} ticket` })} hitSlop={8}>
                                  <Ionicons name="share-outline" size={22} color={accent} />
                                </TouchableOpacity>
                              </View>
                            );
                          })}
                          <Text style={styles.guestHint}>Send each guest their QR so they can arrive separately.</Text>
                        </>
                      ) : null}
                    </View>
                  ) : null}
                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: accent, marginTop: 24, alignSelf: 'stretch' }]} onPress={closeRsvp}><Text style={styles.submitText}>Done</Text></TouchableOpacity>
                </View>
              ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: 30 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  {fields.map((f) => (
                    <View key={f}>
                      <Text style={styles.label}>{FIELD_LABEL[f] ?? f}{(campaign.cta_required ?? []).includes(f) ? ' *' : ''}</Text>
                      <TextInput
                        style={[styles.input, f === 'notes' && { height: 90, textAlignVertical: 'top' }]}
                        value={values[f] ?? ''}
                        onChangeText={(v) => setValues((prev) => ({ ...prev, [f]: v }))}
                        placeholder={FIELD_LABEL[f] ?? f}
                        placeholderTextColor="#9ca3af"
                        keyboardType={f === 'email' ? 'email-address' : f === 'phone' ? 'phone-pad' : 'default'}
                        autoCapitalize={f === 'email' ? 'none' : 'sentences'}
                        multiline={f === 'notes'}
                      />
                    </View>
                  ))}

                  {hasPlusOnes ? (
                    <View style={{ marginTop: 8 }}>
                      <View style={styles.plusRow}>
                        <Text style={styles.label}>Plus-ones{campaign.cta_plus_one_limit != null ? ` (max ${campaign.cta_plus_one_limit})` : ''}</Text>
                        <View style={styles.stepper}>
                          <TouchableOpacity onPress={() => setPlusCount((c) => Math.max(0, c - 1))} style={styles.stepBtn}><Ionicons name="remove" size={18} color={INK} /></TouchableOpacity>
                          <Text style={styles.stepVal}>{plusCount}</Text>
                          <TouchableOpacity onPress={() => setPlusCount((c) => (campaign.cta_plus_one_limit != null && c >= campaign.cta_plus_one_limit ? c : c + 1))} style={styles.stepBtn}><Ionicons name="add" size={18} color={INK} /></TouchableOpacity>
                        </View>
                      </View>
                      {plusCount > 0 ? <Text style={styles.plusHint}>Each guest gets their own QR to share from your confirmation.</Text> : null}
                      {Array.from({ length: plusCount }).map((_, i) => (
                        <TextInput
                          key={i}
                          style={[styles.input, { marginTop: 8 }]}
                          value={plusNames[i] ?? ''}
                          onChangeText={(v) => setPlusNames((prev) => { const n = [...prev]; n[i] = v; return n; })}
                          placeholder={`Guest ${i + 1} name *`}
                          placeholderTextColor="#9ca3af"
                        />
                      ))}
                    </View>
                  ) : null}

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}
                  <TouchableOpacity style={[styles.submitBtn, { backgroundColor: accent, opacity: submitting ? 0.6 : 1 }]} onPress={submit} disabled={submitting} activeOpacity={0.9}>
                    {submitting ? <ActivityIndicator color="#fff" /> : <Text style={styles.submitText}>{ctaLabel}</Text>}
                  </TouchableOpacity>
                </ScrollView>
              )}
            </Animated.View>
          </View>
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

  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: SCREEN_H * 0.82, backgroundColor: IVORY, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 22 },
  sheetHandle: { alignSelf: 'center', width: 40, height: 5, borderRadius: 3, backgroundColor: '#D8D2C8', marginTop: 10, marginBottom: 8 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  sheetTitle: { fontSize: 22, fontWeight: '600', color: INK, fontFamily: DISPLAY },
  sheetClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#fff', borderWidth: 1, borderColor: HAIRLINE, alignItems: 'center', justifyContent: 'center' },

  label: { fontSize: 13, fontWeight: '600', color: MUTED, marginBottom: 6, marginTop: 10 },
  input: { backgroundColor: '#fff', borderRadius: 12, borderWidth: 1, borderColor: HAIRLINE, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: INK },
  plusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  stepBtn: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, borderColor: HAIRLINE, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  stepVal: { fontSize: 17, fontWeight: '700', color: INK, minWidth: 22, textAlign: 'center' },
  plusHint: { fontSize: 12, color: MUTED, marginTop: 10, marginBottom: 2 },

  errorText: { color: '#dc2626', fontSize: 13, marginTop: 14 },
  submitBtn: { borderRadius: 14, paddingVertical: 16, alignItems: 'center', marginTop: 22 },
  submitText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  doneWrap: { alignItems: 'center', paddingTop: 30, paddingBottom: 44 },
  doneIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  doneTitle: { fontSize: 22, fontWeight: '700', color: INK },
  doneSub: { fontSize: 14, color: MUTED, marginTop: 8, textAlign: 'center' },
  qrWrap: { alignItems: 'center', marginTop: 22 },
  qr: { width: 220, height: 220, borderRadius: 12, backgroundColor: '#fff' },
  qrHint: { fontSize: 12, color: MUTED, marginTop: 10 },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12, borderWidth: 1.5, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 8 },
  shareText: { fontSize: 13, fontWeight: '700' },
  guestRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: HAIRLINE, padding: 12, marginBottom: 10 },
  guestQr: { width: 52, height: 52, borderRadius: 8, backgroundColor: '#fff' },
  guestName: { fontSize: 15, fontWeight: '700', color: INK },
  guestSub: { fontSize: 12, color: MUTED, marginTop: 2 },
  guestHint: { fontSize: 12, color: MUTED, textAlign: 'center', marginTop: 4 },
});
