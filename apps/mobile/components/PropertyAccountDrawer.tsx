import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Easing,
  Dimensions,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width: SCREEN_W } = Dimensions.get('window');
const DRAWER_W = Math.min(320, SCREEN_W * 0.82);
const INK = '#1A1A1A';
const MUTED = '#6B655C';
const HAIRLINE = '#ECE7DE';

interface Props {
  visible: boolean;
  accent: string;
  isLoggedIn: boolean;
  customerName: string | null;
  customerEmail: string | null;
  /** Resident badge text, e.g. "Homeowner · Villa 12". Null when not a member. */
  membershipLabel?: string | null;
  onClose: () => void;
  onBookings: () => void;
  onProfile: () => void;
  onVerifyResidence?: () => void;
  onSignIn: () => void;
  onSignOut: () => void;
}

export default function PropertyAccountDrawer({
  visible, accent, isLoggedIn, customerName, customerEmail, membershipLabel,
  onClose, onBookings, onProfile, onVerifyResidence, onSignIn, onSignOut,
}: Props) {
  const slide = useRef(new Animated.Value(DRAWER_W)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slide, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        Animated.timing(fade, { toValue: 1, duration: 260, useNativeDriver: true }),
      ]).start();
    } else {
      slide.setValue(DRAWER_W);
      fade.setValue(0);
    }
  }, [visible, slide, fade]);

  const close = () => {
    Animated.parallel([
      Animated.timing(slide, { toValue: DRAWER_W, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(fade, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => onClose());
  };

  const initial = (customerName || customerEmail || 'G').trim().charAt(0).toUpperCase();

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={close}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, { opacity: fade }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={close} />
        </Animated.View>

        <Animated.View style={[styles.drawer, { transform: [{ translateX: slide }] }]}>
          <SafeAreaView style={{ flex: 1 }}>
            {/* Header */}
            <View style={[styles.header, { backgroundColor: accent }]}>
              <TouchableOpacity style={styles.closeBtn} onPress={close} hitSlop={10}>
                <Ionicons name="close" size={22} color="#fff" />
              </TouchableOpacity>
              {isLoggedIn ? (
                <>
                  <View style={styles.avatar}>
                    <Text style={[styles.avatarText, { color: accent }]}>{initial}</Text>
                  </View>
                  <Text style={styles.headerName} numberOfLines={1}>{customerName || 'Welcome back'}</Text>
                  {customerEmail ? <Text style={styles.headerSub} numberOfLines={1}>{customerEmail}</Text> : null}
                </>
              ) : (
                <>
                  <View style={styles.avatar}>
                    <Ionicons name="person-outline" size={26} color={accent} />
                  </View>
                  <Text style={styles.headerName}>Welcome</Text>
                  <Text style={styles.headerSub}>Sign in to manage your bookings</Text>
                </>
              )}
            </View>

            {/* Menu */}
            <View style={styles.menu}>
              <MenuItem icon="calendar-outline" label="My Bookings" onPress={() => { close(); setTimeout(onBookings, 220); }} />
              <MenuItem icon="person-outline" label="My Profile" onPress={() => { close(); setTimeout(onProfile, 220); }} />
              {isLoggedIn && onVerifyResidence ? (
                membershipLabel ? (
                  <View style={styles.memberRow}>
                    <Ionicons name="shield-checkmark" size={22} color={accent} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.memberLabel}>{membershipLabel}</Text>
                      <Text style={styles.memberSub}>Verified resident</Text>
                    </View>
                    <TouchableOpacity onPress={() => { close(); setTimeout(onVerifyResidence, 220); }} hitSlop={8}>
                      <Text style={[styles.memberAction, { color: accent }]}>Update</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <MenuItem icon="shield-checkmark-outline" label="Verify your residence" onPress={() => { close(); setTimeout(onVerifyResidence, 220); }} />
                )
              ) : null}
            </View>

            <View style={{ flex: 1 }} />

            {/* Footer auth action */}
            <View style={styles.footer}>
              {isLoggedIn ? (
                <TouchableOpacity style={styles.signOut} onPress={() => { close(); setTimeout(onSignOut, 220); }} activeOpacity={0.7}>
                  <Ionicons name="log-out-outline" size={20} color="#dc2626" />
                  <Text style={styles.signOutText}>Sign Out</Text>
                </TouchableOpacity>
              ) : (
                <TouchableOpacity style={[styles.signIn, { backgroundColor: accent }]} onPress={() => { close(); setTimeout(onSignIn, 220); }} activeOpacity={0.9}>
                  <Text style={styles.signInText}>Sign in</Text>
                </TouchableOpacity>
              )}
            </View>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

function MenuItem({ icon, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.menuItem} onPress={onPress} activeOpacity={0.6}>
      <Ionicons name={icon} size={22} color={INK} />
      <Text style={styles.menuLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color="#cfc8bd" style={{ marginLeft: 'auto' }} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, flexDirection: 'row', justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)' },
  drawer: { width: DRAWER_W, backgroundColor: '#FBF9F5', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 16, shadowOffset: { width: -4, height: 0 }, elevation: 12 },

  header: { paddingHorizontal: 22, paddingTop: 12, paddingBottom: 26 },
  closeBtn: { alignSelf: 'flex-end', width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  avatar: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 4, marginBottom: 14 },
  avatarText: { fontSize: 26, fontWeight: '700' },
  headerName: { color: '#fff', fontSize: 19, fontWeight: '700' },
  headerSub: { color: 'rgba(255,255,255,0.85)', fontSize: 13, marginTop: 4 },

  menu: { paddingTop: 8 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 17, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  menuLabel: { fontSize: 16, fontWeight: '600', color: INK },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 22, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: HAIRLINE },
  memberLabel: { fontSize: 15, fontWeight: '700', color: INK },
  memberSub: { fontSize: 12, color: MUTED, marginTop: 1 },
  memberAction: { fontSize: 13, fontWeight: '700' },

  footer: { padding: 20, borderTopWidth: 1, borderTopColor: HAIRLINE },
  signOut: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  signOutText: { color: '#dc2626', fontSize: 16, fontWeight: '700' },
  signIn: { borderRadius: 14, paddingVertical: 15, alignItems: 'center' },
  signInText: { color: '#fff', fontSize: 16, fontWeight: '700' },
});
