import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';

const BRAND_BLUE = '#6B7FC4';

/* eslint-disable @typescript-eslint/no-var-requires */
const logoIcon = require('../assets/logo.png');

export default function BalkinaLogo({ size = 'large' }: { size?: 'small' | 'large' }) {
  const iconSize = size === 'large' ? 52 : 24;
  const textSize = size === 'large' ? 22 : 13;
  const letterSpacing = size === 'large' ? 6 : 3;
  const gap = size === 'large' ? 10 : 4;

  return (
    <View style={styles.container}>
      <Image source={logoIcon} style={{ width: iconSize, height: iconSize }} />
      <Text style={[styles.text, { fontSize: textSize, letterSpacing, marginTop: gap }]}>BALKINA</Text>
    </View>
  );
}

export function BalkinaLogoInline() {
  return (
    <View style={styles.inlineContainer}>
      <Image source={logoIcon} style={{ width: 22, height: 22 }} />
      <Text style={styles.inlineText}>BALKINA</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center' },
  text: { color: BRAND_BLUE, fontWeight: '400' },
  inlineContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  inlineText: { color: BRAND_BLUE, fontSize: 16, fontWeight: '600', letterSpacing: 3 },
});
