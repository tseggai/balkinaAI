import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const BRAND_BLUE = '#6B7FC4';

function PomegranateIcon({ size = 48 }: { size?: number }) {
  const bodySize = size;
  const crownSize = size * 0.22;

  return (
    <View style={{ alignItems: 'center' }}>
      {/* Crown / calyx */}
      <View style={{
        width: 0, height: 0,
        borderLeftWidth: crownSize * 0.6, borderRightWidth: crownSize * 0.6,
        borderBottomWidth: crownSize, borderLeftColor: 'transparent',
        borderRightColor: 'transparent', borderBottomColor: BRAND_BLUE,
        marginBottom: -2,
      }} />
      {/* Main fruit body */}
      <View style={{
        width: bodySize, height: bodySize,
        borderRadius: bodySize / 2,
        backgroundColor: BRAND_BLUE,
      }} />
    </View>
  );
}

export default function BalkinaLogo({ size = 'large' }: { size?: 'small' | 'large' }) {
  const iconSize = size === 'large' ? 52 : 24;
  const textSize = size === 'large' ? 22 : 13;
  const letterSpacing = size === 'large' ? 6 : 3;
  const gap = size === 'large' ? 10 : 4;

  return (
    <View style={styles.container}>
      <PomegranateIcon size={iconSize} />
      <Text style={[styles.text, { fontSize: textSize, letterSpacing, marginTop: gap }]}>BALKINA</Text>
    </View>
  );
}

export function BalkinaLogoInline() {
  return (
    <View style={styles.inlineContainer}>
      <PomegranateIcon size={22} />
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
