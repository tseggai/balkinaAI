import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Animated,
  Keyboard,
  SafeAreaView,
  Linking,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import BalkinaLogo, { BalkinaLogoInline } from '@/components/BalkinaLogo';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const API_BASE = 'https://balkina-ai.vercel.app';

// ── Booking State (Phase 2 — client-side flow) ──────────────────────────────

interface BookingState {
  tenantId: string | null;
  tenantName: string | null;
  serviceId: string | null;
  serviceName: string | null;
  servicePrice: number | null;
  serviceDuration: number | null;
  depositEnabled: boolean;
  depositAmount: number | null;
  date: string | null; // YYYY-MM-DD
  staffId: string | null;
  staffName: string | null;
  timeSlot: string | null; // display time like "10:00 AM"
  timeSlotIso: string | null; // ISO string
  selectedPackage: string | null;
  selectedExtras: string[];
  extrasTotal: number;
  packagePrice: number;
  address: string | null;
}

const INITIAL_BOOKING_STATE: BookingState = {
  tenantId: null,
  tenantName: null,
  serviceId: null,
  serviceName: null,
  servicePrice: null,
  serviceDuration: null,
  depositEnabled: false,
  depositAmount: null,
  date: null,
  staffId: null,
  staffName: null,
  timeSlot: null,
  timeSlotIso: null,
  selectedPackage: null,
  selectedExtras: [],
  extrasTotal: 0,
  packagePrice: 0,
  address: null,
};

// ── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  type?: 'text' | 'businesses' | 'booking_confirmation';
  isStreaming?: boolean;
}

// ── Card Types ───────────────────────────────────────────────────────────────

interface BusinessCardData {
  type: 'business_card';
  id: string;
  name: string;
  image_url?: string;
  distance_mi: number;
  drive_minutes: number;
  category: string;
}

interface ServiceCardData {
  type: 'service_card';
  id: string;
  name: string;
  image_url?: string;
  price: number;
  duration_minutes: number;
  deposit_enabled: boolean;
  deposit_amount?: number;
}

interface StaffCardData {
  type: 'staff_card';
  id: string;
  name: string;
  image_url?: string;
  available_slots_count: number;
}

interface PackageCardData {
  type: 'package_card';
  id: string;
  name: string;
  image_url?: string;
  price: number;
  services_count: number;
  service_names: string[];
  expiration_label?: string;
  customer_owned: boolean;
  sessions_remaining?: number;
}

interface ExtrasGridData {
  type: 'extras_grid';
  extras: Array<{ id: string; name: string; price: number; duration_minutes: number; selected?: boolean }>;
}

interface SummaryCardData {
  type: 'summary_card';
  service: string;
  package?: string;
  extras: string[];
  business: string;
  staff: string;
  date: string;
  time: string;
  address: string;
  subtotal: number;
  extras_total: number;
  package_discount: number;
  coupon_discount: number;
  loyalty_discount: number;
  total: number;
  deposit_required?: number;
  points_to_earn: number;
}

interface ConfirmedCardData {
  type: 'confirmed_card';
  service: string;
  package?: string;
  extras: string[];
  business: string;
  staff: string;
  date: string;
  time: string;
  address: string;
  total: number;
  points_earned: number;
  latitude?: number;
  longitude?: number;
}

interface ServiceChipData {
  id: string;
  name: string;
  price: number;
  duration_minutes: number;
  deposit_enabled?: boolean;
  deposit_amount?: number;
}

interface BusinessWithServicesData {
  type: 'business_with_services';
  items: Array<BusinessCardData & { services: ServiceChipData[] }>;
}

interface TimeSlotData {
  time: string;
  iso: string;
  staff_name?: string;
  available?: boolean;
}

interface StaffWithSlotsData {
  type: 'staff_with_slots';
  items: Array<StaffCardData & { slots: TimeSlotData[]; all_slots?: TimeSlotData[] }>;
  anyone_slots?: Array<TimeSlotData & { staff_name: string }>;
}

interface BookingOptionsData {
  type: 'booking_options';
  packages: PackageCardData[];
  extras: Array<{ id: string; name: string; price: number; duration_minutes: number }>;
}

type CardData =
  | { type: 'business_cards'; items: BusinessCardData[] }
  | { type: 'service_cards'; items: ServiceCardData[] }
  | { type: 'staff_cards'; items: StaffCardData[] }
  | { type: 'package_cards'; items: PackageCardData[] }
  | ExtrasGridData
  | SummaryCardData
  | ConfirmedCardData
  | BusinessWithServicesData
  | StaffWithSlotsData
  | BookingOptionsData;

interface ParsedSegment {
  kind: 'text' | 'card';
  text?: string;
  card?: CardData;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function cleanAIMessage(text: string): string {
  return text
    .replace(/^\d+\.\s*$/gm, '')
    .replace(/^-\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// ── Fallback: detect plain-text summary and convert to card ──────────────

function tryParseSummaryText(text: string): SummaryCardData | null {
  if (!text.includes('summary of your booking') && !text.includes('booking summary')) return null;

  const extract = (label: string): string => {
    const regex = new RegExp(`[-\\*]*\\s*\\*{0,2}${label}:?\\*{0,2}\\s*(.+)`, 'i');
    const m = text.match(regex);
    return m?.[1]?.trim() ?? '';
  };

  const service = extract('Service');
  const business = extract('Business');
  if (!service || !business) return null;

  const totalMatch = text.match(/total\s+is\s+\*{0,2}\$?([\d.]+)\*{0,2}/i) ?? text.match(/\*{0,2}Total(?:\s*Price)?:?\*{0,2}\s*\$?([\d.]+)/i);
  const total = totalMatch ? parseFloat(totalMatch[1]!) : 0;

  const subtotalMatch = text.match(/Subtotal:?\*{0,2}\s*\$?([\d.]+)/i);
  const subtotal = subtotalMatch ? parseFloat(subtotalMatch[1]!) : total;

  const extrasStr = extract('Extras');
  const extras = extrasStr && extrasStr.toLowerCase() !== 'none' ? extrasStr.split(',').map(e => e.trim()) : [];

  return {
    type: 'summary_card',
    service,
    extras,
    business,
    staff: extract('Staff'),
    date: extract('Date'),
    time: extract('Time'),
    address: extract('Address'),
    subtotal,
    extras_total: 0,
    package_discount: 0,
    coupon_discount: 0,
    loyalty_discount: 0,
    total,
    points_to_earn: 0,
  };
}

// ── Fallback: detect plain-text confirmed booking and convert to card ────

function tryParseConfirmedText(text: string): ConfirmedCardData | null {
  if (!text.includes('booking is confirmed') && !text.includes('Appointment Confirmed')) return null;

  const extract = (label: string): string => {
    const regex = new RegExp(`[-\\*]*\\s*\\*{0,2}${label}:?\\*{0,2}\\s*(.+)`, 'i');
    const m = text.match(regex);
    return m?.[1]?.trim() ?? '';
  };

  const service = extract('Service');
  const business = extract('Business');
  if (!service || !business) return null;

  const totalMatch = text.match(/\*{0,2}Total(?:\s*Price)?:?\*{0,2}\s*\$?([\d.]+)/i);
  const total = totalMatch ? parseFloat(totalMatch[1]!) : 0;

  const extrasStr = extract('Extras');
  const extras = extrasStr && extrasStr.toLowerCase() !== 'none' ? extrasStr.split(',').map(e => e.trim()) : [];

  return {
    type: 'confirmed_card',
    service,
    extras,
    business,
    staff: extract('Staff'),
    date: extract('Date'),
    time: extract('Time'),
    address: extract('Address'),
    total,
    points_earned: 0,
  };
}

// ── Parse [[CARD:...]] blocks from message content ─────────────────────────

function parseCardBlocks(content: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  const regex = /\[\[CARD:([\s\S]*?)\]\]/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index).trim();
      if (textBefore) segments.push({ kind: 'text', text: textBefore });
    }
    try {
      const cardData = JSON.parse(match[1]!) as CardData;
      segments.push({ kind: 'card', card: cardData });
    } catch {
      // Malformed JSON — render as text
      segments.push({ kind: 'text', text: match[0] });
    }
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    const remaining = content.slice(lastIndex).trim();
    if (remaining) segments.push({ kind: 'text', text: remaining });
  }

  if (segments.length > 0) return segments;

  // Fallback: detect plain-text summary and convert to structured card
  const summaryCard = tryParseSummaryText(content);
  if (summaryCard) {
    return [{ kind: 'card', card: summaryCard }];
  }

  // Fallback: detect plain-text confirmed booking and convert to structured card
  const confirmedCard = tryParseConfirmedText(content);
  if (confirmedCard) {
    return [{ kind: 'card', card: confirmedCard }];
  }

  return [{ kind: 'text', text: content }];
}

// ── Parse [[button:...]] and [[link:Label|URL]] ─────────────────────────────

interface ParsedLink {
  label: string;
  url: string;
}

function parseMessageContent(content: string): { text: string; buttons: string[]; links: ParsedLink[] } {
  const buttonRegex = /\[\[button:([^\]]+)\]\]/g;
  const linkRegex = /\[\[link:([^|]+)\|([^\]]+)\]\]/g;
  const buttons: string[] = [];
  const links: ParsedLink[] = [];

  let text = content.replace(linkRegex, (_match, label: string, url: string) => {
    links.push({ label: label.trim(), url: url.trim() });
    return '';
  });

  text = text.replace(buttonRegex, (_match, label: string) => {
    buttons.push(label.trim());
    return '';
  })
    .replace(/^[ \t]+$/gm, '')
    .replace(/\n{2,}/g, '\n')
    .replace(/^\n+|\n+$/g, '')
    .trim();

  return { text, buttons, links };
}

// ── Parse inline markdown (**bold** and *italic*) ───────────────────────────

function renderFormattedText(
  text: string,
  baseStyle: object,
): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(
        <Text key={key++} style={baseStyle}>
          {text.slice(lastIndex, match.index)}
        </Text>,
      );
    }

    if (match[2]) {
      parts.push(
        <Text key={key++} style={[baseStyle, { fontWeight: '700' }]}>
          {match[2]}
        </Text>,
      );
    } else if (match[3]) {
      parts.push(
        <Text key={key++} style={[baseStyle, { fontStyle: 'italic' }]}>
          {match[3]}
        </Text>,
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(
      <Text key={key++} style={baseStyle}>
        {text.slice(lastIndex)}
      </Text>,
    );
  }

  return parts.length > 0 ? parts : [<Text key={0} style={baseStyle}>{text}</Text>];
}

