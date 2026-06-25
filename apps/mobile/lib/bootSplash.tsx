import React from 'react';
import { View, Image, StyleSheet, ImageResizeMode } from 'react-native';
import Constants from 'expo-constants';

// ── Boot placeholder ─────────────────────────────────────────────────────────
// The OS shows the native Expo splash (Constants.expoConfig.splash) before any
// JS runs, and we keep it up (expo-splash-screen) until the landing screen's
// data is ready — so the app goes native splash → storefront with no
// intermediate JS loader. This component is what renders *underneath* that
// still-visible native splash; it is normally never seen. It is painted to be
// identical to the native splash (same art, resizeMode and background) purely as
// a graceful fallback if the splash is ever dropped before the landing is ready
// (e.g. the safety timeout on a very slow network). No text or logo is overlaid
// here — branding belongs in the splash art itself.

const PROPERTY_SLUG = (Constants.expoConfig?.extra?.propertySlug as string | undefined) ?? null;
const PRIMARY_COLOR = (Constants.expoConfig?.extra?.primaryColor as string | undefined) ?? '#6B7FC4';

// Mirror the native splash presentation so the fallback is indistinguishable
// from the frame the OS already drew.
const SPLASH_RESIZE = (Constants.expoConfig?.splash?.resizeMode as ImageResizeMode | undefined) ?? 'contain';
const SPLASH_BG =
  (Constants.expoConfig?.splash?.backgroundColor as string | undefined) ?? PRIMARY_COLOR;

// Bundled splash art keyed by variant slug, matched to each variant's native
// splash (app.config.js sets the same files). Add one line per new white-label
// property. require() must be static for Metro, so this cannot be data-driven.
const VARIANT_BOOT_IMAGES: Record<string, number> = {
  portonovi: require('../white-label/assets/portonovi/splash.png'),
};
const BASE_BOOT_IMAGE = require('../assets/splash_Logo.png');

const BOOT_IMAGE: number =
  (PROPERTY_SLUG ? VARIANT_BOOT_IMAGES[PROPERTY_SLUG] : undefined) ?? BASE_BOOT_IMAGE;

export function BootSplash() {
  return (
    <View style={[styles.fill, { backgroundColor: SPLASH_BG }]}>
      <Image source={BOOT_IMAGE} style={StyleSheet.absoluteFill} resizeMode={SPLASH_RESIZE} />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
