import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
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
  Modal,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { useKeyboardHeight } from '@/lib/useKeyboardHeight';
import { useStripe } from '@/lib/stripe';
import { supabase } from '@/lib/supabase';
import * as Location from 'expo-location';
import * as SecureStore from 'expo-secure-store';
import PaymentWebViewModal from '@/components/PaymentWebViewModal';
import BalkinaLogo, { BalkinaLogoInline } from '@/components/BalkinaLogo';
import PropertyStorefront, { StorefrontTenant } from '@/components/PropertyStorefront';
import PropertyBookingFlow, { BookingService } from '@/components/PropertyBookingFlow';
import PropertyBusinessPage, { BusinessSummary } from '@/components/PropertyBusinessPage';
import PropertyAccountDrawer from '@/components/PropertyAccountDrawer';
import { Campaign } from '@/components/PropertyCampaignDetail';
import { BookingState, INITIAL_BOOKING_STATE } from '@/lib/chatTypes';
import { consumePendingDeepLinkTenant, parseTenantFromUrl } from '@/lib/deepLink';
import { formatPrice, currencySymbol } from '@/lib/currency';
import {
  getDateButtons,
  getNextWeekDays,
  getPickDateDays,
  parseDateLabel,
  formatHumanDate,
  getAllDateLabels,
} from '@/lib/useBookingFlow';
import GalleryViewer from '@/components/GalleryViewer';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

const API_BASE = 'https://app.balkina.ai';

import {
  generateId,
  cleanAIMessage,
  parseCardBlocks,
  parseMessageContent,
  nameToColor,
  getInitials,
  type BusinessCardData,
  type GalleryPhoto,
  type ServiceCardData,
  type StaffCardData,
  type PackageCardData,
  type ExtrasGridData,
  type SummaryCardData,
  type ConfirmedCardData,
  type ServiceChipData,
  type BusinessWithServicesData,
  type TimeSlotData,
  type StaffWithSlotsData,
  type BookingOptionsData,
  type CardData,
  type ChatMessage,
} from '@/lib/chatUtils';

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

