import { View, Text, StyleSheet } from 'react-native';

export default function Index() {
  // Root layout handles auth-based navigation.
  // This screen is briefly shown while the auth state is determined.
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Balkina AI</Text>
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
    color: '#6B7FC4',
  },
});
