import { View, Text, StyleSheet } from 'react-native';
import Constants from 'expo-constants';

const PROPERTY_NAME = (Constants.expoConfig?.extra?.propertyName as string | undefined) ?? null;
const PRIMARY_COLOR = (Constants.expoConfig?.extra?.primaryColor as string | undefined) ?? '#6B7FC4';

export default function Index() {
  // Root layout handles auth-based navigation.
  // This screen is briefly shown while the auth state is determined.
  // For white-label property builds, show the property branding so customers
  // never see the Balkina identity during boot.
  return (
    <View style={styles.container}>
      <Text style={[styles.text, { color: PRIMARY_COLOR }]}>{PROPERTY_NAME ?? 'Balkina AI'}</Text>
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
