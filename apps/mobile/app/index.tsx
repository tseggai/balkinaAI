import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

const PROPERTY_NAME = (Constants.expoConfig?.extra?.propertyName as string | undefined) ?? null;
const PRIMARY_COLOR = (Constants.expoConfig?.extra?.primaryColor as string | undefined) ?? '#6B7FC4';

export default function Index() {
  // Root layout handles auth-based navigation.
  // This screen is briefly shown while the auth state is determined.
  // For white-label property builds we paint the property color full-screen
  // with the property name, matching the native splash so the boot reads as a
  // single continuous splash (no Balkina flash, no jarring screen swaps).
  const bg = PROPERTY_NAME ? PRIMARY_COLOR : '#fff';
  const fg = PROPERTY_NAME ? '#fff' : PRIMARY_COLOR;
  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{PROPERTY_NAME ?? 'Balkina AI'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  text: {
    fontSize: 24,
    fontWeight: '700',
  },
});