const BusinessCardRow = React.memo(function BusinessCardRow({ items, onTap }: { items: BusinessCardData[]; onTap: (name: string) => void }) {
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
            {biz.avg_rating ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                <Text style={{ color: '#f59e0b', fontSize: 12 }}>{'★'.repeat(Math.round(biz.avg_rating))}</Text>
                <Text style={{ color: '#9ca3af', fontSize: 11, marginLeft: 3 }}>{biz.avg_rating} ({biz.review_count ?? 0})</Text>
              </View>
            ) : null}
            <Text style={richCardStyles.businessDistance}>{biz.distance_mi} mi  ({biz.drive_minutes} min drive)</Text>
            {biz.subcategory ? (
              <Text style={{ fontSize: 11, color: '#6B7FC4', fontWeight: '600', marginTop: 2 }}>{biz.subcategory}</Text>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
});

// ── Service Card Row ─────────────────────────────────────────────────────────

const ServiceCardRow = React.memo(function ServiceCardRow({ items, onTap, currency: currencyProp }: { items: ServiceCardData[]; onTap: (name: string) => void; currency?: string }) {
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
            <Text style={richCardStyles.servicePrice}>{formatPrice(svc.price, (svc as { currency?: string }).currency ?? currencyProp ?? 'USD')}{svc.pricing_type === 'per_day' ? '/day' : svc.pricing_type === 'per_week' ? '/week' : svc.pricing_type === 'per_person' ? '/guest' : ''}</Text>
            <Text style={richCardStyles.serviceDuration}>{svc.pricing_type === 'per_day' ? 'Full day' : svc.pricing_type === 'per_week' ? 'Full week' : `${svc.duration_minutes} min`}</Text>
            {svc.deposit_enabled && svc.deposit_amount ? (
              <View style={richCardStyles.depositBadge}>
                <Text style={richCardStyles.depositText}>
                  {svc.deposit_type === 'percentage'
                    ? `${formatPrice(svc.price * svc.deposit_amount / 100, (svc as { currency?: string }).currency ?? currencyProp ?? 'USD')} deposit`
                    : `${formatPrice(svc.deposit_amount, (svc as { currency?: string }).currency ?? currencyProp ?? 'USD')} deposit`}
                </Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
});

// ── Business With Services Row (combined card) ──────────────────────────────

const BusinessWithServicesRow = React.memo(function BusinessWithServicesRow({ data, onTap, onGalleryOpen, currency: currencyProp }: { data: BusinessWithServicesData; onTap: (msg: string) => void; onGalleryOpen?: (photos: GalleryPhoto[]) => void; currency?: string }) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [selectedSvcId, setSelectedSvcId] = useState<string | null>(null);
  const selectedBiz = data.items[selectedIdx];
  const cc = (selectedBiz as unknown as { currency?: string })?.currency ?? currencyProp ?? 'USD';
  const services = selectedBiz?.services ?? [];
  const CARD_WIDTH = 280;
  const CARD_MARGIN = 10;
  const SNAP_INTERVAL = CARD_WIDTH + CARD_MARGIN;
  const SIDE_PADDING = (SCREEN_WIDTH - CARD_WIDTH) / 2;

  // Fade + slide-up animation for service cards
  const serviceFade = useRef(new Animated.Value(1)).current;
  const serviceSlide = useRef(new Animated.Value(0)).current;

  // Auto-select business on snap
  const onBusinessScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetX = e.nativeEvent.contentOffset.x;
    const idx = Math.round(offsetX / SNAP_INTERVAL);
    if (idx >= 0 && idx < data.items.length && idx !== selectedIdx) {
      // Fade out, switch, fade in
      Animated.timing(serviceFade, { toValue: 0, duration: 120, useNativeDriver: true }).start(() => {
        setSelectedIdx(idx);
        serviceSlide.setValue(20);
        Animated.parallel([
          Animated.timing(serviceFade, { toValue: 1, duration: 250, useNativeDriver: true }),
          Animated.timing(serviceSlide, { toValue: 0, duration: 250, useNativeDriver: true }),
        ]).start();
      });
    }
  }, [data.items.length, SNAP_INTERVAL, selectedIdx, serviceFade, serviceSlide]);

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
                idx === selectedIdx && { borderColor: '#6B7FC4' },
              ]}
              onPress={() => setSelectedIdx(idx)}
              activeOpacity={0.7}
            >
              <TouchableOpacity
                style={richCardStyles.businessImage}
                activeOpacity={0.8}
                onPress={() => {
                  if (biz.gallery_photos?.length && onGalleryOpen) {
                    onGalleryOpen(biz.gallery_photos);
                  } else {
                    setSelectedIdx(idx);
                  }
                }}
              >
                {biz.image_url ? (
                  <Image source={{ uri: biz.image_url }} style={richCardStyles.businessImg} />
                ) : (
                  <Text style={richCardStyles.businessEmoji}>🏢</Text>
                )}
                {biz.gallery_photos && biz.gallery_photos.length > 0 && (
                  <View style={{ position: 'absolute', bottom: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 10, paddingHorizontal: 7, paddingVertical: 3, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="images-outline" size={12} color="#fff" />
                    <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600', marginLeft: 3 }}>{biz.gallery_photos.length}</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={richCardStyles.businessInfo}>
                <Text style={richCardStyles.businessName} numberOfLines={2}>{biz.name}</Text>
                {biz.avg_rating ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                    <Text style={{ color: '#f59e0b', fontSize: 12 }}>{'★'.repeat(Math.round(biz.avg_rating))}</Text>
                    <Text style={{ color: '#9ca3af', fontSize: 11, marginLeft: 3 }}>{biz.avg_rating} ({biz.review_count ?? 0})</Text>
                  </View>
                ) : null}
                <Text style={richCardStyles.businessDistance}>{biz.distance_mi} mi  ({biz.drive_minutes} min drive)</Text>
                {biz.subcategory ? (
                  <Text style={{ fontSize: 11, color: '#6B7FC4', fontWeight: '600', marginTop: 2 }}>{biz.subcategory}</Text>
                ) : null}
                {biz.description ? (
                  <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }} numberOfLines={2}>{biz.description}</Text>
                ) : null}
              </View>
            </TouchableOpacity>
          )}
        />
      </View>
      {services.length > 0 && selectedBiz ? (
        <Animated.View style={{ opacity: serviceFade, transform: [{ translateY: serviceSlide }] }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginTop: 10 }}>
          {services.map((svc, svcIdx) => {
            const isSelected = selectedSvcId === svc.id;
            return (
              <TouchableOpacity
                key={`${selectedBiz.id}-${svc.id}-${svcIdx}`}
                style={[combinedStyles.serviceCardLg, isSelected && combinedStyles.serviceCardLgSelected]}
                onPress={() => {
                  setSelectedSvcId(svc.id);
                  onTap(`${svc.name} at ${selectedBiz.name}`);
                }}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  {svc.image_url ? (
                    <Image source={{ uri: svc.image_url }} style={{ width: 52, height: 52, borderRadius: 8 }} />
                  ) : (
                    <View style={{ width: 52, height: 52, borderRadius: 8, backgroundColor: '#f3f4f6', justifyContent: 'center', alignItems: 'center' }}>
                      <Ionicons name="briefcase-outline" size={22} color="#9ca3af" />
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={[combinedStyles.serviceCardLgName, isSelected && combinedStyles.serviceCardLgNameSelected]} numberOfLines={1}>{svc.name}</Text>
                    <View style={combinedStyles.serviceCardLgRow}>
                      <Text style={[combinedStyles.serviceCardLgPrice, isSelected && combinedStyles.serviceCardLgPriceSelected]}>{formatPrice(svc.price, cc)}{svc.pricing_type === 'per_day' ? '/day' : svc.pricing_type === 'per_week' ? '/week' : svc.pricing_type === 'per_person' ? '/guest' : ''}</Text>
                      <Text style={[combinedStyles.serviceCardLgDuration, isSelected && combinedStyles.serviceCardLgDurationSelected]}>{svc.pricing_type === 'per_day' ? 'Full day' : svc.pricing_type === 'per_week' ? 'Full week' : `${svc.duration_minutes} min`}</Text>
                    </View>
                    {svc.deposit_enabled && svc.deposit_amount ? (
                      <Text style={combinedStyles.serviceCardLgDepositText}>
                        {svc.deposit_type === 'percentage'
                          ? `(${formatPrice(svc.price * svc.deposit_amount / 100, cc)} deposit)`
                          : `(${formatPrice(svc.deposit_amount, cc)} deposit)`}
                      </Text>
                    ) : null}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
        </Animated.View>
      ) : null}
    </View>
  );
});

// ── Staff Card Row ───────────────────────────────────────────────────────────

const StaffCardRow = React.memo(function StaffCardRow({ items, onTap }: { items: StaffCardData[]; onTap: (name: string) => void }) {
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
});

// ── Staff With Slots Row (combined card) ─────────────────────────────────────

const StaffWithSlotsRow = React.memo(function StaffWithSlotsRow({ data, onTap }: { data: StaffWithSlotsData; onTap: (msg: string) => void }) {
  const staffSelectionOff = data.staff_selection_enabled === false;
  const [selectedIdx, setSelectedIdx] = useState(staffSelectionOff ? -1 : 0);
  // Re-render every 60 seconds so past-time greying stays current
  const [, setTick] = useState(0);
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(interval);
  }, []);
  // -1 means "Anyone" / aggregated view
  const isAnyone = selectedIdx === -1;
  const selectedStaff = isAnyone ? null : data.items[selectedIdx];
  // Use all_slots (with available flag) if present, otherwise fall back to slots (all available)
  const rawSlots: TimeSlotData[] = isAnyone
    ? (data.anyone_slots ?? [])
    : (selectedStaff?.all_slots ?? selectedStaff?.slots?.map((s) => ({ ...s, available: true })) ?? []);

  // Client-side: mark past slots as unavailable (safety net for stale renders)
  const nowMs = Date.now() + 15 * 60000; // 15-min buffer like server
  const slots: TimeSlotData[] = rawSlots.map((s) => {
    if (s.available === false) return s;
    if (s.iso && new Date(s.iso).getTime() < nowMs) return { ...s, available: false };
    return s;
  });

  // Update available_slots_count based on current time (not stale server data)
  const availableCount = slots.filter((s) => s.available !== false).length;

  // Check if ANY staff has available slots
  const totalAvailableAcrossAllStaff = data.items.reduce((sum, staff) => {
    const sSlots = staff.all_slots ?? staff.slots?.map((s) => ({ ...s, available: true })) ?? [];
    return sum + sSlots.filter((s) => {
      if (s.available === false) return false;
      if (s.iso && new Date(s.iso).getTime() < nowMs) return false;
      return true;
    }).length;
  }, 0);
  const anyoneAvailable = (data.anyone_slots ?? []).some((s) => {
    if (s.available === false) return false;
    if (s.iso && new Date(s.iso).getTime() < nowMs) return false;
    return true;
  });
  const noAvailability = totalAvailableAcrossAllStaff === 0 && !anyoneAvailable;

  if (noAvailability) {
    return (
      <View style={{ marginTop: 4, marginBottom: 2, backgroundColor: '#fff', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 1, borderColor: '#f3f4f6' }}>
        <Text style={{ fontSize: 14, color: '#9ca3af' }}>No availability on this date. Try another day.</Text>
      </View>
    );
  }

  return (
    <View style={{ marginTop: 4, marginBottom: 2 }}>
      {!staffSelectionOff && (
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }}>
        {data.items.map((staff, idx) => {
          // Recalculate slot count for this staff based on current time
          const staffRawSlots = staff.all_slots ?? staff.slots?.map((s) => ({ ...s, available: true })) ?? [];
          const staffAvailCount = staffRawSlots.filter((s) => {
            if (s.available === false) return false;
            if (s.iso && new Date(s.iso).getTime() < nowMs) return false;
            return true;
          }).length;
          return (
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
            <View style={[richCardStyles.staffAvatar, { backgroundColor: nameToColor(staff.name ?? 'Staff') }]}>
              {staff.image_url ? (
                <Image source={{ uri: staff.image_url }} style={richCardStyles.staffAvatarImg} />
              ) : (
                <Text style={richCardStyles.staffInitials}>{getInitials(staff.name ?? 'S')}</Text>
              )}
            </View>
            <Text style={richCardStyles.staffName} numberOfLines={1}>{staff.name ?? 'Staff'}</Text>
            <Text style={richCardStyles.staffSlots}>{staffAvailCount} slots</Text>
          </TouchableOpacity>
          );
        })}
        {data.anyone_slots && data.anyone_slots.length > 0 && data.items.length > 1 ? (
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
      )}
      {!staffSelectionOff && <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 6, marginBottom: 2, marginLeft: 4 }}>Select a time</Text>}
      {staffSelectionOff && <Text style={{ fontSize: 13, color: '#6B7FC4', fontWeight: '600', marginBottom: 4, marginLeft: 4 }}>Available times</Text>}
      {slots.length > 0 ? (
        <View style={combinedStyles.slotsContainer}>
          {slots.map((slot, i) => {
            const isAvailable = slot.available !== false;
            const staffLabel = isAnyone ? '' : selectedStaff ? ` with ${selectedStaff.name}` : '';
            const staffIdTag = isAnyone || !selectedStaff ? '' : ` [staff:${selectedStaff.id}]`;
            return (
              <TouchableOpacity
                key={`${slot.time}-${i}`}
                style={[
                  combinedStyles.slotChip,
                  !isAvailable && combinedStyles.slotChipUnavailable,
                ]}
                onPress={() => isAvailable ? onTap(`${slot.time}${staffLabel}${staffIdTag}`) : undefined}
                activeOpacity={isAvailable ? 0.7 : 1}
                disabled={!isAvailable}
              >
                <Text style={[
                  combinedStyles.slotChipText,
                  !isAvailable && combinedStyles.slotChipTextUnavailable,
                ]}>{slot.time}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
    </View>
  );
});

// ── Package Card Row ─────────────────────────────────────────────────────────

const PackageCardRow = React.memo(function PackageCardRow({ items, onTap, currency: cc = 'USD' }: { items: PackageCardData[]; onTap: (name: string) => void; currency?: string }) {
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
                <Text style={richCardStyles.packagePrice}>{formatPrice(pkg.price, cc)}</Text>
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
});

// ── Extras Grid ──────────────────────────────────────────────────────────────

function ExtrasGridComponent({ data, onSubmit, currency: cc = 'USD' }: { data: ExtrasGridData; onSubmit: (msg: string) => void; currency?: string }) {
  console.log('[ExtrasGrid] STANDALONE extras:', data.extras.length, 'names:', data.extras.map(e => e.name));
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
                +{formatPrice(extra.price, cc)} · +{extra.duration_minutes}min
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

function BookingOptionsComponent({ data, onSubmit, currency: currencyProp }: { data: BookingOptionsData; onSubmit: (msg: string) => void; currency?: string }) {
  const cc = currencyProp ?? 'USD';
  const [selectedPackage, setSelectedPackage] = useState<string | null>(null);
  const [extraQuantities, setExtraQuantities] = useState<Map<string, number>>(new Map());

  const toggleExtra = (id: string) => {
    setExtraQuantities(prev => {
      const next = new Map(prev);
      if (next.has(id)) next.delete(id);
      else next.set(id, 1);
      return next;
    });
  };

  const adjustQuantity = (id: string, delta: number, maxQty: number) => {
    setExtraQuantities(prev => {
      const next = new Map(prev);
      const current = next.get(id) ?? 0;
      const newVal = Math.max(0, Math.min(maxQty, current + delta));
      if (newVal === 0) next.delete(id);
      else next.set(id, newVal);
      return next;
    });
  };

  const handleDone = () => {
    const parts: string[] = [];
    if (selectedPackage) {
      parts.push(`Package: ${selectedPackage}`);
    }
    const extraParts: string[] = [];
    for (const [id, qty] of extraQuantities) {
      const extra = data.extras.find(e => e.id === id);
      if (extra) {
        extraParts.push(qty > 1 ? `${extra.name} x${qty}` : extra.name);
      }
    }
    if (extraParts.length > 0) {
      parts.push(`Extras: ${extraParts.join(', ')}`);
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
                    <Text style={[combinedStyles.packageChipDetail, isSelected && combinedStyles.packageChipDetailSelected]}>{formatPrice(pkg.price, cc)}</Text>
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
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: 4 }}>
            {data.extras.map((extra) => {
              const qty = extraQuantities.get(extra.id) ?? 0;
              const isSelected = qty > 0;
              const isItem = extra.type === 'item';
              const maxQty = extra.max_quantity ?? 1;

              return (
                <TouchableOpacity
                  key={extra.id}
                  style={[combinedStyles.packageChip, isSelected && combinedStyles.packageChipSelected]}
                  onPress={() => { if (!isItem || maxQty <= 1) toggleExtra(extra.id); else if (!isSelected) adjustQuantity(extra.id, 1, maxQty); }}
                  activeOpacity={0.7}
                >
                  <Text style={[combinedStyles.packageChipName, isSelected && combinedStyles.packageChipNameSelected]}>{extra.name}</Text>
                  <Text style={[combinedStyles.packageChipDetail, isSelected && combinedStyles.packageChipDetailSelected]}>
                    +{formatPrice(extra.price, cc)}{isItem && extra.unit_label ? `/${extra.unit_label}` : ''}{!isItem ? ` · +${extra.duration_minutes}min` : ''}
                  </Text>
                  {isItem && maxQty > 1 && isSelected && (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 }}>
                      <TouchableOpacity onPress={() => adjustQuantity(extra.id, -1, maxQty)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#e5e7eb', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#374151' }}>−</Text>
                      </TouchableOpacity>
                      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{qty}</Text>
                      <TouchableOpacity onPress={() => adjustQuantity(extra.id, 1, maxQty)} style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#fff' }}>+</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </>
      ) : null}
      <TouchableOpacity style={richCardStyles.extrasDoneBtn} onPress={handleDone} activeOpacity={0.7}>
        <Text style={richCardStyles.extrasDoneBtnText}>
          {selectedPackage || extraQuantities.size > 0 ? 'Continue with selections →' : 'Skip →'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

// ── Summary Card (structured) ────────────────────────────────────────────────

const RichSummaryCard = React.memo(function RichSummaryCard({ data, onButtonPress, currency }: { data: SummaryCardData; onButtonPress: (label: string) => void; currency?: string }) {
  const cc = currency ?? data.currency ?? 'USD';
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
        <Text style={richCardStyles.summaryRowValue}>{formatPrice(data.subtotal, cc)}</Text>
      </View>
      {data.extras_total > 0 ? (
        <View style={richCardStyles.summaryRow}>
          <Text style={richCardStyles.summaryRowLabel}>Extras</Text>
          <Text style={richCardStyles.summaryRowValue}>+{formatPrice(data.extras_total, cc)}</Text>
        </View>
      ) : null}
      {data.package_discount > 0 ? (
        <View style={richCardStyles.summaryRow}>
          <Text style={richCardStyles.summaryRowLabel}>Package discount</Text>
          <Text style={[richCardStyles.summaryRowValue, { color: '#16a34a' }]}>-{formatPrice(data.package_discount, cc)}</Text>
        </View>
      ) : null}
      {data.coupon_discount > 0 ? (
        <View style={richCardStyles.summaryRow}>
          <Text style={richCardStyles.summaryRowLabel}>Coupon</Text>
          <Text style={[richCardStyles.summaryRowValue, { color: '#16a34a' }]}>-{formatPrice(data.coupon_discount, cc)}</Text>
        </View>
      ) : null}
      {data.loyalty_discount > 0 ? (
        <View style={richCardStyles.summaryRow}>
          <Text style={richCardStyles.summaryRowLabel}>Loyalty</Text>
          <Text style={[richCardStyles.summaryRowValue, { color: '#16a34a' }]}>-{formatPrice(data.loyalty_discount, cc)}</Text>
        </View>
      ) : null}

      <View style={richCardStyles.divider} />

      <View style={richCardStyles.summaryRow}>
        <Text style={richCardStyles.summaryTotal}>Total</Text>
        <Text style={richCardStyles.summaryTotal}>{formatPrice(data.total, cc)}</Text>
      </View>
      {data.deposit_required != null && data.deposit_required > 0 ? (
        <Text style={richCardStyles.summaryDeposit}>Deposit required: {formatPrice(data.deposit_required, cc)}</Text>
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
});

// ── Confirmed Card (structured) ──────────────────────────────────────────────

const RichConfirmedCard = React.memo(function RichConfirmedCard({ data, onButtonPress, currency }: { data: ConfirmedCardData; onButtonPress: (label: string) => void; currency?: string }) {
  const cc = currency ?? data.currency ?? 'USD';
  const openDirections = () => {
    let dest: string | null = null;
    if (data.latitude && data.longitude) {
      dest = `${data.latitude},${data.longitude}`;
    } else if (data.address) {
      dest = encodeURIComponent(data.address);
    }
    if (!dest) return;

    const appleUrl = `maps://maps.apple.com/?daddr=${dest}`;
    const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;

    if (Platform.OS === 'android') {
      Linking.openURL(googleUrl);
      return;
    }

    Alert.alert('Open Directions', 'Choose your maps app', [
      { text: 'Apple Maps', onPress: () => Linking.openURL(appleUrl) },
      { text: 'Google Maps', onPress: () => Linking.openURL(googleUrl) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const displayService = data.package || data.service;
  const isPending = data.status === 'pending';
  const isCancelled = data.status === 'cancelled';

  return (
    <View style={[richCardStyles.confirmedCard, isPending && { backgroundColor: '#FEF9EE' }, isCancelled && { backgroundColor: '#FEF2F2' }]}>
      <View style={[richCardStyles.confirmedCheckCircle, isPending && { backgroundColor: '#F59E0B' }, isCancelled && { backgroundColor: '#EF4444' }]}>
        <Ionicons name={isCancelled ? 'close' : isPending ? 'time-outline' : 'checkmark'} size={30} color="#fff" />
      </View>
      <Text style={richCardStyles.confirmedTitle}>
        {isCancelled ? 'Appointment Declined' : isPending ? 'Appointment Request Sent' : 'Appointment Confirmed!'}
      </Text>
      {isPending && (
        <Text style={{ fontSize: 13, color: '#92400e', textAlign: 'center', marginBottom: 8, paddingHorizontal: 8 }}>
          Waiting for confirmation from {data.staff}. You{"'"}ll be notified once approved.
        </Text>
      )}
      {isCancelled && (
        <Text style={{ fontSize: 13, color: '#991b1b', textAlign: 'center', marginBottom: 8, paddingHorizontal: 8 }}>
          This appointment request was not approved. Please try another time.
        </Text>
      )}

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
          <Text style={richCardStyles.confirmedValue}>{formatPrice(data.total, cc)}</Text>
        </View>
      </View>

      {data.address ? (
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Address:</Text>
          <Text style={richCardStyles.confirmedValue}>{data.address}</Text>
        </View>
      ) : null}

      {data.deposit_amount && data.deposit_amount > 0 ? (
        <View style={richCardStyles.confirmedRow}>
          <Text style={richCardStyles.confirmedLabel}>Deposit:</Text>
          <Text style={[richCardStyles.confirmedValue, { color: data.deposit_paid ? '#16a34a' : '#dc2626' }]}>
            {formatPrice(data.deposit_amount, cc)} {data.deposit_paid ? '(Paid)' : '(Due)'}
          </Text>
        </View>
      ) : null}

      {data.points_earned > 0 ? (
        <Text style={richCardStyles.confirmedPoints}>+{data.points_earned} pts earned</Text>
      ) : null}

      {data.payment_required && !data.deposit_paid && data.appointmentId ? (
        <TouchableOpacity
          style={{ marginTop: 12, backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20, alignItems: 'center' }}
          onPress={() => onButtonPress(`pay_deposit:${data.appointmentId}:${data.deposit_amount ?? 0}`)}
          activeOpacity={0.7}
        >
          <Text style={{ color: '#fff', fontSize: 15, fontWeight: '600' }}>Pay Deposit ({formatPrice(data.deposit_amount ?? 0, cc)})</Text>
        </TouchableOpacity>
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
});

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
  extrasDoneBtn: { backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 10, width: '100%', alignSelf: 'stretch' },
  extrasDoneBtnText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  // Summary card
  summaryCard: { backgroundColor: '#fff', borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1, width: '100%', alignSelf: 'stretch' },
  summaryLabel: { fontSize: 14, color: '#374151', marginBottom: 4 },
  summaryBold: { fontWeight: '700' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryRowLabel: { fontSize: 13, color: '#6b7280' },
  summaryRowValue: { fontSize: 13, color: '#374151', fontWeight: '500' },
  summaryTotal: { fontSize: 18, fontWeight: '700', color: '#111827' },
  summaryDeposit: { fontSize: 12, color: '#92400e', marginTop: 4 },
  summaryPoints: { fontSize: 13, fontWeight: '600', color: '#d97706', marginTop: 4 },
  divider: { borderTopWidth: 1, borderTopColor: '#e5e7eb', marginVertical: 12 },
  confirmBtn: { backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
  confirmBtnText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  changeBtn: { backgroundColor: '#fff', borderWidth: 1.5, borderColor: '#6B7FC4', borderRadius: 10, paddingVertical: 14, alignItems: 'center', marginTop: 8 },
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
  directionsBtn: { flexDirection: 'row', alignItems: 'center', marginTop: 10, backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 14, alignSelf: 'flex-start' },
  directionsBtnCenter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 14, paddingHorizontal: 20, alignSelf: 'center', width: '80%' },
  directionsBtnText: { fontSize: 14, fontWeight: '600', color: '#fff' },
  confirmedDivider: { borderTopWidth: 1, borderTopColor: '#d1d5db', marginVertical: 12, width: '100%' },
  confirmedActions: { flexDirection: 'row', gap: 10, marginTop: 4, width: '100%' },
  confirmedActionBtn: { flex: 1, backgroundColor: '#6B7FC4', borderRadius: 10, paddingVertical: 14, alignItems: 'center' },
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

function CardRenderer({ card, onButtonPress, onSubmit, onGalleryOpen, currency }: { card: CardData; onButtonPress: (label: string) => void; onSubmit: (msg: string) => void; onGalleryOpen?: (photos: GalleryPhoto[]) => void; currency?: string }) {
  switch (card.type) {
    case 'business_cards':
      return <BusinessCardRow items={card.items} onTap={onButtonPress} />;
    case 'service_cards':
      return <ServiceCardRow items={card.items} onTap={onButtonPress} currency={currency} />;
    case 'staff_cards':
      return <StaffCardRow items={card.items} onTap={onButtonPress} />;
    case 'package_cards':
      return <PackageCardRow items={card.items} onTap={onButtonPress} currency={currency} />;
    case 'extras_grid':
      return <ExtrasGridComponent data={card} onSubmit={onSubmit} currency={currency} />;
    case 'summary_card':
      return <RichSummaryCard data={card} onButtonPress={onButtonPress} currency={currency} />;
    case 'confirmed_card':
      return <RichConfirmedCard data={card} onButtonPress={onButtonPress} currency={currency} />;
    case 'business_with_services':
      return <BusinessWithServicesRow data={card as BusinessWithServicesData} onTap={onButtonPress} onGalleryOpen={onGalleryOpen} currency={currency} />;
    case 'staff_with_slots':
      return <StaffWithSlotsRow data={card as StaffWithSlotsData} onTap={onButtonPress} />;
    case 'booking_options':
      return <BookingOptionsComponent data={card as BookingOptionsData} onSubmit={onSubmit} currency={currency} />;
    default:
      return null;
  }
}

// ── Message Bubble ───────────────────────────────────────────────────────────

const MessageBubble = React.memo(function MessageBubble({
  message,
  onButtonPress,
  onGalleryOpen,
  currency,
  accent,
}: {
  message: ChatMessage;
  onButtonPress: (label: string) => void;
  onGalleryOpen?: (photos: GalleryPhoto[]) => void;
  currency?: string;
  accent?: string;
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
        <View style={[bubbleStyles.bubble, bubbleStyles.bubbleUser, accent ? { backgroundColor: accent } : null]}>
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
        hasCards && { maxWidth: '100%', width: '100%', gap: 10, alignItems: 'stretch' as const },
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
            return <CardRenderer key={`card-${i}`} card={seg.card} onButtonPress={onButtonPress} onSubmit={onButtonPress} onGalleryOpen={onGalleryOpen} currency={currency} />;
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
                      <Ionicons name="navigate-outline" size={14} color="#6B7FC4" style={{ marginRight: 4 }} />
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
                      <Ionicons name="navigate-outline" size={14} color="#6B7FC4" style={{ marginRight: 4 }} />
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
});

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
  linkButtonText: { fontSize: 14, fontWeight: '600', color: '#6B7FC4' },
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
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const tabBarHeight = useBottomTabBarHeight();
  const keyboardHeight = useKeyboardHeight();
  const kbPadding = Platform.OS === 'ios' && keyboardHeight > 0 ? keyboardHeight - tabBarHeight : 0;
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
  // Full-screen confirmation modal state
  const [confirmationModal, setConfirmationModal] = useState<ConfirmedCardData | null>(null);
  // In-app payment WebView modal state
  const [paymentModal, setPaymentModal] = useState<{ appointmentId: string; depositAmount?: number; pendingCard?: ConfirmedCardData } | null>(null);
  const [galleryModal, setGalleryModal] = useState<{ photos: GalleryPhoto[]; initialIndex: number } | null>(null);
  // Track recently displayed service cards so we can match taps to IDs
  const lastDisplayedServices = useRef<{ id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount?: number; deposit_type?: 'fixed' | 'percentage'; pricing_type?: string; currency?: string; tenantId?: string; tenantName?: string; locationId?: string }[]>([]);
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
    setConciergeOpen(false);
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
        // Hospitality is a property-portal-only vertical — keep it out of the
        // global Balkina discovery category grid.
        .neq('business_type', 'hospitality')
        .order('display_order');
      if (data) setCategories(data as { id: string; name: string; slug: string }[]);
      setCategoriesLoading(false);
    };
    fetchCategories();
  }, []);

  // White-label property detection
  const propertySlug = useMemo(() => {
    try {
      const Constants = require('expo-constants').default;
      return Constants.expoConfig?.extra?.propertySlug as string | undefined;
    } catch { return undefined; }
  }, []);

  const [propertyData, setPropertyData] = useState<{
    id: string; name: string; logo_url: string | null; cover_image_url: string | null; welcome_message: string; primary_color: string;
    tenants: { id: string; name: string; logo_url: string | null; cover_image_url: string | null; category: string | null; subcategory: string | null; description: string | null; slug: string | null; avg_rating: number | null; review_count: number | null; featured?: boolean }[];
    campaigns?: Campaign[];
  } | null>(null);
  const [conciergeOpen, setConciergeOpen] = useState(false);
  const conciergeInputRef = useRef<TextInput>(null);
  const [bookingTarget, setBookingTarget] = useState<{ tenantId: string; businessName: string; service: BookingService | null; extras?: string[]; packageName?: string; addOnTotal?: number } | null>(null);
  const [businessTarget, setBusinessTarget] = useState<{ summary: BusinessSummary; initialServiceId?: string } | null>(null);
  const [accountDrawerOpen, setAccountDrawerOpen] = useState(false);
  // True while the white-label property is still loading, so we never flash the
  // generic Balkina welcome before the branded storefront appears.
  const [propertyLoading, setPropertyLoading] = useState<boolean>(!!propertySlug);
  const router = useRouter();

  // Branding shown on the boot loader before propertyData has been fetched.
  const bootBrand = useMemo(() => {
    try {
      const C = require('expo-constants').default;
      return {
        name: C.expoConfig?.extra?.propertyName as string | undefined,
        color: (C.expoConfig?.extra?.primaryColor as string | undefined) ?? '#6B7FC4',
        splash: C.expoConfig?.extra?.splashImageUrl as string | undefined,
      };
    } catch {
      return { name: undefined as string | undefined, color: '#6B7FC4', splash: undefined as string | undefined };
    }
  }, []);

  // Full-bleed loading image. The boot loader runs before /api/properties
  // returns, so we show the value cached from the last launch (SecureStore),
  // falling back to any build-time variant value. Updated on every fetch.
  const [bootSplash, setBootSplash] = useState<string | undefined>(bootBrand.splash);
  // Minimum on-screen time so a freshly-fetched splash (first launch after an
  // upload, before it's cached) is actually perceptible rather than flashing by.
  const [minSplashDone, setMinSplashDone] = useState(false);
  useEffect(() => {
    if (!propertySlug) return;
    let active = true;
    const timer = setTimeout(() => { if (active) setMinSplashDone(true); }, 1200);
    (async () => {
      try {
        const cached = await SecureStore.getItemAsync(`splash_${propertySlug}`);
        if (active && cached) setBootSplash(cached);
      } catch { /* ignore */ }
    })();
    return () => { active = false; clearTimeout(timer); };
  }, [propertySlug]);

  useEffect(() => {
    if (!propertySlug) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/api/properties?slug=${propertySlug}`);
        if (!res.ok) return;
        const data = await res.json();
        setPropertyData({
          id: data.property.id,
          name: data.property.name,
          logo_url: data.property.logo_url,
          cover_image_url: data.property.cover_image_url ?? null,
          welcome_message: data.property.welcome_message ?? 'What would you like to book today?',
          primary_color: data.property.primary_color ?? '#6B7FC4',
          tenants: data.tenants ?? [],
          campaigns: data.campaigns ?? [],
        });
        // Cache the loading image so it shows full-bleed on the next boot.
        const splash = (data.property.splash_image_url as string | null) ?? null;
        if (splash) {
          setBootSplash(splash);
          try { await SecureStore.setItemAsync(`splash_${propertySlug}`, splash); } catch { /* ignore */ }
        } else {
          try { await SecureStore.deleteItemAsync(`splash_${propertySlug}`); } catch { /* ignore */ }
        }
      } catch { /* ignore */ } finally {
        setPropertyLoading(false);
      }
    })();
  }, [propertySlug]);

  // Live-refresh campaigns when the property owner creates/edits one — no app reload.
  useEffect(() => {
    const propId = propertyData?.id;
    if (!propId || !propertySlug) return;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(`campaigns-${propId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'property_campaigns', filter: `property_id=eq.${propId}` }, async () => {
          try {
            const res = await fetch(`${API_BASE}/api/properties?slug=${propertySlug}`);
            const data = await res.json();
            setPropertyData((prev) => (prev ? { ...prev, campaigns: data.campaigns ?? [] } : prev));
          } catch { /* ignore */ }
        })
        .subscribe();
    } catch { /* realtime unavailable */ }
    return () => { if (channel) supabase.removeChannel(channel); };
  }, [propertyData?.id, propertySlug]);

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

  // Realtime subscription: update confirmed cards when appointment status changes
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel('chat-appointment-status')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'appointments',
        },
        (payload) => {
          const updated = payload.new as { id: string; status: string; customer_id?: string };
          // Only process updates for this customer's appointments
          setMessages((prev) =>
            prev.map((msg) => {
              if (!msg.content.includes('confirmed_card')) return msg;
              const cardMatch = msg.content.match(/\[\[CARD:(.*?)\]\]/);
              if (!cardMatch) return msg;
              try {
                const card = JSON.parse(cardMatch[1]) as ConfirmedCardData;
                if (card.appointmentId !== updated.id) return msg;
                if (updated.status !== 'confirmed' && updated.status !== 'cancelled') return msg;
                if (updated.status === card.status) return msg;
                const updatedCard = { ...card, status: updated.status as 'confirmed' | 'pending' | 'cancelled' };
                const newText = updated.status === 'confirmed'
                  ? `Your booking is confirmed!\n\n[[CARD:${JSON.stringify(updatedCard)}]]`
                  : updated.status === 'cancelled'
                    ? `Your appointment was declined.\n\n[[CARD:${JSON.stringify(updatedCard)}]]`
                    : msg.content.replace(cardMatch[0], `[[CARD:${JSON.stringify(updatedCard)}]]`);
                return { ...msg, content: newText };
              } catch {
                return msg;
              }
            }),
          );
        },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userId]);

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

  // Handle deep link: balkina://?tenant=UUID
  const loadDeepLinkTenant = useCallback(async (tenantId: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/booking/businesses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId }),
      });
      const data = await res.json();
      const biz = data?.businesses?.[0];
      if (biz) {
        const svcs = biz.all_services ?? [];
        lastDisplayedServices.current = svcs.map((s: { id: string; name: string; price: number; duration_minutes: number; deposit_enabled?: boolean; deposit_amount?: number | null; deposit_type?: string | null; pricing_type?: string }) => ({
          id: s.id, name: s.name, price: s.price, duration_minutes: s.duration_minutes,
          deposit_enabled: s.deposit_enabled ?? false, deposit_amount: s.deposit_amount ?? null,
          deposit_type: (s.deposit_type as 'fixed' | 'percentage' | undefined) ?? undefined,
          pricing_type: s.pricing_type ?? 'per_service',
          currency: biz.currency ?? 'USD',
          tenantId: biz.id, tenantName: biz.name, locationId: biz.closest_location_id,
        }));
        const card = {
          type: 'business_with_services',
          items: [{
            id: biz.id, name: biz.name, image_url: biz.image_url,
            distance_mi: biz.distance_mi, drive_minutes: biz.estimated_drive_minutes,
            category: biz.category, subcategory: biz.subcategory, description: biz.description, avg_rating: biz.avg_rating, review_count: biz.review_count,
            closest_location_id: biz.closest_location_id, currency: biz.currency ?? 'USD', gallery_photos: biz.gallery_photos ?? [],
            services: svcs.map((s: { id: string; name: string; price: number; duration_minutes: number; deposit_enabled?: boolean; deposit_amount?: number | null; image_url?: string | null; pricing_type?: string }) => ({
              id: s.id, name: s.name, price: s.price, duration_minutes: s.duration_minutes,
              deposit_enabled: s.deposit_enabled, deposit_amount: s.deposit_amount, deposit_type: s.deposit_type, image_url: s.image_url, pricing_type: s.pricing_type, currency: biz.currency ?? 'USD',
            })),
          }],
        };
        addAssistantMessage(`Here's ${biz.name}:\n\n[[CARD:${JSON.stringify(card)}]]`);
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  }, [addAssistantMessage]);

  useEffect(() => {
    const tenantId = consumePendingDeepLinkTenant();
    if (tenantId) loadDeepLinkTenant(tenantId);
  }, [loadDeepLinkTenant]);

  useEffect(() => {
    const sub = Linking.addEventListener('url', ({ url }) => {
      const tenantId = parseTenantFromUrl(url);
      if (tenantId) loadDeepLinkTenant(tenantId);
    });
    return () => sub.remove();
  }, [loadDeepLinkTenant]);

  // Remove stale interactive booking cards when the user changes their selection mid-flow.
  // This prevents old staff_with_slots / booking_options / summary_card messages from
  // appearing alongside new ones, which causes confusing duplicate staff entries.
  const removeStaleBookingCards = useCallback(() => {
    const staleCardTypes = ['staff_with_slots', 'booking_options', 'summary_card'];
    setMessages((prev) =>
      prev.filter((m) => {
        if (m.role !== 'assistant') return true;
        // Check if this message contains an interactive booking card
        for (const cardType of staleCardTypes) {
          if (m.content.includes(`"type":"${cardType}"`) || m.content.includes(`"type": "${cardType}"`)) {
            return false; // Remove this message
          }
        }
        return true;
      }),
    );
  }, []);

  // Show date picker buttons locally
  const showDatePicker = useCallback(() => {
    const buttons = getDateButtons();
    const buttonMarkup = buttons.map((b) => `[[button:${b}]]`).join('');
    addAssistantMessage(`When would you like your appointment?\n\n${buttonMarkup}`);
  }, [addAssistantMessage]);

  // Fetch staff + availability from direct API
  const fetchStaffAvailability = useCallback(async (tenantId: string, serviceId: string, date: string, locationId?: string | null) => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/booking/staff-availability`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tenantId, serviceId, date, locationId: locationId ?? undefined, customerId: null, userId, userLatitude: userCoords?.latitude, userLongitude: userCoords?.longitude }),
      });
      if (!res.ok) {
        addAssistantMessage('Sorry, I could not check availability. Please try again.');
        setIsLoading(false);
        return;
      }
      const data = (await res.json()) as {
        staff: { id: string; name: string; image_url: string | null; available_slots_count: number; slots: { time: string; iso: string }[]; all_slots?: { time: string; iso: string; available: boolean }[] }[];
        anyone_slots: { time: string; iso: string; available: boolean }[];
        staff_selection_enabled?: boolean;
        address?: string | null;
        message?: string;
      };

      if (data.message || data.staff.length === 0) {
        addAssistantMessage(data.message || 'No availability found for this date. Please try another date.');
        setIsLoading(false);
        return;
      }

      const anyoneAvailable = (data.anyone_slots ?? []).some((s: { available: boolean }) => s.available);
      if (!anyoneAvailable && (data.anyone_slots ?? []).length > 0) {
        addAssistantMessage('This service is not available on this day. Please try a different date.');
        setIsLoading(false);
        return;
      }

      // Capture address + staff selection flag for summary card
      setBookingState((prev) => ({
        ...prev,
        ...(data.address ? { address: data.address } : {}),
        staffSelectionEnabled: data.staff_selection_enabled ?? true,
        currency: data.currency ?? 'USD',
      }));

      const staffSelEnabled = data.staff_selection_enabled ?? true;

      // Build a staff_with_slots card
      const card: StaffWithSlotsData = {
        type: 'staff_with_slots',
        items: staffSelEnabled ? data.staff.map((s) => ({
          type: 'staff_card' as const,
          id: s.id,
          name: s.name,
          image_url: s.image_url ?? undefined,
          available_slots_count: s.available_slots_count,
          slots: s.slots.map((sl) => ({ time: sl.time, iso: sl.iso })),
          all_slots: s.all_slots?.map((sl) => ({ time: sl.time, iso: sl.iso, available: sl.available })),
        })) : [],
        anyone_slots: data.anyone_slots.map((sl) => ({ time: sl.time, iso: sl.iso, available: sl.available })),
        staff_selection_enabled: staffSelEnabled,
      };

      addAssistantMessage(`${staffSelEnabled ? 'Here are the available staff and time slots' : 'Here are the available time slots'}:\n\n[[CARD:${JSON.stringify(card)}]]`);
    } catch {
      addAssistantMessage('Connection error while checking availability. Please try again.');
    }
    setIsLoading(false);
  }, [userId, userCoords, addAssistantMessage]);

  // Fetch packages + extras from direct API
  const fetchBookingOptions = useCallback(async (tenantId: string, serviceId: string, currency?: string) => {
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
        extras: { id: string; name: string; price: number; duration_minutes: number; type?: string; max_quantity?: number; unit_label?: string | null }[];
        currency?: string;
      };

      const optionsCurrency = data.currency ?? currency ?? bookingState.currency ?? 'USD';

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
          currency: optionsCurrency,
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
        extras: data.extras.map((e) => ({ ...e, currency: optionsCurrency })),
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
      return extra ? `${name} (+${formatPrice(extra.price, state.currency)})` : name;
    });


    const card: SummaryCardData = {
      type: 'summary_card',
      service: state.serviceName ?? 'Unknown',
      package: state.selectedPackage ? `${state.selectedPackage} (${formatPrice(packagePrice, state.currency)})` : undefined,
      extras: extrasDisplay,
      business: state.tenantName ?? 'Unknown',
      staff: state.staffName ?? (state.staffSelectionEnabled ? 'Anyone' : 'To be assigned'),
      date: formatHumanDate(state.date ?? ''),
      time: (state.pricingType === 'per_day' || state.pricingType === 'per_week') ? 'Full day' : (state.timeSlot ?? ''),
      address: state.address ?? '',
      subtotal,
      extras_total: extrasTotal,
      package_discount: 0,
      coupon_discount: 0,
      loyalty_discount: 0,
      total,
      deposit_required: state.depositEnabled && state.depositAmount
        ? (state.depositType === 'percentage'
          ? Math.round(total * state.depositAmount / 100 * 100) / 100
          : state.depositAmount)
        : undefined,
      points_to_earn: 0,
      currency: state.currency,
    };
    addAssistantMessage(`Here's your booking summary:\n\n[[CARD:${JSON.stringify(card)}]]`);
  }, [addAssistantMessage]);

  // ── Client-side flow interceptor ──────────────────────────────────────────

  const handleClientSideFlow = useCallback(
    async (userText: string): Promise<boolean> => {
      // Phase 2: intercept deterministic steps and handle locally

      // ── REST-based category browsing (bypasses OpenAI) ──────────────
      const categoryMatch = userText.match(/\[category_id:([^\]]+)\]/);
      if (categoryMatch) {
        const catId = categoryMatch[1];
        const displayText = userText.replace(/\s*\[category_id:[^\]]*\]/g, '').trim();
        addUserMessage(displayText);
        setIsLoading(true);
        try {
          const res = await fetch(`${API_BASE}/api/booking/businesses`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              categoryId: catId,
              latitude: userCoords?.latitude,
              longitude: userCoords?.longitude,
            }),
          });
          if (!res.ok) {
            addAssistantMessage('Sorry, I could not find businesses in this category. Please try again.');
            setIsLoading(false);
            return true;
          }
          const data = (await res.json()) as {
            businesses: { id: string; name: string; image_url?: string; category?: string; avg_rating?: number; review_count?: number; all_services?: { id: string; name: string; price: number; duration_minutes: number; deposit_enabled?: boolean; deposit_amount?: number | null; deposit_type?: string | null; image_url?: string | null }[]; closest_location_id?: string; distance_mi?: number; estimated_drive_minutes?: number }[];
            total_count: number;
            has_more: boolean;
          };
          if (!data.businesses || data.businesses.length === 0) {
            addAssistantMessage('I didn\'t find any businesses in this category near you. Try a different category or search by city.');
            setIsLoading(false);
            return true;
          }
          // Store services for client-side matching
          const allSvcs: typeof lastDisplayedServices.current = [];
          for (const biz of data.businesses) {
            for (const svc of biz.all_services ?? []) {
              allSvcs.push({ id: svc.id, name: svc.name, price: svc.price, duration_minutes: svc.duration_minutes, deposit_enabled: svc.deposit_enabled ?? false, deposit_amount: svc.deposit_amount ?? null, deposit_type: (svc.deposit_type as 'fixed' | 'percentage' | undefined) ?? undefined, pricing_type: svc.pricing_type ?? 'per_service', currency: biz.currency ?? 'USD', tenantId: biz.id, tenantName: biz.name, locationId: biz.closest_location_id });
            }
          }
          lastDisplayedServices.current = allSvcs;
          // Build business_with_services card
          const card = {
            type: 'business_with_services',
            items: data.businesses.map((b: { id: string; name: string; image_url?: string; distance_mi?: number; estimated_drive_minutes?: number; category?: string; subcategory?: string; description?: string; currency?: string; avg_rating?: number; review_count?: number; closest_location_id?: string; gallery_photos?: { id: string; image_url: string; caption?: string | null }[]; all_services?: { id: string; name: string; price: number; duration_minutes: number; deposit_enabled?: boolean; deposit_amount?: number | null; image_url?: string | null; pricing_type?: string }[] }) => ({
              id: b.id,
              name: b.name,
              image_url: b.image_url,
              distance_mi: b.distance_mi,
              drive_minutes: b.estimated_drive_minutes,
              category: b.category,
              subcategory: b.subcategory,
              description: b.description,
              currency: b.currency ?? 'USD',
              avg_rating: b.avg_rating,
              review_count: b.review_count,
              closest_location_id: b.closest_location_id,
              gallery_photos: b.gallery_photos ?? [],
              services: (b.all_services ?? []).map((s) => ({
                id: s.id, name: s.name, price: s.price, duration_minutes: s.duration_minutes,
                deposit_enabled: s.deposit_enabled, deposit_amount: s.deposit_amount, deposit_type: s.deposit_type, image_url: s.image_url, pricing_type: s.pricing_type, currency: b.currency ?? 'USD',
              })),
            })),
          };
          const intro = data.total_count > data.businesses.length
            ? `Here are ${data.businesses.length} of ${data.total_count} businesses near you:`
            : `Here are ${data.businesses.length} businesses near you:`;
          addAssistantMessage(`${intro}\n\n[[CARD:${JSON.stringify(card)}]]${data.has_more ? '\n\n[[button:Show more businesses]]' : ''}`);
        } catch {
          addAssistantMessage('Connection error while finding businesses. Please try again.');
        }
        setIsLoading(false);
        return true;
      }

      // Check if user selected a service (match against recently displayed cards).
      // Always try to match — even if bookingState.serviceId is set (stale closure
      // after a booking resets state async). Starting a new service resets the flow.
      const serviceAtBusinessMatch = userText.match(/^(.+) at (.+)$/);

      {
        const matchedService = lastDisplayedServices.current.find((s) => {
          if (s.name === userText) return true;
          if (serviceAtBusinessMatch && s.name === serviceAtBusinessMatch[1]?.trim() && s.tenantName === serviceAtBusinessMatch[2]?.trim()) return true;
          return false;
        });

        if (matchedService) {
          removeStaleBookingCards();
          addUserMessage(userText);
          const newState: BookingState = {
            ...INITIAL_BOOKING_STATE,
            tenantId: matchedService.tenantId ?? bookingState.tenantId,
            tenantName: matchedService.tenantName ?? bookingState.tenantName,
            locationId: matchedService.locationId ?? bookingState.locationId,
            serviceId: matchedService.id,
            serviceName: matchedService.name,
            servicePrice: matchedService.price,
            serviceDuration: matchedService.duration_minutes,
            depositEnabled: matchedService.deposit_enabled,
            depositAmount: matchedService.deposit_amount ?? null,
            depositType: matchedService.deposit_type ?? null,
            pricingType: matchedService.pricing_type ?? 'per_service',
            currency: matchedService.currency ?? bookingState.currency ?? 'USD',
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
        const dateButtons = getAllDateLabels();
        if (dateButtons.includes(userText)) {
          const dateStr = parseDateLabel(userText);
          addUserMessage(userText);

          // Per-day/week services: validate day availability, then skip slot step
          if (bookingState.pricingType === 'per_day' || bookingState.pricingType === 'per_week') {
            const newState = { ...bookingState, date: dateStr };
            setBookingState(newState);
            setIsLoading(true);
            try {
              const res = await fetch(`${API_BASE}/api/booking/staff-availability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: newState.tenantId, serviceId: newState.serviceId, date: dateStr, locationId: newState.locationId ?? undefined, userId }),
              });
              const data = await res.json() as { staff: unknown[]; anyone_slots?: { available: boolean }[]; message?: string; address?: string | null };
              if (data.message || !data.anyone_slots?.some((s: { available: boolean }) => s.available)) {
                addAssistantMessage(data.message || 'No availability on this date. Please try another day.');
                setIsLoading(false);
                return true;
              }
              if (data.address) setBookingState((prev) => ({ ...prev, address: data.address! }));
              const displayDate = new Date(dateStr + 'T12:00:00Z');
              const timeLabel = displayDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const slotIso = new Date(dateStr + 'T09:00:00Z').toISOString();
              setBookingState((prev) => ({ ...prev, timeSlot: timeLabel, timeSlotIso: slotIso }));
              fetchBookingOptions(newState.tenantId!, newState.serviceId!, newState.currency);
            } catch {
              addAssistantMessage('Connection error. Please try again.');
            }
            setIsLoading(false);
            return true;
          }

          const newState = { ...bookingState, date: dateStr };
          setBookingState(newState);
          fetchStaffAvailability(newState.tenantId!, newState.serviceId!, dateStr, newState.locationId);
          return true;
        }
      }

      // If we have date set but no time slot → user is picking a time slot
      // But also allow changing the date (e.g. user taps "Tomorrow" after seeing "Today" slots)
      if (bookingState.date && !bookingState.timeSlot) {
        // Allow date change: handle day chip clicks to switch dates
        if (userText === 'Next Week') {
          addUserMessage(userText);
          const days = getNextWeekDays();
          const buttonMarkup = days.map((d) => `[[button:${d}]]`).join('');
          addAssistantMessage(`Pick a day next week:\n\n${buttonMarkup}`);
          return true;
        }
        if (userText === 'Pick a date') {
          addUserMessage(userText);
          const days = getPickDateDays();
          const buttonMarkup = days.map((d) => `[[button:${d}]]`).join('');
          addAssistantMessage(`Choose a date:\n\n${buttonMarkup}`);
          return true;
        }
        const dateButtons2 = getAllDateLabels();
        if (dateButtons2.includes(userText)) {
          const dateStr = parseDateLabel(userText);
          addUserMessage(userText);

          if (bookingState.pricingType === 'per_day' || bookingState.pricingType === 'per_week') {
            const newState2 = { ...bookingState, date: dateStr, timeSlot: null, timeSlotIso: null };
            setBookingState(newState2);
            setIsLoading(true);
            try {
              const res2 = await fetch(`${API_BASE}/api/booking/staff-availability`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tenantId: newState2.tenantId, serviceId: newState2.serviceId, date: dateStr, locationId: newState2.locationId ?? undefined, userId }),
              });
              const data2 = await res2.json() as { staff: unknown[]; anyone_slots?: { available: boolean }[]; message?: string; address?: string | null };
              if (data2.message || !data2.anyone_slots?.some((s: { available: boolean }) => s.available)) {
                addAssistantMessage(data2.message || 'No availability on this date. Please try another day.');
                setIsLoading(false);
                return true;
              }
              if (data2.address) setBookingState((prev) => ({ ...prev, address: data2.address! }));
              const displayDate2 = new Date(dateStr + 'T12:00:00Z');
              const timeLabel2 = displayDate2.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
              const slotIso2 = new Date(dateStr + 'T09:00:00Z').toISOString();
              setBookingState((prev) => ({ ...prev, timeSlot: timeLabel2, timeSlotIso: slotIso2 }));
              fetchBookingOptions(newState2.tenantId!, newState2.serviceId!, newState2.currency);
            } catch {
              addAssistantMessage('Connection error. Please try again.');
            }
            setIsLoading(false);
            return true;
          }

          const newState = { ...bookingState, date: dateStr };
          setBookingState(newState);
          fetchStaffAvailability(newState.tenantId!, newState.serviceId!, dateStr, newState.locationId);
          return true;
        }

        // Extract staff ID tag if present, then strip it for the rest of parsing
        const staffIdMatch = userText.match(/\s*\[staff:([a-f0-9-]+)\]\s*$/i);
        const parsedStaffId = staffIdMatch ? staffIdMatch[1]! : null;
        const cleanText = staffIdMatch ? userText.replace(staffIdMatch[0], '') : userText;
        // Pattern: "10:00 AM with StaffName [staff:uuid]" or just "10:00 AM"
        const timeMatch = cleanText.match(/^(\d{1,2}:\d{2}\s*[AP]M)\s*(?:with\s+(.+))?$/i);
        if (timeMatch) {
          const time = timeMatch[1]!;
          const staffName = timeMatch[2] ?? null;
          const newState = {
            ...bookingState,
            timeSlot: time,
            staffName: staffName || bookingState.staffName,
            staffId: parsedStaffId || bookingState.staffId,
          };
          setBookingState(newState);
          addUserMessage(cleanText);

          // Fetch booking options (packages + extras)
          const result = await fetchBookingOptions(newState.tenantId!, newState.serviceId!, newState.currency);
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
              locationId: bookingState.locationId,
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
            appointment_id: string;
            status: 'confirmed' | 'pending';
            service_name: string;
            staff_name: string | null;
            business_name: string;
            date: string;
            time: string;
            address: string;
            total: number;
            latitude?: number;
            longitude?: number;
            deposit_amount?: number;
            deposit_paid?: boolean;
            payment_url?: string;
            payment_client_secret?: string;
            payment_required?: boolean;
          };

          // Build extras display with prices for confirmation
          const confirmedExtras = bookingState.selectedExtras.map((name) => {
            const extra = lastBookingOptions.current?.extras.find((e) => e.name === name);
            return extra ? `${name} (+${formatPrice(extra.price, bookingState.currency)})` : name;
          });
          const confirmedPkgLabel = bookingState.selectedPackage && bookingState.packagePrice > 0
            ? `${bookingState.selectedPackage} (${formatPrice(bookingState.packagePrice, bookingState.currency)})`
            : bookingState.selectedPackage ?? undefined;

          const confirmedCard: ConfirmedCardData = {
            type: 'confirmed_card',
            status: result.status ?? 'confirmed',
            appointmentId: result.appointment_id,
            service: result.service_name,
            package: confirmedPkgLabel,
            extras: confirmedExtras,
            business: result.business_name,
            staff: result.staff_name ?? bookingState.staffName ?? (bookingState.staffSelectionEnabled ? 'Anyone' : 'To be assigned'),
            date: result.date,
            time: result.time,
            address: result.address,
            total: result.total,
            currency: result.currency ?? bookingState.currency ?? 'USD',
            points_earned: 0,
            latitude: result.latitude,
            longitude: result.longitude,
            deposit_amount: result.deposit_amount,
            deposit_paid: result.deposit_paid ?? false,
            payment_url: result.payment_url,
            payment_required: result.payment_required ?? false,
          };

          // If deposit payment is required, try native PaymentSheet first, fall back to in-app WebView
          if (result.payment_required && result.payment_client_secret) {
            const { error: initError } = await initPaymentSheet({
              paymentIntentClientSecret: result.payment_client_secret,
              merchantDisplayName: 'Balkina AI',
              allowsDelayedPaymentMethods: false,
              applePay: { merchantCountryCode: 'US' },
              googlePay: { merchantCountryCode: 'US', testEnv: true },
            });

            if (initError) {
              // Native Stripe unavailable (e.g. Expo Go) — open in-app WebView payment modal.
              // Store the pending card so it shows after payment succeeds.
              setPaymentModal({
                appointmentId: result.appointment_id,
                depositAmount: result.deposit_amount,
                pendingCard: confirmedCard,
              });
              setBookingState(INITIAL_BOOKING_STATE);
              setIsLoading(false);
              return true;
            } else {
              const { error: presentError } = await presentPaymentSheet();

              if (presentError) {
                if (presentError.code !== 'Canceled') {
                  addAssistantMessage(`Payment failed: ${presentError.message}. You can retry from your Bookings tab.`);
                }
                // Continue to show confirmation card with deposit_paid: false
              } else {
                // Payment succeeded — mark deposit as paid in the confirmed card
                confirmedCard.deposit_paid = true;
              }
            }
          }

          // Show full-screen confirmation modal
          setConfirmationModal(confirmedCard);
          setBookingState(INITIAL_BOOKING_STATE);
        } catch {
          addAssistantMessage('Connection error while creating booking. Please try again.');
        }
        setIsLoading(false);
        return true;
      }

      return false;
    },
    [bookingState, addUserMessage, addAssistantMessage, removeStaleBookingCards, fetchStaffAvailability, fetchBookingOptions, showSummaryCard, userId, customerName, customerPhone, customerEmail],
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
        if (propertyData?.id) body.propertyId = propertyData.id;
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
              } else if (event.type === 'debug') {
                console.log(`[DEBUG ${event.tool}]`, JSON.stringify((event as { debug?: unknown }).debug, null, 2));
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
                } else if (event.type === 'debug') {
                  console.log(`[DEBUG ${event.tool}]`, JSON.stringify((event as { debug?: unknown }).debug, null, 2));
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
              avg_rating?: number;
              review_count?: number;
              all_services?: { id: string; name: string; price: number; duration_minutes: number; deposit_enabled?: boolean; deposit_amount?: number; deposit_type?: 'fixed' | 'percentage'; image_url?: string }[];
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
                avg_rating: b.avg_rating,
                review_count: b.review_count ?? 0,
                services: (b.all_services ?? []).map((s) => ({
                  id: s.id,
                  name: s.name,
                  price: s.price,
                  duration_minutes: s.duration_minutes,
                  deposit_enabled: s.deposit_enabled,
                  deposit_amount: s.deposit_amount,
                  deposit_type: s.deposit_type,
                })),
              })),
            };
            // Replace any AI-generated business cards in fullText (both business_cards and business_with_services types)
            const businessCardRegex = /\[\[CARD:\{[^]*?"type"\s*:\s*"business(?:_cards|_with_services)"[^]*?\}\]\]/g;
            const newCardTag = `[[CARD:${JSON.stringify(cardObj)}]]`;
            if (businessCardRegex.test(fullText)) {
              // Reset regex lastIndex after test()
              businessCardRegex.lastIndex = 0;
              // Replace first match, remove any additional matches
              let replaced = false;
              fullText = fullText.replace(businessCardRegex, () => {
                if (!replaced) {
                  replaced = true;
                  return newCardTag;
                }
                return '';
              });
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
              const items = cardData.items as { id: string; name: string; price: number; duration_minutes: number; deposit_enabled: boolean; deposit_amount?: number; deposit_type?: 'fixed' | 'percentage' }[];
              if (items?.length) {
                const tenantIdFromBody = (body as { tenantId?: string }).tenantId;
                // Merge with the authoritative tool data — the AI sometimes echoes a
                // card that drops deposit_type/amount, which would otherwise make a
                // percentage deposit display as a flat dollar amount.
                const prior = lastDisplayedServices.current;
                lastDisplayedServices.current = items.map((s) => {
                  const p = prior.find((x) => x.id === s.id);
                  return {
                    ...p,
                    ...s,
                    deposit_enabled: s.deposit_enabled ?? p?.deposit_enabled ?? false,
                    deposit_amount: s.deposit_amount ?? p?.deposit_amount,
                    deposit_type: s.deposit_type ?? p?.deposit_type,
                    currency: (s as { currency?: string }).currency ?? p?.currency,
                    tenantId: tenantIdFromBody ?? p?.tenantId,
                  };
                });
                if (tenantIdFromBody) {
                  setBookingState((prev) => ({ ...prev, tenantId: tenantIdFromBody }));
                }
              }
            }

            if (cardData.type === 'business_with_services') {
              const items = cardData.items as { id: string; name: string; services: { id: string; name: string; price: number; duration_minutes: number; deposit_enabled?: boolean; deposit_amount?: number; deposit_type?: 'fixed' | 'percentage' }[] }[];
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
    (label: string) => {
      // Intercept pay_deposit commands from confirmed cards
      if (label.startsWith('pay_deposit:')) {
        const parts = label.split(':');
        const appointmentId = parts[1];
        const depositAmount = parseFloat(parts[2] || '0') || undefined;
        if (appointmentId) {
          setPaymentModal({ appointmentId, depositAmount });
        }
        return;
      }
      sendMessage(label);
    },
    [sendMessage],
  );

  const hasMessages = messages.length > 0;

  // Service-type buttons per category slug (Option 2 — horizontal tabs)
  const activeCategories = categories;

  // While a white-label property is still loading, show a property-branded
  // loader rather than flashing the generic Balkina welcome screen.
  // Keep the loader up while fetching, and briefly hold once we have a splash
  // image so it's visible even on the first launch after it was uploaded.
  if (propertySlug && !hasMessages && (propertyLoading || (!minSplashDone && !!bootSplash)) && !(propertyData && minSplashDone)) {
    return (
      <View style={[styles.container, { backgroundColor: bootBrand.color, justifyContent: 'center', alignItems: 'center' }]}>
        {bootSplash ? (
          // Full-bleed branded loading image (property's uploaded splash, cached).
          <Image source={{ uri: bootSplash }} style={StyleSheet.absoluteFill} resizeMode="cover" />
        ) : null}
        {!bootSplash && bootBrand.name ? (
          <Text style={{ fontSize: 26, fontWeight: '700', color: '#fff', letterSpacing: 0.5 }}>
            {bootBrand.name}
          </Text>
        ) : null}
        {!bootSplash ? <ActivityIndicator size="large" color="#fff" style={{ marginTop: bootBrand.name ? 24 : 0 }} /> : null}
      </View>
    );
  }

  // ── White-label property storefront (browse-first, Soho House style) ──
  // Shown before the first concierge message; once a message is sent the
  // standard chat view takes over and drives the booking flow.
  if (propertyData && !hasMessages) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#F7F4EF' }]}>
        <View style={[styles.flex, { paddingBottom: kbPadding }]}>
          <PropertyStorefront
            property={propertyData}
            apiBase={API_BASE}
            isLoggedIn={!!userId}
            onAccountPress={() => setAccountDrawerOpen(true)}
            customer={{ userId, name: customerName, phone: customerPhone, email: customerEmail }}
            onSelectBusiness={(t: StorefrontTenant) =>
              setBusinessTarget({
                summary: {
                  id: t.id, name: t.name, cover_image_url: t.cover_image_url, logo_url: t.logo_url,
                  category: t.category, subcategory: t.subcategory, description: t.description,
                  avg_rating: t.avg_rating, review_count: t.review_count,
                },
              })
            }
            onSelectEvent={(ev, tenantName) => {
              // Experiences open the venue page with the event's detail sheet auto-opened.
              const t = propertyData.tenants.find((x) => x.id === ev.tenant_id);
              setBusinessTarget({
                summary: {
                  id: ev.tenant_id,
                  name: t?.name ?? tenantName ?? propertyData.name,
                  cover_image_url: t?.cover_image_url ?? ev.image_url ?? null,
                  logo_url: t?.logo_url ?? null,
                  category: t?.category ?? null,
                  subcategory: t?.subcategory ?? null,
                  description: t?.description ?? null,
                  avg_rating: t?.avg_rating ?? null,
                  review_count: t?.review_count ?? null,
                },
                initialServiceId: ev.id,
              });
            }}
          />
          <PropertyAccountDrawer
            visible={accountDrawerOpen}
            accent={propertyData.primary_color}
            isLoggedIn={!!userId}
            customerName={customerName}
            customerEmail={customerEmail}
            onClose={() => setAccountDrawerOpen(false)}
            onBookings={() => (userId ? router.navigate('/(app)/bookings') : router.navigate('/(auth)/email-login'))}
            onProfile={() => (userId ? router.navigate('/(app)/profile') : router.navigate('/(auth)/email-login'))}
            onSignIn={() => router.navigate('/(auth)/email-login')}
            onSignOut={() => { void supabase.auth.signOut(); }}
          />
          <PropertyBusinessPage
            visible={!!businessTarget}
            apiBase={API_BASE}
            accent={propertyData.primary_color}
            business={businessTarget?.summary ?? null}
            initialServiceId={businessTarget?.initialServiceId ?? null}
            onClose={() => setBusinessTarget(null)}
            onBook={(service, selection) => {
              // Dismiss the full-screen business page first — iOS cannot reliably
              // present the booking modal on top of another full-screen modal.
              const biz = businessTarget?.summary;
              setBusinessTarget(null);
              setTimeout(
                () => setBookingTarget({
                  tenantId: biz?.id ?? '', businessName: biz?.name ?? '', service,
                  extras: selection.extras, packageName: selection.packageName, addOnTotal: selection.addOnTotal,
                }),
                320,
              );
            }}
          />
          <PropertyBookingFlow
            visible={!!bookingTarget}
            apiBase={API_BASE}
            accent={propertyData.primary_color}
            tenantId={bookingTarget?.tenantId ?? ''}
            businessName={bookingTarget?.businessName ?? ''}
            initialService={bookingTarget?.service ?? null}
            extras={bookingTarget?.extras}
            packageName={bookingTarget?.packageName}
            addOnTotal={bookingTarget?.addOnTotal}
            customer={{ userId, name: customerName, phone: customerPhone, email: customerEmail }}
            onClose={() => setBookingTarget(null)}
          />
          {conciergeOpen ? (
            <View style={styles.inputBar}>
              <View style={{ position: 'relative' }}>
                <TextInput
                  ref={conciergeInputRef}
                  style={styles.textInput}
                  value={input}
                  onChangeText={setInput}
                  placeholder={`Ask the ${propertyData.name} concierge…`}
                  placeholderTextColor="#9ca3af"
                  autoFocus
                  multiline
                  maxLength={2000}
                  editable={!isLoading}
                  blurOnSubmit={false}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: propertyData.primary_color }, (!input.trim() || isLoading) && styles.sendBtnDisabled]}
                  onPress={() => sendMessage()}
                  disabled={!input.trim() || isLoading}
                >
                  <Ionicons name="send" size={18} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          ) : (
            <TouchableOpacity
              style={{
                position: 'absolute', bottom: 24, alignSelf: 'center',
                flexDirection: 'row', alignItems: 'center', gap: 8,
                backgroundColor: propertyData.primary_color,
                paddingHorizontal: 22, paddingVertical: 14, borderRadius: 999,
                shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12,
                shadowOffset: { width: 0, height: 4 }, elevation: 6,
              }}
              activeOpacity={0.9}
              onPress={() => {
                setConciergeOpen(true);
                setTimeout(() => conciergeInputRef.current?.focus(), 50);
              }}
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color="#fff" />
              <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Ask the concierge</Text>
            </TouchableOpacity>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (!hasMessages) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={[styles.flex, { paddingBottom: kbPadding }]}>
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ alignItems: 'center', paddingHorizontal: 24, paddingTop: 60, paddingBottom: 20 }} keyboardShouldPersistTaps="handled">
            {propertyData ? (
              /* White-label property landing */
              <>
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  {propertyData.logo_url ? (
                    <Image source={{ uri: propertyData.logo_url }} style={{ width: 100, height: 100, borderRadius: 20 }} />
                  ) : (
                    <View style={{ width: 100, height: 100, borderRadius: 20, backgroundColor: propertyData.primary_color, justifyContent: 'center', alignItems: 'center' }}>
                      <Text style={{ fontSize: 36, fontWeight: '700', color: '#fff' }}>{propertyData.name.charAt(0)}</Text>
                    </View>
                  )}
                  <Text style={[styles.subtitle, { marginTop: 12, fontSize: 20, fontWeight: '700', color: '#111827' }]}>{propertyData.name}</Text>
                  <Text style={[styles.subtitle, { marginTop: 4 }]}>{propertyData.welcome_message}</Text>
                </View>
                <View style={{ width: '100%', gap: 10 }}>
                  {propertyData.tenants.map((t) => (
                    <TouchableOpacity
                      key={t.id}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#fff', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#f3f4f6' }}
                      onPress={() => handleButtonPress(`Show me services at ${t.name}`)}
                      activeOpacity={0.7}
                    >
                      {t.logo_url ? (
                        <Image source={{ uri: t.logo_url }} style={{ width: 44, height: 44, borderRadius: 10 }} />
                      ) : (
                        <View style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: propertyData.primary_color, justifyContent: 'center', alignItems: 'center' }}>
                          <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{t.name.charAt(0)}</Text>
                        </View>
                      )}
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{t.name}</Text>
                        {t.subcategory ? <Text style={{ fontSize: 11, color: propertyData.primary_color, fontWeight: '600', marginTop: 1 }}>{t.subcategory}</Text> : null}
                        {t.description ? <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 1 }} numberOfLines={1}>{t.description}</Text> : null}
                      </View>
                      <Ionicons name="chevron-forward" size={16} color="#d1d5db" />
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : (
              /* Standard Balkina landing */
              <>
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
              </>
            )}
          </ScrollView>
          <View style={styles.inputBar}>
          <View style={{ position: 'relative' }}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Ask me anything..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={2000}
              editable={!isLoading}
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
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.chatScreenWrapper}>
      <SafeAreaView style={styles.chatScreenSafe}>
        <View style={[styles.flex, { paddingBottom: kbPadding }]}>
          <View style={styles.chatHeader}>
            <TouchableOpacity style={styles.resetBtn} onPress={resetConversation} activeOpacity={0.7}>
              <Ionicons name="arrow-back" size={18} color={propertyData ? propertyData.primary_color : '#6B7FC4'} />
              <Text style={[styles.resetBtnText, propertyData ? { color: propertyData.primary_color } : null]}>
                {propertyData ? 'Back' : 'Start over'}
              </Text>
            </TouchableOpacity>
            {propertyData ? (
              <Text style={styles.chatHeaderTitle} numberOfLines={1}>{propertyData.name}</Text>
            ) : (
              <BalkinaLogoInline />
            )}
            <View style={styles.resetBtnPlaceholder} />
          </View>

          <FlatList
          ref={flatListRef}
          data={[...messages].reverse()}
          extraData={bookingState.currency}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <MessageBubble message={item} onButtonPress={handleButtonPress} onGalleryOpen={(photos) => setGalleryModal({ photos, initialIndex: 0 })} currency={bookingState.currency} accent={propertyData?.primary_color} />
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
          <View style={{ position: 'relative' }}>
            <TextInput
              style={styles.textInput}
              value={input}
              onChangeText={setInput}
              placeholder="Ask me anything..."
              placeholderTextColor="#9ca3af"
              multiline
              maxLength={2000}
              editable={!isLoading}
              blurOnSubmit={false}
            />
            <TouchableOpacity
              style={[styles.sendBtn, propertyData ? { backgroundColor: propertyData.primary_color } : null, (!input.trim() || isLoading) && styles.sendBtnDisabled]}
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
        </View>
        </View>
      </SafeAreaView>

      {/* Full-screen booking confirmation modal */}
      <Modal
        visible={confirmationModal !== null}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={() => {
          setConfirmationModal(null);
          resetConversation();
        }}
      >
        <SafeAreaView style={fullScreenConfirmStyles.container}>
          <View style={fullScreenConfirmStyles.content}>
            {confirmationModal && (
              <>
                <View style={[
                  fullScreenConfirmStyles.iconCircle,
                  confirmationModal.status === 'pending' && { backgroundColor: '#F59E0B' },
                ]}>
                  <Ionicons
                    name={confirmationModal.status === 'pending' ? 'time-outline' : 'checkmark'}
                    size={44}
                    color="#fff"
                  />
                </View>
                <Text style={fullScreenConfirmStyles.title}>
                  {confirmationModal.status === 'pending' ? 'Appointment Request Sent' : 'Appointment Confirmed!'}
                </Text>
                {confirmationModal.status === 'pending' && (
                  <Text style={fullScreenConfirmStyles.subtitle}>
                    Waiting for confirmation from {confirmationModal.staff}. You{"'"}ll be notified once approved.
                  </Text>
                )}

                <View style={fullScreenConfirmStyles.detailsCard}>
                  <View style={fullScreenConfirmStyles.detailRow}>
                    <Ionicons name="cut-outline" size={18} color="#6B7FC4" />
                    <Text style={fullScreenConfirmStyles.detailLabel}>Service</Text>
                    <Text style={fullScreenConfirmStyles.detailValue}>{confirmationModal.package || confirmationModal.service}</Text>
                  </View>
                  {confirmationModal.extras.length > 0 && (
                    <View style={fullScreenConfirmStyles.detailRow}>
                      <Ionicons name="add-circle-outline" size={18} color="#6B7FC4" />
                      <Text style={fullScreenConfirmStyles.detailLabel}>Extras</Text>
                      <Text style={fullScreenConfirmStyles.detailValue}>{confirmationModal.extras.join(', ')}</Text>
                    </View>
                  )}
                  <View style={fullScreenConfirmStyles.detailRow}>
                    <Ionicons name="storefront-outline" size={18} color="#6B7FC4" />
                    <Text style={fullScreenConfirmStyles.detailLabel}>Business</Text>
                    <Text style={fullScreenConfirmStyles.detailValue}>{confirmationModal.business}</Text>
                  </View>
                  <View style={fullScreenConfirmStyles.detailRow}>
                    <Ionicons name="person-outline" size={18} color="#6B7FC4" />
                    <Text style={fullScreenConfirmStyles.detailLabel}>Staff</Text>
                    <Text style={fullScreenConfirmStyles.detailValue}>{confirmationModal.staff}</Text>
                  </View>
                  <View style={fullScreenConfirmStyles.detailRow}>
                    <Ionicons name="calendar-outline" size={18} color="#6B7FC4" />
                    <Text style={fullScreenConfirmStyles.detailLabel}>Date</Text>
                    <Text style={fullScreenConfirmStyles.detailValue}>{confirmationModal.date}</Text>
                  </View>
                  <View style={fullScreenConfirmStyles.detailRow}>
                    <Ionicons name="time-outline" size={18} color="#6B7FC4" />
                    <Text style={fullScreenConfirmStyles.detailLabel}>Time</Text>
                    <Text style={fullScreenConfirmStyles.detailValue}>{confirmationModal.time}</Text>
                  </View>
                  <View style={fullScreenConfirmStyles.divider} />
                  <View style={fullScreenConfirmStyles.detailRow}>
                    <Ionicons name="cash-outline" size={18} color="#6B7FC4" />
                    <Text style={fullScreenConfirmStyles.detailLabel}>Total</Text>
                    <Text style={[fullScreenConfirmStyles.detailValue, { fontWeight: '700', fontSize: 18 }]}>{formatPrice(confirmationModal.total, confirmationModal.currency)}</Text>
                  </View>
                  {confirmationModal.address ? (
                    <View style={fullScreenConfirmStyles.detailRow}>
                      <Ionicons name="location-outline" size={18} color="#6B7FC4" />
                      <Text style={fullScreenConfirmStyles.detailLabel}>Address</Text>
                      <Text style={fullScreenConfirmStyles.detailValue}>{confirmationModal.address}</Text>
                    </View>
                  ) : null}
                  {confirmationModal.deposit_amount && confirmationModal.deposit_amount > 0 ? (
                    <View style={fullScreenConfirmStyles.detailRow}>
                      <Ionicons name="card-outline" size={18} color="#6B7FC4" />
                      <Text style={fullScreenConfirmStyles.detailLabel}>Deposit</Text>
                      <Text style={[fullScreenConfirmStyles.detailValue, { color: confirmationModal.deposit_paid ? '#059669' : '#dc2626', fontWeight: '600' }]}>
                        {formatPrice(confirmationModal.deposit_amount, confirmationModal.currency)} {confirmationModal.deposit_paid ? '(Paid)' : '(Due)'}
                      </Text>
                    </View>
                  ) : null}
                </View>

                {confirmationModal.points_earned > 0 && (
                  <Text style={fullScreenConfirmStyles.pointsBadge}>+{confirmationModal.points_earned} pts earned</Text>
                )}
              </>
            )}
          </View>

          {/* Bottom buttons */}
          <View style={fullScreenConfirmStyles.bottomButtons}>
            {confirmationModal && confirmationModal.payment_required && !confirmationModal.deposit_paid && confirmationModal.appointmentId ? (
              <TouchableOpacity
                style={fullScreenConfirmStyles.doneBtn}
                onPress={() => {
                  // Open in-app WebView payment modal
                  const card = confirmationModal;
                  setConfirmationModal(null);
                  setPaymentModal({
                    appointmentId: card.appointmentId!,
                    depositAmount: card.deposit_amount,
                    pendingCard: card,
                  });
                }}
              >
                <Ionicons name="card-outline" size={18} color="#fff" style={{ marginRight: 8 }} />
                <Text style={fullScreenConfirmStyles.doneBtnText}>Pay Deposit ({formatPrice(confirmationModal.deposit_amount ?? 0, confirmationModal.currency)})</Text>
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={fullScreenConfirmStyles.doneBtn}
              onPress={() => {
                setConfirmationModal(null);
                resetConversation();
              }}
            >
              <Text style={fullScreenConfirmStyles.doneBtnText}>Done</Text>
            </TouchableOpacity>
            {confirmationModal && (confirmationModal.address || confirmationModal.latitude) && (
              <TouchableOpacity
                style={fullScreenConfirmStyles.directionsBtn}
                onPress={() => {
                  const data = confirmationModal;
                  let dest: string | null = null;
                  if (data.latitude && data.longitude) {
                    dest = `${data.latitude},${data.longitude}`;
                  } else if (data.address) {
                    dest = encodeURIComponent(data.address);
                  }
                  if (!dest) return;

                  const appleUrl = `maps://maps.apple.com/?daddr=${dest}`;
                  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${dest}`;

                  if (Platform.OS === 'android') {
                    Linking.openURL(googleUrl);
                    setConfirmationModal(null);
                    resetConversation();
                    return;
                  }

                  Alert.alert('Open Directions', 'Choose your maps app', [
                    { text: 'Apple Maps', onPress: () => { Linking.openURL(appleUrl); setConfirmationModal(null); resetConversation(); } },
                    { text: 'Google Maps', onPress: () => { Linking.openURL(googleUrl); setConfirmationModal(null); resetConversation(); } },
                    { text: 'Cancel', style: 'cancel' },
                  ]);
                }}
              >
                <Ionicons name="navigate-outline" size={18} color="#6B7FC4" style={{ marginRight: 8 }} />
                <Text style={fullScreenConfirmStyles.directionsBtnText}>Get Directions</Text>
              </TouchableOpacity>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* In-app payment WebView modal (fallback when native Stripe unavailable) */}
      {paymentModal && (
        <PaymentWebViewModal
          visible={true}
          appointmentId={paymentModal.appointmentId}
          depositAmount={paymentModal.depositAmount}
          onSuccess={async () => {
            const card = paymentModal.pendingCard;
            const apptId = paymentModal.appointmentId;
            setPaymentModal(null);
            // Verify deposit is marked paid in DB
            try {
              await fetch(`${API_BASE}/api/payments/verify-deposit`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ appointmentId: apptId }),
              });
            } catch { /* best-effort */ }
            if (card) {
              card.deposit_paid = true;
              setConfirmationModal(card);
            }
          }}
          onClose={() => {
            const card = paymentModal.pendingCard;
            setPaymentModal(null);
            if (card) {
              // Show confirmation card with deposit still unpaid
              setConfirmationModal(card);
            }
          }}
        />
      )}

      {/* Gallery Viewer */}
      <GalleryViewer
        visible={galleryModal !== null}
        photos={galleryModal?.photos ?? []}
        initialIndex={galleryModal?.initialIndex ?? 0}
        onClose={() => setGalleryModal(null)}
      />
    </View>
  );
}

const fullScreenConfirmStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  content: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#6B7FC4', justifyContent: 'center', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 26, fontWeight: '800', color: '#111827', marginBottom: 8, textAlign: 'center' },
  subtitle: { fontSize: 14, color: '#92400e', textAlign: 'center', marginBottom: 16, paddingHorizontal: 20 },
  detailsCard: { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20, marginTop: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  detailLabel: { fontSize: 14, fontWeight: '600', color: '#6b7280', marginLeft: 10, width: 70 },
  detailValue: { fontSize: 15, color: '#111827', flex: 1, textAlign: 'right' },
  divider: { height: 1, backgroundColor: '#e5e7eb', marginVertical: 8 },
  pointsBadge: { fontSize: 14, fontWeight: '700', color: '#6B7FC4', marginTop: 16 },
  bottomButtons: { paddingHorizontal: 24, paddingBottom: 20, gap: 12 },
  doneBtn: { backgroundColor: '#6B7FC4', borderRadius: 14, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
  doneBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  directionsBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', borderRadius: 14, paddingVertical: 14, borderWidth: 2, borderColor: '#6B7FC4', backgroundColor: '#fff' },
  directionsBtnText: { color: '#6B7FC4', fontSize: 17, fontWeight: '700' },
});

// ── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#ffffff' },
  chatScreenWrapper: { flex: 1, backgroundColor: '#fff' },
  chatScreenSafe: { flex: 1, backgroundColor: '#ffffff' },
  flex: { flex: 1 },
  welcomeContainer: { flex: 1, justifyContent: 'flex-start', alignItems: 'center', paddingHorizontal: 24, paddingTop: 60 },
  greeting: { fontSize: 34, fontWeight: '700', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 18, color: '#6b7280', marginTop: 20, marginBottom: 28 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  messagesList: { paddingVertical: 4 },
  inputBar: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 6, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#f3f4f6' },
  textInput: { minHeight: 48, maxHeight: 140, backgroundColor: '#f3f4f6', borderRadius: 22, paddingHorizontal: 18, paddingTop: 13, paddingBottom: 13, paddingRight: 50, fontSize: 16, color: '#111827' },
  sendBtn: { position: 'absolute' as const, right: 8, bottom: 8, width: 34, height: 34, borderRadius: 17, backgroundColor: '#6B7FC4', justifyContent: 'center' as const, alignItems: 'center' as const },
  sendBtnDisabled: { opacity: 0.5 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  resetBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  resetBtnText: { fontSize: 14, fontWeight: '500', color: '#6B7FC4' },
  resetBtnPlaceholder: { width: 90 },
  chatHeaderTitle: { fontSize: 16, fontWeight: '600', color: '#111827' },
  startOverLink: { marginTop: 16 },
  startOverText: { fontSize: 13, color: '#9ca3af', textDecorationLine: 'underline' },
});
