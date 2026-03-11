import React, { useState, useRef, useCallback, useEffect } from 'react';
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';

const API_BASE = 'https://balkina-ai.vercel.app';

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

type CardData =
  | { type: 'business_cards'; items: BusinessCardData[] }
  | { type: 'service_cards'; items: ServiceCardData[] }
  | { type: 'staff_cards'; items: StaffCardData[] }
  | { type: 'package_cards'; items: PackageCardData[] }
  | ExtrasGridData
  | SummaryCardData
  | ConfirmedCardData;

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

  return segments.length > 0 ? segments : [{ kind: 'text', text: content }];
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
  const colors = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ef4444', '#14b8a6'];
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
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
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
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

// ── Staff Card Row ───────────────────────────────────────────────────────────

function StaffCardRow({ items, onTap }: { items: StaffCardData[]; onTap: (name: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
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

// ── Package Card Row ─────────────────────────────────────────────────────────

function PackageCardRow({ items, onTap }: { items: PackageCardData[]; onTap: (name: string) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginVertical: 6 }}>
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
                <Text style={richCardStyles.packageCount}>{pkg.services_count} services</Text>
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

// ── Summary Card (structured) ────────────────────────────────────────────────

function RichSummaryCard({ data, onButtonPress }: { data: SummaryCardData; onButtonPress: (label: string) => void }) {
  return (
    <View style={richCardStyles.summaryCard}>
      <Text style={richCardStyles.summaryLabel}><Text style={richCardStyles.summaryBold}>Service:</Text> {data.service}</Text>
      {data.package ? <Text style={richCardStyles.summaryLabel}><Text style={richCardStyles.summaryBold}>Package:</Text> {data.package}</Text> : null}
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
      <TouchableOpacity
        style={richCardStyles.changeBtn}
        onPress={() => onButtonPress('Change something')}
        activeOpacity={0.7}
      >
        <Text style={richCardStyles.changeBtnText}>Change something</Text>
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

  return (
    <View style={richCardStyles.confirmedCard}>
      <Text style={richCardStyles.confirmedCheck}>✅</Text>
      <Text style={richCardStyles.confirmedTitle}>Appointment Confirmed!</Text>

      <View style={{ width: '100%', marginTop: 8 }}>
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Service:</Text>
          <Text style={richCardStyles.confirmedValue}>{data.service}</Text>
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
        <>
          <View style={richCardStyles.confirmedRow}>
            <Text style={richCardStyles.confirmedLabel}>Address:</Text>
            <Text style={richCardStyles.confirmedValue}>{data.address}</Text>
          </View>
          <TouchableOpacity
            style={richCardStyles.directionsBtn}
            onPress={openDirections}
            activeOpacity={0.7}
          >
            <Ionicons name="navigate-outline" size={16} color="#4f46e5" style={{ marginRight: 6 }} />
            <Text style={richCardStyles.directionsBtnText}>📍 Get Directions</Text>
          </TouchableOpacity>
        </>
      ) : null}

      {data.points_earned > 0 ? (
        <Text style={richCardStyles.confirmedPoints}>⭐ +{data.points_earned} pts</Text>
      ) : null}

      <View style={richCardStyles.divider} />

      <View style={richCardStyles.confirmedActions}>
        <TouchableOpacity
          style={richCardStyles.confirmedActionBtn}
          onPress={() => onButtonPress('View My Bookings')}
          activeOpacity={0.7}
        >
          <Text style={richCardStyles.confirmedActionText}>My Bookings</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[richCardStyles.confirmedActionBtn, richCardStyles.confirmedActionBtnSecondary]}
          onPress={() => onButtonPress('Book Another Service')}
          activeOpacity={0.7}
        >
          <Text style={[richCardStyles.confirmedActionText, richCardStyles.confirmedActionTextSecondary]}>New Appointment</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ── Rich Card Styles ─────────────────────────────────────────────────────────

const richCardStyles = StyleSheet.create({
  // Business cards
  businessCard: { width: 120, height: 140, borderRadius: 12, backgroundColor: '#fff', marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
  businessImage: { width: 120, height: 60, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  businessImg: { width: 120, height: 60, resizeMode: 'cover' },
  businessEmoji: { fontSize: 24 },
  businessInfo: { padding: 6, flex: 1 },
  businessName: { fontSize: 13, fontWeight: '700', color: '#111827', lineHeight: 16 },
  businessDistance: { fontSize: 11, color: '#6b7280', marginTop: 2 },
  businessDrive: { fontSize: 11, color: '#9ca3af' },
  // Service cards
  serviceCard: { width: 130, height: 150, borderRadius: 12, backgroundColor: '#fff', marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
  serviceImage: { width: 130, height: 65, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' },
  serviceImg: { width: 130, height: 65, resizeMode: 'cover' },
  serviceEmoji: { fontSize: 24 },
  serviceInfo: { padding: 6, flex: 1 },
  serviceName: { fontSize: 13, fontWeight: '700', color: '#111827', lineHeight: 16 },
  servicePrice: { fontSize: 13, fontWeight: '600', color: '#16a34a', marginTop: 2 },
  serviceDuration: { fontSize: 11, color: '#9ca3af' },
  depositBadge: { backgroundColor: '#fef3c7', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, marginTop: 2, alignSelf: 'flex-start' },
  depositText: { fontSize: 10, color: '#92400e', fontWeight: '600' },
  // Staff cards
  staffCard: { width: 100, height: 120, borderRadius: 12, backgroundColor: '#fff', marginRight: 10, alignItems: 'center', paddingTop: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 },
  staffAvatar: { width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  staffAvatarImg: { width: 50, height: 50, borderRadius: 25 },
  staffInitials: { color: '#fff', fontSize: 18, fontWeight: '700' },
  staffName: { fontSize: 12, fontWeight: '600', color: '#111827', marginTop: 6, textAlign: 'center', paddingHorizontal: 4 },
  staffSlots: { fontSize: 10, color: '#9ca3af', marginTop: 2 },
  // Package cards
  packageCard: { width: 130, height: 150, borderRadius: 12, backgroundColor: '#fff', marginRight: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2, overflow: 'hidden' },
  packageImage: { width: 130, height: 65, backgroundColor: '#eef2ff', justifyContent: 'center', alignItems: 'center' },
  packageImg: { width: 130, height: 65, resizeMode: 'cover' },
  packageEmoji: { fontSize: 24 },
  packageInfo: { padding: 6, flex: 1 },
  packageName: { fontSize: 13, fontWeight: '700', color: '#111827', lineHeight: 16 },
  packagePrice: { fontSize: 13, fontWeight: '600', color: '#6366f1', marginTop: 2 },
  packageCount: { fontSize: 11, color: '#9ca3af' },
  packageSessions: { fontSize: 12, fontWeight: '600', color: '#16a34a', marginTop: 2 },
  ownedBadge: { backgroundColor: '#dcfce7', borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1, alignSelf: 'flex-start', marginBottom: 2 },
  ownedBadgeText: { fontSize: 10, fontWeight: '700', color: '#16a34a' },
  // Extras grid
  extrasContainer: { marginVertical: 6 },
  extrasGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  extrasChip: { width: '47%', backgroundColor: '#fff', borderRadius: 10, borderWidth: 1.5, borderColor: '#e5e7eb', padding: 10 },
  extrasChipSelected: { borderColor: '#6366f1', backgroundColor: '#eef2ff' },
  extrasChipName: { fontSize: 13, fontWeight: '600', color: '#374151' },
  extrasChipNameSelected: { color: '#4338ca' },
  extrasChipDetail: { fontSize: 11, color: '#9ca3af', marginTop: 2 },
  extrasChipDetailSelected: { color: '#6366f1' },
  extrasDoneBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 10 },
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
  confirmBtn: { backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  changeBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#6366f1', borderRadius: 10, paddingVertical: 10, alignItems: 'center', marginTop: 8 },
  changeBtnText: { color: '#6366f1', fontSize: 14, fontWeight: '600' },
  // Confirmed card
  confirmedCard: { backgroundColor: '#f0fdf4', borderRadius: 14, padding: 16, borderWidth: 1, borderColor: '#bbf7d0', alignItems: 'center' },
  confirmedCheck: { fontSize: 32 },
  confirmedTitle: { fontSize: 18, fontWeight: '700', color: '#065f46', marginTop: 4, marginBottom: 4 },
  confirmedRow: { flexDirection: 'row', marginBottom: 4, width: '100%' },
  confirmedLabel: { fontSize: 14, fontWeight: '700', color: '#374151', marginRight: 4 },
  confirmedValue: { fontSize: 14, color: '#374151', flexShrink: 1 },
  confirmedPoints: { fontSize: 13, fontWeight: '600', color: '#d97706', marginTop: 8 },
  directionsBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 8, backgroundColor: '#eef2ff', borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'flex-start' },
  directionsBtnText: { fontSize: 14, fontWeight: '600', color: '#4f46e5' },
  confirmedActions: { flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' },
  confirmedActionBtn: { flex: 1, backgroundColor: '#6366f1', borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  confirmedActionBtnSecondary: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#6366f1' },
  confirmedActionText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  confirmedActionTextSecondary: { color: '#6366f1' },
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
  btn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#6366f1', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 8 },
  text: { fontSize: 14, fontWeight: '600', color: '#6366f1' },
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
      style={[bubbleStyles.wrapper, bubbleStyles.wrapperAssistant, { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }]}
    >
      {message.isStreaming ? (
        <View style={[bubbleStyles.bubble, bubbleStyles.bubbleAssistant]}>
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
            <View key={`seg-${i}`}>
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
  wrapper: { paddingHorizontal: 12, marginVertical: 3, maxWidth: '88%' },
  wrapperUser: { alignSelf: 'flex-end', alignItems: 'flex-end' },
  wrapperAssistant: { alignSelf: 'flex-start', alignItems: 'flex-start' },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  bubbleUser: { backgroundColor: '#6366f1', borderBottomRightRadius: 4 },
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
  chipText: { fontSize: 15, fontWeight: '500', color: '#6366f1' },
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

  const resetConversation = useCallback(() => {
    setMessages([]);
    setInput('');
    setIsLoading(false);
    setSessionId(generateId());
  }, []);

  const flatListRef = useRef<FlatList<ChatMessage>>(null);

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

  const sendMessage = useCallback(
    async (text?: string) => {
      const trimmed = (text ?? input).trim();
      if (!trimmed || isLoading) return;

      Keyboard.dismiss();

      const userMsg: ChatMessage = {
        id: `user_${Date.now()}`,
        role: 'user',
        content: trimmed,
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
      setInput('');
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

        const respText = await res.text();
        let fullText = '';

        const lines = respText.split('\n');
        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          try {
            const event = JSON.parse(jsonStr) as { type: string; content?: string; name?: string };
            if (event.type === 'text') {
              fullText += event.content ?? '';
            } else if (event.type === 'error' && event.content) {
              fullText = `Sorry, something went wrong: ${event.content}`;
            }
          } catch {
            // skip malformed JSON chunks
          }
        }

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: fullText || "I couldn't process that. Please try again.", isStreaming: false }
              : m,
          ),
        );
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
    [input, isLoading, sessionId, customerName, customerPhone, customerEmail, userId, userCoords],
  );

  const handleButtonPress = useCallback(
    (label: string) => { sendMessage(label); },
    [sendMessage],
  );

  const hasMessages = messages.length > 0;

  if (!hasMessages) {
    return (
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
        >
          <View style={styles.welcomeContainer}>
            <Text style={styles.greeting}>Hi there 👋</Text>
            <Text style={styles.subtitle}>What would you like to book today?</Text>
            <View style={styles.chipsContainer}>
              <SuggestionChip label="Book a haircut" onPress={() => handleButtonPress('Book a haircut')} />
              <SuggestionChip label="Find a dentist" onPress={() => handleButtonPress('Find a dentist')} />
              <SuggestionChip label="My appointments" onPress={() => handleButtonPress('My appointments')} />
              <SuggestionChip label="Cancel a booking" onPress={() => handleButtonPress('Cancel a booking')} />
            </View>
            <TouchableOpacity style={styles.startOverLink} onPress={resetConversation} activeOpacity={0.6}>
              <Text style={styles.startOverText}>Start over</Text>
            </TouchableOpacity>
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
            <Ionicons name="arrow-back" size={18} color="#6366f1" />
            <Text style={styles.resetBtnText}>Start over</Text>
          </TouchableOpacity>
          <Text style={styles.chatHeaderTitle}>Balkina AI</Text>
          <View style={styles.resetBtnPlaceholder} />
        </View>

        <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} onButtonPress={handleButtonPress} />
          )}
          contentContainerStyle={styles.messagesList}
          inverted
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
  subtitle: { fontSize: 18, color: '#6b7280', marginBottom: 32 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  messagesList: { paddingVertical: 12 },
  inputBar: { flexDirection: 'row', alignItems: 'flex-end', paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6', gap: 8 },
  textInput: { flex: 1, minHeight: 40, maxHeight: 100, backgroundColor: '#f9fafb', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 16, color: '#111827', borderWidth: 1, borderColor: '#e5e7eb' },
  sendBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center' },
  sendBtnDisabled: { opacity: 0.5 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resetBtnText: { fontSize: 14, fontWeight: '500', color: '#6366f1' },
  resetBtnPlaceholder: { width: 90 },
  chatHeaderTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  startOverLink: { marginTop: 16 },
  startOverText: { fontSize: 13, color: '#9ca3af', textDecorationLine: 'underline' },
});
