import React from 'react';
import { View, Text, Image, StyleSheet, ImageResizeMode } from 'react-native';
import Constants from 'expo-constants';

// ── Boot splash bridge ───────────────────────────────────────────────────────
// The OS shows the native Expo splash (Constants.expoConfig.splash) before any
// JS runs. Once JS mounts we paint THIS view — pixel-matched to that native
// splash (same image, resizeMode and background) — so hiding the native splash
// reveals an identical frame instead of a jarring colour/text card. The bridge
// stays up until the landing screen's data is ready, giving a seamless
// native splash → storefront (or chat) hand-off.

const PROPERTY_SLUG = (Constants.expoConfig?.extra?.propertySlug as string | undefined) ?? null;
const PROPERTY_NAME = (Constants.expoConfig?.extra?.propertyName as string | undefined) ?? null;
const PRIMARY_COLOR = (Constants.expoConfig?.extra?.primaryColor as string | undefined) ?? '#6B7FC4';
// Opt out of the name overlay when the splash art already bakes the name/logo
// in (set "splashShowName": false in the variant JSON). Defaults to on for
// property builds so a plain branded background still shows its name.
const SPLASH_SHOW_NAME = (Constants.expoConfig?.extra?.splashShowName as boolean | undefined) ?? true;

// Mirror the native splash presentation so the bridge is indistinguishable from
// the frame the OS already drew.
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

// Overlay the property name only when there is one AND the art doesn't already
// include it. Base Balkina (no propertyName) never shows text.
const BOOT_SHOW_NAME = !!PROPERTY_NAME && SPLASH_SHOW_NAME;

export function BootSplash() {
  return (
    <View style={[styles.fill, { backgroundColor: SPLASH_BG }]}>
      <Image source={BOOT_IMAGE} style={StyleSheet.absoluteFill} resizeMode={SPLASH_RESIZE} />
      {BOOT_SHOW_NAME ? <Text style={styles.name}>{PROPERTY_NAME}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  name: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    letterSpacing: 0.5,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 8,
  },
});