// ── Color hash for initials ──────────────────────────────────────────────────

function nameToColor(name: string): string {
  const colors = ['#6B7FC4', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length]!;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Typing Indicator ─────────────────────────────────────────────────────────

function TypingIndicator() {
  const dot1 = useRef(new Animated.Value(0)).current;
  const dot2 = useRef(new Animated.Value(0)).current;
  const dot3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animate = (dot: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
        ]),
      );

    const a1 = animate(dot1, 0);
    const a2 = animate(dot2, 150);
    const a3 = animate(dot3, 300);
    a1.start(); a2.start(); a3.start();

    return () => { a1.stop(); a2.stop(); a3.stop(); };
  }, [dot1, dot2, dot3]);

  const dotStyle = (anim: Animated.Value) => ({
    transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [0, -4] }) }],
  });

  return (
    <View style={typingStyles.container}>
      <Animated.View style={[typingStyles.dot, dotStyle(dot1)]} />
      <Animated.View style={[typingStyles.dot, dotStyle(dot2)]} />
      <Animated.View style={[typingStyles.dot, dotStyle(dot3)]} />
    </View>
  );
}

const typingStyles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4 },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#9ca3af' },
});

// ── Business Card Row ────────────────────────────────────────────────────────

function BusinessCardRow({ items, onTap }: { items: BusinessCardData[]; onTap: (name: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 2, flexGrow: 0 }}>
      {items.map((biz) => (
        <TouchableOpacity
          key={biz.id}
          style={richCardStyles.businessCard}
          onPress={() => onTap(biz.name)}
          activeOpacity={0.7}
        >
          <View style={richCardStyles.businessImage}>
            {biz.image_url ? (
              <Image source={{ uri: biz.image_url }} style={richCardStyles.businessImg} />
            ) : (
              <Text style={richCardStyles.businessEmoji}>🏢</Text>
            )}
          </View>
          <View style={richCardStyles.businessInfo}>
            <Text style={richCardStyles.businessName} numberOfLines={2}>{biz.name}</Text>
            <Text style={richCardStyles.businessDistance}>{biz.distance_mi} mi</Text>
            <Text style={richCardStyles.businessDrive}>{biz.drive_minutes} min drive</Text>
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Service Card Row ─────────────────────────────────────────────────────────

function ServiceCardRow({ items, onTap }: { items: ServiceCardData[]; onTap: (name: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 2, flexGrow: 0 }}>
      {items.map((svc) => (
        <TouchableOpacity
          key={svc.id}
          style={richCardStyles.serviceCard}
          onPress={() => onTap(svc.name)}
          activeOpacity={0.7}
        >
          <View style={richCardStyles.serviceImage}>
            {svc.image_url ? (
              <Image source={{ uri: svc.image_url }} style={richCardStyles.serviceImg} />
            ) : (
              <Text style={richCardStyles.serviceEmoji}>✂️</Text>
            )}
          </View>
          <View style={richCardStyles.serviceInfo}>
            <Text style={richCardStyles.serviceName} numberOfLines={2}>{svc.name}</Text>
            <Text style={richCardStyles.servicePrice}>${svc.price}</Text>
            <Text style={richCardStyles.serviceDuration}>{svc.duration_minutes} min</Text>
            {svc.deposit_enabled && svc.deposit_amount ? (
              <View style={richCardStyles.depositBadge}>
                <Text style={richCardStyles.depositText}>${svc.deposit_amount} deposit</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

// ── Business With Services Row (combined card) ──────────────────────────────

function BusinessWithServicesRow({ data, onTap }: { data: BusinessWithServicesData; onTap: (msg: string) => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedSvcId, setSelectedSvcId] = useState<string | null>(null);
  const selectedBiz = data.items[selectedIdx];
  const services = selectedBiz?.services ?? [];
  const CARD_WIDTH = 280;
  const CARD_MARGIN = 10;
  const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN;
  const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

  // Auto-select business on snap
  const onBusinessScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / SNAP_INTERVAL);
    if (idx >= 0 && idx < data.items.length) {
      setSelectedIdx(idx);
    }
  }, [data.items.length, SNAP_INTERVAL]);

  return (
    <View style={{ marginTop: 4, marginBottom: 6, flexShrink: 0 }}>
      <View style={{ height: 210 }}>
        <FlatList
          data={data.items}
          keyExtractor={(biz) => biz.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          snapToInterval={SNAP_INTERVAL}
          snapToAlignment="start"
          decelerationRate="fast"
          contentContainerStyle={{ paddingLeft: SIDE_PADDING, paddingRight: SIDE_PADDING }}
          onMomentumScrollEnd={onBusinessScroll}
          renderItem={({ item: biz, index: idx }) => (
            <TouchableOpacity
              key={biz.id}
              style={[
                richCardStyles.businessCard,
                { marginRight: CARD_MARGIN },
                idx === selectedIdx && { borderWidth: 2, borderColor: '#6B7FC4' },
              ]}
              onPress={() => setSelectedIdx(idx)}
              activeOpacity={0.7}
            >
              <View style={richCardStyles.businessImage}>
                {biz.image_url ? (
                  <Image source={{ uri: biz.image_url }} style={richCardStyles.businessImg} />
                ) : (
                  <Text style={richCardStyles.businessEmoji}>🏢</Text>
                )}
              </View>
              <View style={richCardStyles.businessInfo}>
                <Text style={richCardStyles.businessName} numberOfLines={2}>{biz.name}</Text>
                <Text style={richCardStyles.businessDistance}>{biz.distance_mi} mi</Text>
                <Text style={richCardStyles.businessDrive}>{biz.drive_minutes} min drive</Text>
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
      {services.length > 0 && selectedBiz ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 10 }}>
          {services.map((svc) => {
            const isSelected = selectedSvcId === svc.id;
            return (
              <TouchableOpacity
                key={svc.id}
                style={[combinedStyles.serviceCardLg, isSelected && combinedStyles.serviceCardLgSelected]}
                onPress={() => {
                  setSelectedSvcId(svc.id);
                  onTap(`${svc.name} at ${selectedBiz.name}`);
                }}
                activeOpacity={0.7}
              >
                <Text style={[combinedStyles.serviceCardLgName, isSelected && combinedStyles.serviceCardLgNameSelected]} numberOfLines={1}>{svc.name}</Text>
                <View style={combinedStyles.serviceCardLgRow}>
                  <View style={combinedStyles.serviceCardLgLeft}>
                    <Text style={[combinedStyles.serviceCardLgPrice, isSelected && combinedStyles.serviceCardLgPriceSelected]}>${svc.price}</Text>
                    {svc.deposit_enabled && svc.deposit_amount ? (
                      <Text style={combinedStyles.serviceCardLgDepositText}>({Math.round((svc.deposit_amount / svc.price) * 100)}% deposit)</Text>
                    ) : null}
                  </View>
                  <Text style={[combinedStyles.serviceCardLgDuration, isSelected && combinedStyles.serviceCardLgDurationSelected]}>{svc.duration_minutes} min</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}

// ── Staff Card Row ───────────────────────────────────────────────────────────

function StaffCardRow({ items, onTap }: { items: StaffCardData[]; onTap: (name: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 2, flexGrow: 0 }}>
      {items.map((staff) => (
        <TouchableOpacity
          key={staff.id}
          style={richCardStyles.staffCard}
          onPress={() => onTap(staff.name)}
          activeOpacity={0.7}
        >
          <View style={[richCardStyles.staffAvatar, { backgroundColor: nameToColor(staff.name) }]}>
            {staff.image_url ? (
              <Image source={{ uri: staff.image_url }} style={richCardStyles.staffAvatarImg} />
            ) : (
              <Text style={richCardStyles.staffInitials}>{getInitials(staff.name)}</Text>
            )}
          </View>
          <Text style={richCardStyles.staffName} numberOfLines={1}>{staff.name}</Text>
          <Text style={richCardStyles.staffSlots}>{staff.available_slots_count} slots</Text>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={richCardStyles.staffCard}
        onPress={() => onTap('Anyone')}
        activeOpacity={0.7}
      >
        <View style={[richCardStyles.staffAvatar, { backgroundColor: '#9ca3af' }]}>
          <Ionicons name="people-outline" size={22} color="#fff" />
        </View>
        <Text style={richCardStyles.staffName}>Anyone</Text>
        <Text style={richCardStyles.staffSlots}> </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Staff With Slots Row (combined card) ─────────────────────────────────────

function StaffWithSlotsRow({ data, onTap }: { data: StaffWithSlotsData; onTap: (msg: string) => void }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  // -1 means "Anyone" is selected
  const isAnyone = selectedIdx === -1;
  const selectedStaff = isAnyone ? null : data.items[selectedIdx];
  // Use all_slots (with available flag) if present, otherwise fall back to slots (all available)
  const slots: TimeSlotData[] = isAnyone
    ? (data.anyone_slots ?? [])
    : (selectedStaff?.all_slots ?? selectedStaff?.slots?.map((s) => ({ ...s, available: true })) ?? []);

  return (
    <View style={{ marginTop: 4, marginBottom: 2 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        {data.items.map((staff, idx) => (
          <TouchableOpacity
            key={staff.id}
            style={[
              richCardStyles.staffCard,
              idx === selectedIdx && !isAnyone && { opacity: 1 },
              idx !== selectedIdx && !isAnyone && { opacity: 0.5 },
              isAnyone && { opacity: 0.5 },
            ]}
            onPress={() => setSelectedIdx(idx)}
            activeOpacity={0.7}
          >
            <View style={[richCardStyles.staffAvatar, { backgroundColor: nameToColor(staff.name) }]}>
              {staff.image_url ? (
                <Image source={{ uri: staff.image_url }} style={richCardStyles.staffAvatarImg} />
              ) : (
                <Text style={richCardStyles.staffInitials}>{getInitials(staff.name)}</Text>
              )}
            </View>
            <Text style={richCardStyles.staffName} numberOfLines={1}>{staff.name}</Text>
            <Text style={richCardStyles.staffSlots}>{staff.available_slots_count} slots</Text>
          </TouchableOpacity>
        ))}
        {data.anyone_slots && data.anyone_slots.length > 0 ? (
          <TouchableOpacity
            style={[
              richCardStyles.staffCard,
              isAnyone ? { opacity: 1 } : { opacity: 0.5 },
            ]}
            onPress={() => setSelectedIdx(-1)}
            activeOpacity={0.7}
          >
            <View style={[richCardStyles.staffAvatar, { backgroundColor: '#9ca3af' }]}>
              <Ionicons name="people-outline" size={22} color="#fff" />
            </View>
            <Text style={richCardStyles.staffName}>Anyone</Text>
            <Text style={richCardStyles.staffSlots}> </Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
      {slots.length > 0 ? (
        <View style={combinedStyles.slotsContainer}>
          {slots.map((slot, i) => {
            const isAvailable = slot.available !== false;
            const staffLabel = isAnyone && slot.staff_name ? ` with ${slot.staff_name}` : selectedStaff ? ` with ${selectedStaff.name}` : '';
            return (
              <TouchableOpacity
                key={`${slot.time}-${i}`}
                style={[
                  combinedStyles.slotChip,
                  !isAvailable && combinedStyles.slotChipUnavailable,
                ]}
                onPress={() => isAvailable ? onTap(`${slot.time}${staffLabel}`) : undefined}
                activeOpacity={isAvailable ? 0.7 : 1}
                disabled={!isAvailable}
              >
                <Text style={[
                  combinedStyles.slotChipText,
                  !isAvailable && combinedStyles.slotChipTextUnavailable,
                ]}>{slot.time}</Text>
                {isAnyone && slot.staff_name ? (
                  <Text style={combinedStyles.slotStaffLabel}>{slot.staff_name}</Text>
                ) : null}
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

// ── Package Card Row ─────────────────────────────────────────────────────────

function PackageCardRow({ items, onTap }: { items: PackageCardData[]; onTap: (name: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 4, marginBottom: 2, flexGrow: 0 }}>
      {items.map((pkg) => (
        <TouchableOpacity
          key={pkg.id}
          style={richCardStyles.packageCard}
          onPress={() => onTap(pkg.name)}
          activeOpacity={0.7}
        >
          <View style={richCardStyles.packageImage}>
            {pkg.image_url ? (
              <Image source={{ uri: pkg.image_url }} style={richCardStyles.packageImg} />
            ) : (
              <Text style={richCardStyles.packageEmoji}>📦</Text>
            )}
          </View>
          <View style={richCardStyles.packageInfo}>
            {pkg.customer_owned ? (
              <View style={richCardStyles.ownedBadge}>
                <Text style={richCardStyles.ownedBadgeText}>OWNED</Text>
              </View>
            ) : null}
            <Text style={richCardStyles.packageName} numberOfLines={2}>{pkg.name}</Text>
            {pkg.customer_owned && pkg.sessions_remaining != null ? (
              <Text style={richCardStyles.packageSessions}>{pkg.sessions_remaining} sessions left</Text>
            ) : (
              <>
                <Text style={richCardStyles.packagePrice}>${pkg.price}</Text>
                {pkg.service_names && pkg.service_names.length > 0 ? (
                  <Text style={richCardStyles.packageCount} numberOfLines={2}>{pkg.service_names.join(', ')}</Text>
                ) : (
                  <Text style={richCardStyles.packageCount}>{pkg.services_count} services</Text>
                )}
              </>
            )}
          </View>
        </TouchableOpacity>
      ))}
      <TouchableOpacity
        style={richCardStyles.packageCard}
        onPress={() => onTap('Not interested')}
        activeOpacity={0.7}
      >
        <View style={richCardStyles.packageImage}>
          <Text style={richCardStyles.packageEmoji}>➡️</Text>
        </View>
        <View style={richCardStyles.packageInfo}>
          <Text style={richCardStyles.packageName}>Not interested</Text>
        </View>
      </TouchableOpacity>
    </ScrollView>
  );
}

// ── Extras Grid ──────────────────────────────────────────────────────────────

function ExtrasGridComponent({ data, onSubmit }: { data: ExtrasGridData; onSubmit: (msg: string) => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = () => {
    const selectedNames = data.extras.filter((e) => selected.has(e.id)).map((e) => e.name);
    if (selectedNames.length > 0) {
      onSubmit(selectedNames.join(', '));
    } else {
      onSubmit('No extras');
    }
  };

  return (
    <View style={richCardStyles.extrasContainer}>
      <View style={richCardStyles.extrasGrid}>
        {data.extras.map((extra) => {
          const isSelected = selected.has(extra.id);
          return (
            <TouchableOpacity
              key={extra.id}
              style={[richCardStyles.extrasChip, isSelected && richCardStyles.extrasChipSelected]}
              onPress={() => toggle(extra.id)}
              activeOpacity={0.7}
            >
              <Text style={[richCardStyles.extrasChipName, isSelected && richCardStyles.extrasChipNameSelected]}>
                {extra.name}
              </Text>
              <Text style={[richCardStyles.extrasChipDetail, isSelected && richCardStyles.extrasChipDetailSelected]}>
                +${extra.price} · +{extra.duration_minutes}min
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <TouchableOpacity style={richCardStyles.extrasDoneBtn} onPress={handleDone} activeOpacity={0.7}>
        <Text style={richCardStyles.extrasDoneBtnText}>Done adding extras →</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Booking Options (combined packages + extras) ────────────────────────────

function BookingOptionsComponent({ data, onSubmit }: { data: BookingOptionsData; onSubmit: (msg: string) => void }) {
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [selectedExtras, setSelectedExtras] = useState<Set<string>>(new Set());

  const toggleExtra = (id: string) => {
    setSelectedExtras((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleDone = () => {
    const parts: string[] = [];
    if (selectedPackage) {
      parts.push(`Package: ${selectedPackage}`);
    }
    const extraNames = data.extras.filter((e) => selectedExtras.has(e.id)).map((e) => e.name);
    if (extraNames.length > 0) {
      parts.push(`Extras: ${extraNames.join(', ')}`);
    }
    if (parts.length === 0) {
      onSubmit('No packages or extras');
    } else {
      onSubmit(parts.join('. '));
    }
  };

  return (
    <View style={combinedStyles.bookingOptionsContainer}>
      {data.packages.length > 0 ? (
        <>
          <Text style={combinedStyles.sectionLabel}>Package deals</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 8 }}>
            {data.packages.map((pkg) => {
              const isSelected = selectedPackage === pkg.name;
              return (
                <TouchableOpacity
                  key={pkg.id}
                  style={[combinedStyles.packageChip, isSelected && combinedStyles.packageChipSelected]}
                  onPress={() => setSelectedPackage(isSelected ? null : pkg.name)}
                  activeOpacity={0.7}
                >
                  {pkg.customer_owned ? (
                    <View style={richCardStyles.ownedBadge}>
                      <Text style={richCardStyles.ownedBadgeText}>OWNED</Text>
                    </View>
                  ) : null}
                  <Text style={[combinedStyles.packageChipName, isSelected && combinedStyles.packageChipNameSelected]}>{pkg.name}</Text>
                  {pkg.customer_owned && pkg.sessions_remaining != null ? (
                    <Text style={[combinedStyles.packageChipDetail, isSelected && combinedStyles.packageChipDetailSelected]}>{pkg.sessions_remaining} left</Text>
                  ) : (
                    <Text style={[combinedStyles.packageChipDetail, isSelected && combinedStyles.packageChipDetailSelected]}>${pkg.price}</Text>
                  )}
                  {pkg.service_names && pkg.service_names.length > 0 ? (
                    <Text style={[combinedStyles.packageChipDetail, isSelected && combinedStyles.packageChipDetailSelected]} numberOfLines={2}>{pkg.service_names.join(', ')}</Text>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : null}
      {data.extras.length > 0 ? (
        <>
          <Text style={combinedStyles.sectionLabel}>Add extras</Text>
          <View style={richCardStyles.extrasGrid}>
            {data.extras.map((extra) => {
              const isSelected = selectedExtras.has(extra.id);
              return (
                <TouchableOpacity
                  key={extra.id}
                  style={[richCardStyles.extrasChip, isSelected && richCardStyles.extrasChipSelected]}
                  onPress={() => toggleExtra(extra.id)}
                  activeOpacity={0.7}
                >
                  <Text style={[richCardStyles.extrasChipName, isSelected && richCardStyles.extrasChipNameSelected]}>{extra.name}</Text>
                  <Text style={[richCardStyles.extrasChipDetail, isSelected && richCardStyles.extrasChipDetailSelected]}>
                    +${extra.price} · +{extra.duration_minutes}min
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      ) : null}
      <TouchableOpacity style={richCardStyles.extrasDoneBtn} onPress={handleDone} activeOpacity={0.7}>
        <Text style={richCardStyles.extrasDoneBtnText}>
          {selectedPackage || selectedExtras.size > 0 ? 'Continue with selections →' : 'Skip →'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Summary Card (structured) ────────────────────────────────────────────────

function RichSummaryCard({ data, onButtonPress }: { data: SummaryCardData; onButtonPress: (label: string) => void }) {
  const displayService = data.package || data.service;
  return (
    <View style={richCardStyles.summaryCard}>
      <Text style={richCardStyles.summaryLabel}><Text style={richCardStyles.summaryBold}>Service:</Text> {displayService}</Text>
      <Text style={richCardStyles.summaryLabel}><Text style={richCardStyles.summaryBold}>Extras:</Text> {data.extras.length > 0 ? data.extras.join(', ') : 'None'}</Text>
      <Text style={richCardStyles.summaryLabel}><Text style={richCardStyles.summaryBold}>Business:</Text> {data.business}</Text>
      <Text style={richCardStyles.summaryLabel}><Text style={richCardStyles.summaryBold}>Staff:</Text> {data.staff}</Text>
      <Text style={richCardStyles.summaryLabel}><Text style={richCardStyles.summaryBold}>Date:</Text> {data.date}</Text>
      <Text style={richCardStyles.summaryLabel}><Text style={richCardStyles.summaryBold}>Time:</Text> {data.time}</Text>
      <Text style={richCardStyles.summaryLabel}><Text style={richCardStyles.summaryBold}>Address:</Text> {data.address}</Text>

      <View style={richCardStyles.divider} />

      <View style={richCardStyles.summaryRow}>
        <Text style={richCardStyles.summaryRowLabel}>Subtotal</Text>
        <Text style={richCardStyles.summaryRowValue}>${data.subtotal.toFixed(2)}</Text>
      </View>
      {data.extras_total > 0 ? (
        <View style={richCardStyles.summaryRow}>
          <Text style={richCardStyles.summaryRowLabel}>Extras</Text>
          <Text style={richCardStyles.summaryRowValue}>+${data.extras_total.toFixed(2)}</Text>
        </View>
      ) : null}
      {data.package_discount > 0 ? (
        <View style={richCardStyles.summaryRow}>
          <Text style={richCardStyles.summaryRowLabel}>Package discount</Text>
          <Text style={[richCardStyles.summaryRowValue, { color: '#16a34a' }]}>-${data.package_discount.toFixed(2)}</Text>
        </View>
      ) : null}
      {data.coupon_discount > 0 ? (
        <View style={richCardStyles.summaryRow}>
          <Text style={richCardStyles.summaryRowLabel}>Coupon</Text>
          <Text style={[richCardStyles.summaryRowValue, { color: '#16a34a' }]}>-${data.coupon_discount.toFixed(2)}</Text>
        </View>
      ) : null}
      {data.loyalty_discount > 0 ? (
        <View style={richCardStyles.summaryRow}>
          <Text style={richCardStyles.summaryRowLabel}>Loyalty</Text>
          <Text style={[richCardStyles.summaryRowValue, { color: '#16a34a' }]}>-${data.loyalty_discount.toFixed(2)}</Text>
        </View>
      ) : null}

      <View style={richCardStyles.divider} />

      <View style={richCardStyles.summaryRow}>
        <Text style={richCardStyles.summaryTotal}>Total</Text>
        <Text style={richCardStyles.summaryTotal}>${data.total.toFixed(2)}</Text>
      </View>
      {data.deposit_required != null && data.deposit_required > 0 ? (
        <Text style={richCardStyles.summaryDeposit}>Deposit required: ${data.deposit_required.toFixed(2)}</Text>
      ) : null}
      {data.points_to_earn > 0 ? (
        <Text style={richCardStyles.summaryPoints}>⭐ +{data.points_to_earn} pts</Text>
      ) : null}

      <TouchableOpacity
        style={richCardStyles.confirmBtn}
        onPress={() => onButtonPress('Confirm Booking')}
        activeOpacity={0.7}
      >
        <Text style={richCardStyles.confirmBtnText}>Confirm Booking</Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Confirmed Card (structured) ──────────────────────────────────────────────

function RichConfirmedCard({ data, onButtonPress }: { data: ConfirmedCardData; onButtonPress: (label: string) => void }) {
  const openDirections = () => {
    if (data.latitude && data.longitude) {
      const url = Platform.OS === 'ios'
        ? `maps://maps.apple.com/?daddr=${data.latitude},${data.longitude}`
        : `https://www.google.com/maps/dir/?api=1&destination=${data.latitude},${data.longitude}`;
      Linking.openURL(url);
    } else if (data.address) {
      const encoded = encodeURIComponent(data.address);
      const url = Platform.OS === 'ios'
        ? `maps://maps.apple.com/?daddr=${encoded}`
        : `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
      Linking.openURL(url);
    }
  };

  const displayService = data.package || data.service;

  return (
    <View style={richCardStyles.confirmedCard}>
      <View style={richCardStyles.confirmedCheckCircle}>
        <Ionicons name="checkmark" size={30} color="#fff" />
      </View>
      <Text style={richCardStyles.confirmedTitle}>Appointment Confirmed!</Text>

      <View style={{ width: '100%', marginTop: 8 }}>
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Service:</Text>
          <Text style={richCardStyles.confirmedValue}>{displayService}</Text>
        </View>
        {data.extras.length > 0 ? (
          <View style={richCardStyles.confirmedRow}>
            <Text style={richCardStyles.confirmedLabel}>Extras:</Text>
            <Text style={richCardStyles.confirmedValue}>{data.extras.join(', ')}</Text>
          </View>
        ) : null}
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Business:</Text>
          <Text style={richCardStyles.confirmedValue}>{data.business}</Text>
        </View>
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Staff:</Text>
          <Text style={richCardStyles.confirmedValue}>{data.staff}</Text>
        </View>
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Date:</Text>
          <Text style={richCardStyles.confirmedValue}>{data.date}</Text>
        </View>
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Time:</Text>
          <Text style={richCardStyles.confirmedValue}>{data.time}</Text>
        </View>
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Total:</Text>
          <Text style={richCardStyles.confirmedValue}>${data.total.toFixed(2)}</Text>
        </View>
      </View>

      {data.address ? (
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Address:</Text>
          <Text style={richCardStyles.confirmedValue}>{data.address}</Text>
        </View>
      ) : null}

      {data.points_earned > 0 ? (
        <Text style={richCardStyles.confirmedPoints}>+{data.points_earned} pts earned</Text>
      ) : null}

      {(data.address || data.latitude) ? (
        <TouchableOpacity
          style={richCardStyles.directionsBtnCenter}
          onPress={openDirections}
          activeOpacity={0.7}
        >
          <Ionicons name="navigate-outline" size={16} color="#fff" style={{ marginRight: 6 }} />
          <Text style={richCardStyles.directionsBtnText}>Get Directions</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

// ── Rich Card Styles ─────────────────────────────────────────────────────────

const richCardStyles = StyleSheet.create({
  // Business cards
  businessCard: { width: 280, height: 200, borderRadius: 12, backgroundColor: '#fff', marginRight: 10, borderWidth: 1, borderColor: '#e5e7eb', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
  businessImage: { width: 280, height: 100, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  businessImg: { width: 280, height: 100, resizeMode: 'cover' },
  businessEmoji: { fontSize: 24 },
  businessInfo: { padding: 8 },
  businessName: { fontSize: 17, fontWeight: '700', color: '#111827', lineHeight: 21 },
  businessDistance: { fontSize: 15, color: '#6b7280', marginTop: 2 },
  businessDrive: { fontSize: 14, color: '#9ca3af' },
  // Service cards
  serviceCard: { width: 280, borderRadius: 12, backgroundColor: '#fff', marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
  serviceImage: { width: 280, height: 100, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  serviceImg: { width: 280, height: 100, resizeMode: 'cover' },
  serviceEmoji: { fontSize: 24 },
  serviceInfo: { padding: 8 },
  serviceName: { fontSize: 17, fontWeight: '700', color: '#111827', lineHeight: 21 },
  servicePrice: { fontSize: 17, fontWeight: '600', color: '#16a34a', marginTop: 2 },
  serviceDuration: { fontSize: 15, color: '#9ca3af' },
  depositBadge: { backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2, alignSelf: 'flex-start' },
  depositText: { fontSize: 13, color: '#92400e', fontWeight: '600' },
  // Staff cards (circle + name, no card background)
  staffCard: { width: 90, marginRight: 16, alignItems: 'center' },
  staffAvatar: { width: 64, height: 64, borderRadius: 32, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  staffAvatarImg: { width: 64, height: 64, borderRadius: 32 },
  staffInitials: { color: '#fff', fontSize: 18, fontWeight: '700' },
  staffName: { fontSize: 14, fontWeight: '600', color: '#111827', marginTop: 6, textAlign: 'center' },
  staffSlots: { fontSize: 13, color: '#9ca3af', marginTop: 2, textAlign: 'center' },
  // Package cards
  packageCard: { width: 130, height: 150, borderRadius: 12, backgroundColor: '#fff', marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
  packageImage: { width: 130, height: 65, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
  packageImg: { width: 130, height: 65, resizeMode: 'cover' },
  packageEmoji: { fontSize: 24 },
  packageInfo: { padding: 6 },
  packageName: { fontSize: 13, fontWeight: '700', color: '#111827', lineHeight: 16 },
  packagePrice: { fontSize: 13, fontWeight: '600', color: '#6B7FC4', marginTop: 2 },
  packageCount: { fontSize: 11, color: '#9ca3af' },
  packageSessions: { fontSize: 12, fontWeight: '600', color: '#16a34a', marginTop: 2 },
  ownedBadge: { backgroundColor: '#dcfce7', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, alignSelf: 'flex-start', marginBottom: 2 },
  ownedBadgeText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },
  // Extras grid
  extrasContainer: { marginVertical: 6 },
  extrasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  extrasChip: { width: '47%', backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', padding: 14, minHeight: 70, justifyContent: 'center' as const },
  extrasChipSelected: { borderColor: '#6B7FC4', backgroundColor: '#eef2ff' },
  extrasChipName: { fontSize: 14, fontWeight: '700', color: '#374151' },
  extrasChipNameSelected: { color: '#4338ca' },
  extrasChipDetail: { fontSize: 12, color: '#9ca3af', marginTop: 4 },
  extrasChipDetailSelected: { color: '#6B7FC4' },
  extrasDoneBtn: { backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
  extrasDoneBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // Summary card
  summaryCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
  summaryLabel: { fontSize: 14, color: '#374151', marginBottom: 4 },
  summaryBold: { fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryRowLabel: { fontSize: 13, color: '#6b7280' },
  summaryRowValue: { fontSize: 13, color: '#374151', fontWeight: '500' },
  summaryTotal: { fontSize: 18, fontWeight: '700', color: '#111827' },
  summaryDeposit: { fontSize: 12, color: '#92400e', marginTop: 4 },
  summaryPoints: { fontSize: 13, fontWeight: '600', color: '#d97706', marginTop: 4 },
  divider: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 12 },
  confirmBtn: { backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  changeBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#6B7FC4', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  changeBtnText: { color: '#6B7FC4', fontSize: 14, fontWeight: '600' },
  // Confirmed card
  confirmedCard: { backgroundColor: '#EBF0FA', borderRadius: 16, padding: 20, alignItems: 'center' },
  confirmedCheck: { fontSize: 40 },
  confirmedCheckCircle: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center', marginBottom: 4 },
  confirmedTitle: { fontSize: 20, fontWeight: '700', color: '#111827', marginTop: 4, marginBottom: 8 },
  confirmedRow: { flexDirection: 'row', marginBottom: 5, width: '100%' },
  confirmedLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginRight: 4 },
  confirmedValue: { fontSize: 14, color: '#111827', flexShrink: 1 },
  confirmedPoints: { fontSize: 13, fontWeight: '600', color: '#6B7FC4', marginTop: 8 },
  directionsBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  directionsBtnCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 12, paddingHorizontal: 20, alignSelf: 'center', width: '80%' },
  directionsBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  confirmedDivider: { borderTopWidth: 1, borderTopColor: '#d1d5db', marginVertical: 12, width: '100%' },
  confirmedActions: { flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' },
  confirmedActionBtn: { flex: 1, backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  confirmedActionBtnSecondary: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: '#6B7FC4' },
  confirmedActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  confirmedActionTextSecondary: { color: '#6B7FC4' },
});

const combinedStyles = StyleSheet.create({
  // Service cards (horizontal scroll) below business cards
  serviceCardLg: { width: 210, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 12, marginRight: 10 },
  serviceCardLgSelected: { borderColor: '#6B7FC4', backgroundColor: '#eef2ff' },
  serviceCardLgName: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  serviceCardLgNameSelected: { color: '#4338ca' },
  serviceCardLgRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  serviceCardLgLeft: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  serviceCardLgPrice: { fontSize: 15, fontWeight: '700', color: '#6B7FC4' },
  serviceCardLgPriceSelected: { color: '#4338ca' },
  serviceCardLgDuration: { fontSize: 12, color: '#9ca3af' },
  serviceCardLgDurationSelected: { color: '#6B7FC4' },
  serviceCardLgDepositText: { fontSize: 11, color: '#9ca3af' },
  // Legacy service chips (kept for compat)
  serviceChipsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingHorizontal: 2 },
  serviceChip: { backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', paddingHorizontal: 12, paddingVertical: 8 },
  serviceChipName: { fontSize: 14, fontWeight: '600', color: '#374151' },
  serviceChipDetail: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  // Time slots below staff cards
  slotsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingHorizontal: 2 },
  slotChip: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#6B7FC4', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8, alignItems: 'center' as const },
  slotChipText: { fontSize: 14, fontWeight: '600', color: '#6B7FC4' },
  slotChipUnavailable: { borderColor: '#e5e7eb', backgroundColor: '#f9fafb', opacity: 0.6 },
  slotChipTextUnavailable: { color: '#d1d5db', textDecorationLine: 'line-through' as const },
  slotStaffLabel: { fontSize: 11, color: '#9ca3af', marginTop: 1 },
  // Booking options (packages + extras combined)
  bookingOptionsContainer: { marginVertical: 6 },
  sectionLabel: { fontSize: 13, fontWeight: '600', color: '#6b7280', marginBottom: 6, marginTop: 4 },
  packageChip: { width: 160, backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#e5e7eb', paddingHorizontal: 14, paddingVertical: 12, marginRight: 10, justifyContent: 'center' as const },
  packageChipSelected: { borderColor: '#6B7FC4', backgroundColor: '#eef2ff' },
  packageChipName: { fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 4 },
  packageChipNameSelected: { color: '#4338ca' },
  packageChipDetail: { fontSize: 13, color: '#9ca3af', marginTop: 2 },
  packageChipDetailSelected: { color: '#6B7FC4' },
});

// ── Landing Screen Styles ───────────────────────────────────────────────────

const landingStyles = StyleSheet.create({
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  categoryChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 11,
  },
  categoryChipText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
  },
});

// ── Action Button ───────────────────────────────────────────────────────────

function ActionButton({ label, onPress }: { label: string; onPress: (label: string) => void }) {
  return (
    <TouchableOpacity
      style={actionBtnStyles.btn}
      onPress={() => onPress(label)}
      activeOpacity={0.7}
    >
      <Text style={actionBtnStyles.text}>{label}</Text>
    </TouchableOpacity>
  );
}

const actionBtnStyles = StyleSheet.create({
  btn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#6B7FC4', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  text: { fontSize: 14, fontWeight: '600', color: '#6B7FC4' },
});

// ── Render a single card segment ─────────────────────────────────────────────

function CardRenderer({ card, onButtonPress, onSubmit }: { card: CardData; onButtonPress: (label: string) => void; onSubmit: (msg: string) => void }) {
  switch (card.type) {
    case 'business_cards':
      return <BusinessCardRow items={card.items} onTap={onButtonPress} />;
    case 'service_cards':
      return <ServiceCardRow items={card.items} onTap={onButtonPress} />;
    case 'staff_cards':
      return <StaffCardRow items={card.items} onTap={onButtonPress} />;
    case 'package_cards':
      return <PackageCardRow items={card.items} onTap={onButtonPress} />;
    case 'extras_grid':
      return <ExtrasGridComponent data={card} onSubmit={onSubmit} />;
    case 'summary_card':
      return <RichSummaryCard data={card} onButtonPress={onButtonPress} />;
    case 'confirmed_card':
      return <RichConfirmedCard data={card} onButtonPress={onButtonPress} />;
    case 'business_with_services':
      return <BusinessWithServicesRow data={card as BusinessWithServicesData} onTap={onButtonPress} />;
    case 'staff_with_slots':
      return <StaffWithSlotsRow data={card as StaffWithSlotsData} onTap={onButtonPress} />;
    case 'booking_options':
      return <BookingOptionsComponent data={card as BookingOptionsData} onSubmit={onSubmit} />;
    default:
      return null;
  }
}

// ── Message Bubble ───────────────────────────────────────────────────────────

function MessageBubble({
  message,
  onButtonPress,
}: {
  message: ChatMessage;
  onButtonPress: (label: string) => void;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(10)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 250, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <Animated.View
        style={[bubbleStyles.wrapper, bubbleStyles.wrapperUser, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
      >
        <View style={[bubbleStyles.bubble, bubbleStyles.bubbleUser]}>
          <Text style={[bubbleStyles.text, bubbleStyles.textUser]}>{message.content}</Text>
        </View>
      </Animated.View>
    );
  }

  // Assistant message — parse for [[CARD:...]] blocks first
  const cleaned = cleanAIMessage(message.content);
  const segments = message.isStreaming ? [] : parseCardBlocks(cleaned);
  const hasCards = segments.some((s) => s.kind === 'card');

  return (
    <Animated.View
      style={[
        bubbleStyles.wrapper,
        bubbleStyles.wrapperAssistant,
        hasCards && { maxWidth: '100%', gap: 10 },
        { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
      ]}
    >
      {message.isStreaming ? (
        <View style={[bubbleStyles.bubble, bubbleStyles.bubbleAssistant, { maxWidth: '88%' }]}>
          {!message.content ? (
            <TypingIndicator />
          ) : (
            <Text style={[bubbleStyles.text, bubbleStyles.textAssistant]}>{cleaned}</Text>
          )}
        </View>
      ) : hasCards ? (
        // Render segments (text + cards interspersed)
        segments.map((seg, i) => {
          if (seg.kind === 'card' && seg.card) {
            return <CardRenderer key={`card-${i}`} card={seg.card} onButtonPress={onButtonPress} onSubmit={onButtonPress} />;
          }
          // Text segment — parse for buttons/links
          const { text, buttons, links } = parseMessageContent(seg.text ?? '');
          return (
            <View key={`seg-${i}`} style={{ maxWidth: '88%' }}>
              {text ? (
                <View style={[bubbleStyles.bubble, bubbleStyles.bubbleAssistant]}>
                  <Text style={[bubbleStyles.text, bubbleStyles.textAssistant]}>
                    {renderFormattedText(text, StyleSheet.flatten([bubbleStyles.text, bubbleStyles.textAssistant]))}
                  </Text>
                </View>
              ) : null}
              {links.length > 0 ? (
                <View style={bubbleStyles.buttonsRow}>
                  {links.map((link, li) => (
                    <TouchableOpacity
                      key={`link-${li}`}
                      style={bubbleStyles.linkButton}
                      onPress={() => Linking.openURL(link.url)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="navigate-outline" size={14} color="#4f46e5" style={{ marginRight: 4 }} />
                      <Text style={bubbleStyles.linkButtonText}>{link.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {buttons.length > 0 ? (
                <View style={bubbleStyles.buttonsRow}>
                  {buttons.map((btn, bi) => (
                    <ActionButton key={`${btn}-${bi}`} label={btn} onPress={onButtonPress} />
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      ) : (
        // No cards — render as normal text bubble with buttons
        (() => {
          const { text, buttons, links } = parseMessageContent(cleaned);
          return (
            <>
              {text ? (
                <View style={[bubbleStyles.bubble, bubbleStyles.bubbleAssistant]}>
                  <Text style={[bubbleStyles.text, bubbleStyles.textAssistant]}>
                    {renderFormattedText(text, StyleSheet.flatten([bubbleStyles.text, bubbleStyles.textAssistant]))}
                  </Text>
                </View>
              ) : null}
              {links.length > 0 ? (
                <View style={bubbleStyles.buttonsRow}>
                  {links.map((link, li) => (
                    <TouchableOpacity
                      key={`link-${li}`}
                      style={bubbleStyles.linkButton}
                      onPress={() => Linking.openURL(link.url)}
                      activeOpacity={0.7}
                    >
                      <Ionicons name="navigate-outline" size={14} color="#4f46e5" style={{ marginRight: 4 }} />
                      <Text style={bubbleStyles.linkButtonText}>{link.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : null}
              {buttons.length > 0 ? (
                <View style={bubbleStyles.buttonsRow}>
                  {buttons.map((btn, bi) => (
                    <ActionButton key={`${btn}-${bi}`} label={btn} onPress={onButtonPress} />
                  ))}
                </View>
              ) : null}
            </>
          );
        })()
      )}
    </Animated.View>
  );
}

const bubbleStyles = StyleSheet.create({
  wrapper: { paddingHorizontal: 12, marginVertical: 3, maxWidth: '88%', flexGrow: 0, flexShrink: 0 },
  wrapperUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  wrapperAssistant: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { backgroundColor: '#6B7FC4', borderBottomRightRadius: 4 },
  bubbleAssistant: { backgroundColor: '#f3f4f6', borderBottomLeftRadius: 4 },
  text: { fontSize: 16, lineHeight: 23 },
  textUser: { color: '#fff' },
  textAssistant: { color: '#111827' },
  buttonsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  linkButton: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eef2ff', borderWidth: 1, borderColor: '#c7d2fe', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 8 },
  linkButtonText: { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
});

// ── Suggestion Chip ──────────────────────────────────────────────────────────

function SuggestionChip({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={chipStyles.chip} onPress={onPress} activeOpacity={0.7}>
      <Text style={chipStyles.chipText}>{label}</Text>
    </TouchableOpacity>
  );
}

const chipStyles = StyleSheet.create({
  chip: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, marginRight: 8, marginBottom: 8 },
  chipText: { fontSize: 15, fontWeight: '500', color: '#6B7FC4' },
});

// ── Main Chat Screen ─────────────────────────────────────────────────────────

export default function ChatScreen() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [sessionId, setSessionId] = useState(() => generateId());
  const [customerName, setCustomerName] = useState<string | null>(null);
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [customerEmail, setCustomerEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userCoords, setUserCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [bookingState, setBookingState] = useState<BookingState>(INITIAL_BOOKING_STATE);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  // Track recently displayed service cards so we can match taps to IDs
  const lastDisplayedServices = useRef<{ id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount?: number; tenantId?: string; tenantName?: string }[]>([]);
  // Stores structured tool data from SSE for deterministic rendering
  const pendingToolData = useRef<{ tool: string; data: Record<string, unknown> } | null>(null);
  // Stores last booking options so we can look up package/extras prices
  const lastBookingOptions = useRef<BookingOptionsData | null>(null);

  const resetConversation = useCallback(() => {
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setSessionId(generateId());
    setBookingState(INITIAL_BOOKING_STATE);
    lastDisplayedServices.current = [];
  }, []);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

  useEffect(() => {
    const fetchCategories = async () => {
      setCategoriesLoading(true);
      const { data } = await supabase
        .from('categories')
        .select('id, name, slug')
        .is('parent_id', null)
        .order('display_order');
      if (data) setCategories(data as { id: string; name: string; slug: string }[]);
      setCategoriesLoading(false);
    };
    fetchCategories();
  }, []);

  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const meta = user.user_metadata as { display_name?: string; phone?: string } | undefined;
        setCustomerName(meta?.display_name ?? user.email ?? null);
        setCustomerPhone(meta?.phone ?? user.phone ?? null);
        setCustomerEmail(user.email ?? null);
        setUserId(user.id);
      }
    };
    fetchUser();

    const fetchLocation = async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          setUserCoords({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        }
      } catch {
        // Location not available
      }
    };
    fetchLocation();
  }, []);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      if (flatListRef.current && messages.length > 0) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }, 100);
  }, [messages.length]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // ── Client-side helpers for Phase 2 ──────────────────────────────────────

  const addAssistantMessage = useCallback((content: string) => {
    const id = `assistant_local_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const msg: ChatMessage = { id, role: 'assistant', content, type: 'text', isStreaming: false };
    setMessages((prev) => [...prev, msg]);
    return id;
  }, []);

  const addUserMessage = useCallback((content: string) => {
    const id = `user_${Date.now()}`;
    const msg: ChatMessage = { id, role: 'user', content, type: 'text' };
    setMessages((prev) => [...prev, msg]);
    return id;
  }, []);

  // Generate date buttons for the next 7 days
  const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // Get all date button labels (Today, Tomorrow, and 14 more days)
  const getDateButtons = useCallback(() => {
    return ['Today', 'Tomorrow', 'Next Week', 'Pick a date'];
  }, []);

  // Get next week's days (starting from the next Monday, or 2 days from now if that's sooner)
  const getNextWeekDays = useCallback(() => {
    const today = new Date();
    const days: string[] = [];
    // Start from 2 days out, show 7 days
    for (let i = 2; i <= 8; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(`${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`);
    }
    return days;
  }, []);

  // Get extended date range (2 weeks out)
  const getPickDateDays = useCallback(() => {
    const today = new Date();
    const days: string[] = [];
    for (let i = 2; i <= 14; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push(`${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`);
    }
    return days;
  }, []);

  // Parse a date button label back to YYYY-MM-DD
  const parseDateLabel = useCallback((label: string): string => {
    const today = new Date();
    if (label === 'Today') {
      return today.toISOString().split('T')[0]!;
    }
    if (label === 'Tomorrow') {
      const d = new Date(today);
      d.setDate(today.getDate() + 1);
      return d.toISOString().split('T')[0]!;
    }
    // Parse "Wed Mar 15" style — search up to 30 days out
    for (let i = 2; i <= 30; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const check = `${DAY_NAMES[d.getDay()]} ${MONTH_NAMES[d.getMonth()]} ${d.getDate()}`;
      if (check === label) return d.toISOString().split('T')[0]!;
    }
    return today.toISOString().split('T')[0]!;
  }, []);

  // Show date picker buttons locally
  const showDatePicker = useCallback(() => {
    const buttons = getDateButtons();
    const buttonMarkup = buttons.map((b) => `[[button:${b}]]`).join('');
    addAssistantMessage(`When would you like your appointment?\n\n${buttonMarkup}`);
  }, [getDateButtons, addAssistantMessage]);

  // Fetch staff + availability from direct API
  const fetchStaffAvailability = useCallback(async (tenantId: string, serviceId: string, date: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/booking/staff-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, serviceId, date, customerId: null, userId }),
      });
      if (!res.ok) {
        addAssistantMessage('Sorry, I could not check availability. Please try again.');
        setIsLoading(false);
        return;
      }
      const data = (await res.json()) as {
        staff: { id: string; name: string; image_url: string | null; available_slots_count: number; slots: { time: string; iso: string }[]; all_slots?: { time: string; iso: string; available: boolean }[] }[];
        anyone_slots: { time: string; iso: string; staff_name: string }[];
        address?: string | null;
        message?: string;
      };

      if (data.message || data.staff.length === 0) {
        addAssistantMessage(data.message || 'No availability found for this date. Please try another date.');
        setIsLoading(false);
        return;
      }

      // Capture address for summary card
      if (data.address) {
        setBookingState((prev) => ({ ...prev, address: data.address! }));
      }

      // Build a staff_with_slots card
      const card: StaffWithSlotsData = {
        type: 'staff_with_slots',
        items: data.staff.map((s) => ({
          type: 'staff_card' as const,
          id: s.id,
          name: s.name,
          image_url: s.image_url ?? undefined,
          available_slots_count: s.available_slots_count,
          slots: s.slots.map((sl) => ({ time: sl.time, iso: sl.iso })),
          all_slots: s.all_slots?.map((sl) => ({ time: sl.time, iso: sl.iso, available: sl.available })),
        })),
        anyone_slots: data.anyone_slots.map((sl) => ({ time: sl.time, iso: sl.iso, staff_name: sl.staff_name })),
      };

      addAssistantMessage(`Here are the available staff and time slots:\n\n[[CARD:${JSON.stringify(card)}]]`);
    } catch {
      addAssistantMessage('Connection error while checking availability. Please try again.');
    }
    setIsLoading(false);
  }, [userId, addAssistantMessage]);

  // Fetch packages + extras from direct API
  const fetchBookingOptions = useCallback(async (tenantId: string, serviceId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/booking/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, serviceId, customerId: null }),
      });
      if (!res.ok) {
        addAssistantMessage('Sorry, I could not load options. Please try again.');
        setIsLoading(false);
        return;
      }
      const data = (await res.json()) as {
        packages: { id: string; name: string; price?: number; image_url?: string; package_services: { quantity: number; services: { name: string } | null }[] }[];
        customer_packages: { id: string; package: { name: string; price: number } | null; sessions: { sessions_remaining: number; services: { name: string } | null }[] }[];
        extras: { id: string; name: string; price: number; duration_minutes: number }[];
      };

      const hasPackages = data.packages.length > 0 || data.customer_packages.length > 0;
      const hasExtras = data.extras.length > 0;

      if (!hasPackages && !hasExtras) {
        // Skip options, go straight to summary
        setIsLoading(false);
        return 'skip';
      }

      const packageCards: PackageCardData[] = [
        ...data.packages.map((p) => ({
          type: 'package_card' as const,
          id: p.id,
          name: p.name,
          image_url: p.image_url,
          price: (p.price as number) ?? 0,
          services_count: p.package_services?.reduce((sum, ps) => sum + ps.quantity, 0) ?? 1,
          service_names: (p.package_services ?? []).map((ps) => ps.services?.name).filter((n): n is string => !!n),
          customer_owned: false,
        })),
        ...data.customer_packages.map((cp) => ({
          type: 'package_card' as const,
          id: cp.id,
          name: cp.package?.name ?? 'Package',
          price: cp.package?.price ?? 0,
          services_count: 0,
          service_names: (cp.sessions ?? []).map((s) => s.services?.name).filter((n): n is string => !!n),
          customer_owned: true,
          sessions_remaining: cp.sessions?.[0]?.sessions_remaining ?? 0,
        })),
      ];

      const card: BookingOptionsData = {
        type: 'booking_options',
        packages: packageCards,
        extras: data.extras,
      };
      lastBookingOptions.current = card;

      addAssistantMessage(`Choose any packages or extras:\n\n[[CARD:${JSON.stringify(card)}]]`);
    } catch {
      addAssistantMessage('Connection error while loading options. Please try again.');
    }
    setIsLoading(false);
    return 'shown';
  }, [addAssistantMessage]);

  // Build and show summary card locally
  const showSummaryCard = useCallback((state: BookingState) => {
    const serviceSubtotal = state.servicePrice ?? 0;
    const extrasTotal = state.extrasTotal;
    const packagePrice = state.packagePrice;
    // If a package is selected, the package replaces the service price
    const subtotal = packagePrice > 0 ? packagePrice : serviceSubtotal;
    const total = subtotal + extrasTotal;

    // Build extras display with prices
    const extrasDisplay = state.selectedExtras.map((name) => {
      const extra = lastBookingOptions.current?.extras.find((e) => e.name === name);
      return extra ? `${name} (+$${extra.price.toFixed(2)})` : name;
    });

    // Format date as human-readable (e.g. "Thursday, March 19, 2026")
    const formatHumanDate = (dateStr: string): string => {
      if (!dateStr) return '';
      const d = new Date(dateStr + 'T12:00:00');
      return d.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    };

    const card: SummaryCardData = {
      type: 'summary_card',
      service: state.serviceName ?? 'Unknown',
      package: state.selectedPackage ? `${state.selectedPackage} ($${packagePrice.toFixed(2)})` : undefined,
      extras: extrasDisplay,
      business: state.tenantName ?? 'Unknown',
      staff: state.staffName ?? 'Anyone',
      date: formatHumanDate(state.date ?? ''),
      time: state.timeSlot ?? '',
      address: state.address ?? '',
      subtotal,
      extras_total: extrasTotal,
      package_discount: 0,
      coupon_discount: 0,
      loyalty_discount: 0,
      total,
      deposit_required: state.depositEnabled ? (state.depositAmount ?? 0) : undefined,
      points_to_earn: 0,
    };
    addAssistantMessage(`Here's your booking summary:\n\n[[CARD:${JSON.stringify(card)}]]`);
  }, [addAssistantMessage]);

  // ── Client-side flow interceptor ──────────────────────────────────────────

  const handleClientSideFlow = useCallback(
    async (userText: string): Promise<boolean> => {
      // Phase 2: intercept deterministic steps and handle locally

      // Check if user selected a service (match against recently displayed cards)
      const serviceAtBusinessMatch = userText.match(/^(.+) at (.+)$/);

      // Match service selection from service_cards (just service name)
      if (!bookingState.serviceId) {
        const matchedService = lastDisplayedServices.current.find((s) => {
          // Match "ServiceName" (from service_cards) or "ServiceName at BusinessName" (from business_with_services)
          if (s.name === userText) return true;
          if (serviceAtBusinessMatch && s.name === serviceAtBusinessMatch[1]?.trim() && s.tenantName === serviceAtBusinessMatch[2]?.trim()) return true;
          return false;
        });

        if (matchedService) {
          addUserMessage(userText);
          const newState: BookingState = {
            ...INITIAL_BOOKING_STATE,
            tenantId: matchedService.tenantId ?? bookingState.tenantId,
            tenantName: matchedService.tenantName ?? bookingState.tenantName,
            serviceId: matchedService.id,
            serviceName: matchedService.name,
            servicePrice: matchedService.price,
            serviceDuration: matchedService.duration_minutes,
            depositEnabled: matchedService.deposit_enabled,
            depositAmount: matchedService.deposit_amount ?? null,
          };
          setBookingState(newState);
          // Show date picker locally — no GPT call needed
          showDatePicker();
          return true;
        }
      }

      // If we have tenantId+serviceId set and no date yet → user may be picking a date
      if (bookingState.serviceId && !bookingState.date) {
        // Handle "Next Week" — expand to individual day buttons
        if (userText === 'Next Week') {
          addUserMessage(userText);
          const days = getNextWeekDays();
          const buttonMarkup = days.map((d) => `[[button:${d}]]`).join('');
          addAssistantMessage(`Pick a day next week:\n\n${buttonMarkup}`);
          return true;
        }
        // Handle "Pick a date" — expand to 2-week range
        if (userText === 'Pick a date') {
          addUserMessage(userText);
          const days = getPickDateDays();
          const buttonMarkup = days.map((d) => `[[button:${d}]]`).join('');
          addAssistantMessage(`Choose a date:\n\n${buttonMarkup}`);
          return true;
        }
        // Handle Today, Tomorrow, or expanded day selection
        const dateButtons = [...getDateButtons(), ...getNextWeekDays(), ...getPickDateDays()];
        if (dateButtons.includes(userText)) {
          const dateStr = parseDateLabel(userText);
          const newState = { ...bookingState, date: dateStr };
          setBookingState(newState);
          addUserMessage(userText);
          fetchStaffAvailability(newState.tenantId!, newState.serviceId!, dateStr);
          return true;
        }
      }

      // If we have date set but no time slot → user is picking a time slot
      // Pattern: "10:00 AM with StaffName" or just "10:00 AM"
      if (bookingState.date && !bookingState.timeSlot) {
        const timeMatch = userText.match(/^(\d{1,2}:\d{2}\s*[AP]M)\s*(?:with\s+(.+))?$/i);
        if (timeMatch) {
          const time = timeMatch[1]!;
          const staffName = timeMatch[2] ?? null;
          const newState = { ...bookingState, timeSlot: time, staffName: staffName || bookingState.staffName };
          setBookingState(newState);
          addUserMessage(userText);

          // Fetch booking options (packages + extras)
          const result = await fetchBookingOptions(newState.tenantId!, newState.serviceId!);
          if (result === 'skip') {
            // No packages or extras — show summary directly
            showSummaryCard(newState);
          }
          return true;
        }
      }

      // If we have time slot set but no package/extras selection yet → user is submitting options
      if (bookingState.timeSlot && bookingState.selectedPackage === null && bookingState.selectedExtras.length === 0) {
        // Check for options submission patterns
        if (userText.startsWith('Package:') || userText.startsWith('Extras:') || userText === 'No packages or extras' || userText === 'Skip') {
          addUserMessage(userText);

          // Parse selections and look up prices from stored booking options
          let selectedPkg: string | null = null;
          let selectedExtraNames: string[] = [];
          let extrasTotal = 0;
          let packagePrice = 0;

          const pkgMatch = userText.match(/Package:\s*(.+?)(?:\.\s*Extras:|$)/);
          if (pkgMatch) {
            selectedPkg = pkgMatch[1]!.trim();
            // Look up package price
            const pkg = lastBookingOptions.current?.packages.find((p) => p.name === selectedPkg);
            if (pkg && !pkg.customer_owned) {
              packagePrice = pkg.price ?? 0;
            }
          }

          const extrasMatch = userText.match(/Extras:\s*(.+)$/);
          if (extrasMatch) {
            selectedExtraNames = extrasMatch[1]!.split(',').map((e) => e.trim());
            // Look up extras prices
            for (const eName of selectedExtraNames) {
              const extra = lastBookingOptions.current?.extras.find((e) => e.name === eName);
              if (extra) extrasTotal += extra.price;
            }
          }

          const newState = {
            ...bookingState,
            selectedPackage: selectedPkg,
            selectedExtras: selectedExtraNames,
            extrasTotal,
            packagePrice,
          };
          setBookingState(newState);
          showSummaryCard(newState);
          return true;
        }
      }

      // Handle "Confirm Booking" from summary card — call booking API directly
      if (userText === 'Confirm Booking' && bookingState.serviceId && bookingState.date && bookingState.timeSlot) {
        addUserMessage(userText);
        setIsLoading(true);
        try {
          const createRes = await fetch(`${API_BASE}/api/booking/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tenantId: bookingState.tenantId,
              serviceId: bookingState.serviceId,
              staffId: bookingState.staffId,
              staffName: bookingState.staffName,
              date: bookingState.date,
              timeSlot: bookingState.timeSlot,
              timeSlotIso: bookingState.timeSlotIso,
              packageName: bookingState.selectedPackage,
              extras: bookingState.selectedExtras,
              userId,
              customerName,
              customerPhone,
              customerEmail,
            }),
          });
          if (!createRes.ok) {
            const errBody = (await createRes.json().catch(() => ({}))) as { error?: string };
            addAssistantMessage(`Sorry, booking failed: ${errBody.error ?? 'Please try again.'}`);
            setIsLoading(false);
            return true;
          }
          const result = (await createRes.json()) as {
            success: boolean;
            service_name: string;
            staff_name: string | null;
            business_name: string;
            date: string;
            time: string;
            address: string;
            total: number;
            latitude?: number;
            longitude?: number;
          };

          // Build extras display with prices for confirmation
          const confirmedExtras = bookingState.selectedExtras.map((name) => {
            const extra = lastBookingOptions.current?.extras.find((e) => e.name === name);
            return extra ? `${name} (+$${extra.price.toFixed(2)})` : name;
          });
          const confirmedPkgLabel = bookingState.selectedPackage && bookingState.packagePrice > 0
            ? `${bookingState.selectedPackage} ($${bookingState.packagePrice.toFixed(2)})`
            : bookingState.selectedPackage ?? undefined;

          const confirmedCard: ConfirmedCardData = {
            type: 'confirmed_card',
            service: result.service_name,
            package: confirmedPkgLabel,
            extras: confirmedExtras,
            business: result.business_name,
            staff: result.staff_name ?? bookingState.staffName ?? 'Anyone',
            date: result.date,
            time: result.time,
            address: result.address,
            total: result.total,
            points_earned: 0,
            latitude: result.latitude,
            longitude: result.longitude,
          };

          addAssistantMessage(`Your booking is confirmed!\n\n[[CARD:${JSON.stringify(confirmedCard)}]]`);
          setBookingState(INITIAL_BOOKING_STATE);
        } catch {
          addAssistantMessage('Connection error while creating booking. Please try again.');
        }
        setIsLoading(false);
        return true;
      }

      return false;
    },
    [bookingState, getDateButtons, parseDateLabel, addUserMessage, addAssistantMessage, fetchStaffAvailability, fetchBookingOptions, showSummaryCard, userId, customerName, customerPhone, customerEmail],
  );

  const sendMessage = useCallback(
    async (text?: string) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || isLoading) return;

      Keyboard.dismiss();
      setInput('');

      // Phase 2: try client-side handling first (deterministic steps)
      const handled = await handleClientSideFlow(trimmed);
      if (handled) return;

      // Strip metadata tags like [category_id:...] from display text
      const displayText = trimmed.replace(/\s*\[category_id:[^\]]*\]/g, '');

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: displayText,
        type: 'text',
      };

      const assistantId = `assistant_${Date.now()}`;
      const assistantMsg: ChatMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        type: 'text',
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMsg, assistantMsg]);
      setIsLoading(true);

      try {
        const body: Record<string, string | number> = { message: trimmed, sessionId };
        if (customerName) body.customerName = customerName;
        if (customerPhone) body.customerPhone = customerPhone;
        if (customerEmail) body.customerEmail = customerEmail;
        if (userId) body.userId = userId;
        if (userCoords) {
          body.userLatitude = userCoords.latitude;
          body.userLongitude = userCoords.longitude;
        }

        console.log('[chat] sending to:', `${API_BASE}/api/chat`);
        console.log('[chat] userCoords:', userCoords);

        const res = await fetch(`${API_BASE}/api/chat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!res.ok) {
          let errMsg = 'Sorry, something went wrong. Please try again.';
          try {
            const errBody = (await res.json()) as { error?: string };
            if (errBody.error) errMsg = `Sorry, something went wrong: ${errBody.error}`;
          } catch {
            // Could not parse error body
          }
          setMessages((prev) =>
            prev.map((m) => m.id === assistantId ? { ...m, content: errMsg, isStreaming: false } : m),
          );
          setIsLoading(false);
          return;
        }

        let fullText = '';

        // Parse SSE lines from response text
        const parseSSELines = (raw: string) => {
          const lines = raw.split('\n');
          for (const line of lines) {
            if (!line.startsWith('data: ')) continue;
            const jsonStr = line.slice(6).trim();
            if (!jsonStr) continue;
            try {
              const event = JSON.parse(jsonStr) as { type: string; content?: string; name?: string; tool?: string; data?: Record<string, unknown> };
              if (event.type === 'text') {
                fullText += event.content ?? '';
              } else if (event.type === 'tool_data') {
                pendingToolData.current = { tool: event.tool ?? '', data: event.data ?? {} };
              } else if (event.type === 'error' && event.content) {
                fullText = `Sorry, something went wrong: ${event.content}`;
              }
            } catch {
              // skip malformed JSON chunks
            }
          }
        };

        // Try streaming with ReadableStream, fall back to res.text()
        const reader = res.body?.getReader?.();
        if (reader) {
          const decoder = new TextDecoder();
          let buffer = '';
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            let chunkText = '';
            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;
              try {
                const event = JSON.parse(jsonStr) as { type: string; content?: string; name?: string; tool?: string; data?: Record<string, unknown> };
                if (event.type === 'text') {
                  fullText += event.content ?? '';
                  chunkText = fullText;
                } else if (event.type === 'tool_data') {
                  pendingToolData.current = { tool: event.tool ?? '', data: event.data ?? {} };
                } else if (event.type === 'error' && event.content) {
                  fullText = `Sorry, something went wrong: ${event.content}`;
                }
              } catch {
                // skip malformed JSON chunks
              }
            }
            if (chunkText) {
              const streamedText = chunkText;
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: streamedText, isStreaming: true }
                    : m,
                ),
              );
            }
          }
        } else {
          // Fallback for environments without ReadableStream (React Native)
          const respText = await res.text();
          parseSSELines(respText);
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: fullText || "I couldn't process that. Please try again.", isStreaming: false }
              : m,
          ),
        );

        // If we received structured tool data from find_businesses, rebuild the
        // business_with_services card from the deterministic server data instead
        // of relying on the AI's non-deterministic formatting. This ensures ALL
        // services are always shown.
        if (pendingToolData.current?.tool === 'find_businesses') {
          const toolData = pendingToolData.current.data as {
            businesses?: {
              id: string;
              name: string;
              image_url?: string;
              logo_url?: string;
              distance_mi?: number;
              estimated_drive_minutes?: number;
              category?: string;
              all_services?: { id: string; name: string; price: number; duration_minutes: number; deposit_enabled?: boolean; deposit_amount?: number; image_url?: string }[];
            }[];
          };
          const businesses = toolData.businesses ?? [];
          if (businesses.length > 0) {
            const cardObj: BusinessWithServicesData = {
              type: 'business_with_services',
              items: businesses.map((b) => ({
                type: 'business_card' as const,
                id: b.id,
                name: b.name,
                image_url: b.image_url || b.logo_url,
                distance_mi: b.distance_mi ?? 0,
                drive_minutes: b.estimated_drive_minutes ?? 0,
                category: b.category ?? '',
                services: (b.all_services ?? []).map((s) => ({
                  id: s.id,
                  name: s.name,
                  price: s.price,
                  duration_minutes: s.duration_minutes,
                  deposit_enabled: s.deposit_enabled,
                  deposit_amount: s.deposit_amount,
                })),
              })),
            };
            // Replace any AI-generated business_with_services card in fullText
            const existingCardRegex = /\[\[CARD:\{[^]*?"type"\s*:\s*"business_with_services"[^]*?\}\]\]/;
            const newCardTag = `[[CARD:${JSON.stringify(cardObj)}]]`;
            if (existingCardRegex.test(fullText)) {
              fullText = fullText.replace(existingCardRegex, newCardTag);
            } else {
              // AI didn't generate a card — append one
              fullText += `\n\n${newCardTag}`;
            }
            // Update the message with the rebuilt card
            setMessages((prev) =>
              prev.map((m) =>
                m.id === assistantId
                  ? { ...m, content: fullText, isStreaming: false }
                  : m,
              ),
            );
            // Capture all services for client-side flow
            const allServices: typeof lastDisplayedServices.current = [];
            for (const biz of cardObj.items) {
              for (const svc of biz.services ?? []) {
                allServices.push({
                  ...svc,
                  deposit_enabled: svc.deposit_enabled ?? false,
                  tenantId: biz.id,
                  tenantName: biz.name,
                });
              }
            }
            lastDisplayedServices.current = allServices;
          }
          pendingToolData.current = null;
        }

        // Phase 2: Extract booking state from GPT response to capture service/business IDs
        try {
          const cardRegex = /\[\[CARD:([\s\S]*?)\]\]/g;
          let cm: RegExpExecArray | null;
          while ((cm = cardRegex.exec(fullText)) !== null) {
            const cardData = JSON.parse(cm[1]!) as { type: string; [key: string]: unknown };

            if (cardData.type === 'service_cards') {
              const items = cardData.items as { id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount?: number }[];
              if (items?.length) {
                const tenantIdFromBody = (body as { tenantId?: string }).tenantId;
                lastDisplayedServices.current = items.map((s) => ({
                  ...s,
                  tenantId: tenantIdFromBody,
                }));
                if (tenantIdFromBody) {
                  setBookingState((prev) => ({ ...prev, tenantId: tenantIdFromBody }));
                }
              }
            }

            if (cardData.type === 'business_with_services') {
              const items = cardData.items as { id: string; name: string; services: { id: string; name: string; price: number; duration_minutes: number; deposit_enabled?: boolean; deposit_amount?: number }[] }[];
              if (items?.length) {
                const allSvcs: typeof lastDisplayedServices.current = [];
                for (const biz of items) {
                  for (const svc of biz.services ?? []) {
                    allSvcs.push({
                      ...svc,
                      deposit_enabled: svc.deposit_enabled ?? false,
                      tenantId: biz.id,
                      tenantName: biz.name,
                    });
                  }
                }
                if (allSvcs.length > lastDisplayedServices.current.length) {
                  lastDisplayedServices.current = allSvcs;
                }
              }
            }
          }
        } catch {
          // Non-critical — state extraction failed silently
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: 'Connection error. Please check your network and try again.', isStreaming: false }
              : m,
          ),
        );
      }

      setIsLoading(false);
    },
    [input, isLoading, sessionId, customerName, customerPhone, customerEmail, userId, userCoords, handleClientSideFlow],
  );

  const handleButtonPress = useCallback(
    (label: string) => { sendMessage(label); },
    [sendMessage],
  );

  const hasMessages = messages.length > 0;

  // Service-type buttons per category slug (Option 2 — horizontal tabs)
  const activeCategories = categories;

  if (!hasMessages) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.welcomeContainer}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <BalkinaLogo size="large" />
              <Text style={styles.subtitle}>What would you like to book today?</Text>
            </View>
            {categoriesLoading ? (
              <ActivityIndicator size="small" color="#6B7FC4" style={{ marginTop: 20 }} />
            ) : (
              <View style={landingStyles.categoriesGrid}>
                {activeCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat.id}
                    style={landingStyles.categoryChip}
                    onPress={() => handleButtonPress(`Find ${cat.name} businesses near me [category_id:${cat.id}]`)}
                    activeOpacity={0.7}
                  >
                    <Text style={landingStyles.categoryChipText}>{cat.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
          <View style={styles.inputBar}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Ask me anything..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={2000}
              editable={!isLoading}
              returnKeyType="send"
              onSubmitEditing={() => sendMessage()}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, (!input.trim() || isLoading) && styles.sendBtnDisabled]}
              onPress={() => sendMessage()}
              disabled={!input.trim() || isLoading}
            >
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <View style={styles.chatHeader}>
          <TouchableOpacity style={styles.resetBtn} onPress={resetConversation} activeOpacity={0.7}>
            <Ionicons name="arrow-back" size={18} color="#6B7FC4" />
            <Text style={styles.resetBtnText}>Start over</Text>
          </TouchableOpacity>
          <BalkinaLogoInline />
          <View style={styles.resetBtnPlaceholder} />
        </View>

        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} onButtonPress={handleButtonPress} />
          )}
          contentContainerStyle={[styles.messagesList, { flexGrow: 1 }]}
          inverted
          keyboardShouldPersistTaps="handled"
          removeClippedSubviews={false}
          windowSize={21}
          maxToRenderPerBatch={20}
          style={styles.flex}
        />

        <View style={styles.inputBar}>
          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder="Ask me anything..."
            placeholderTextColor="#9ca3af"
            multiline
            maxLength={2000}
            editable={!isLoading}
            returnKeyType="send"
            onSubmitEditing={() => sendMessage()}
            blurOnSubmit={false}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!input.trim() || isLoading) && styles.sendBtnDisabled]}
            onPress={() => sendMessage()}
            disabled={!input.trim() || isLoading}
          >
            {isLoading ? (
              <Ionicons name="hourglass-outline" size={18} color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  flex: { flex: 1 },
  welcomeContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  greeting: { fontSize: 34, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 18, color: '#6b7280', marginTop: 20, marginBottom: 28 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  messagesList: { paddingVertical: 4 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 8 },
  textInput: { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#f9fafb', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resetBtnText: { fontSize: 14, fontWeight: '500', color: '#6B7FC4' },
  resetBtnPlaceholder: { width: 90 },
  chatHeaderTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  startOverLink: { marginTop: 16 },
  startOverText: { fontSize: 13, color: '#9ca3af', textDecorationLine: 'underline' },
});
