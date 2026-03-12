import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.hero}>
        <Text style={styles.logo}>Balkina AI</Text>
        <Text style={styles.tagline}>Book appointments with AI</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push('/(auth)/email-login')}
        >
          <Text style={styles.btnPrimaryText}>Continue with email</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.btnSecondary}
          onPress={() => router.push('/(auth)/phone-login')}
        >
          <Text style={styles.btnSecondaryText}>Continue with phone</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.terms}>
        By continuing, you agree to our Terms of Service and Privacy Policy.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    justifyContent: 'space-between',
    padding: 24,
    paddingTop: 120,
    paddingBottom: 48,
  },
  hero: {
    alignItems: 'center',
  },
  logo: {
    fontSize: 36,
    fontWeight: '800',
    color: '#6B7FC4',
    marginBottom: 8,
  },
  tagline: {
    fontSize: 18,
    color: '#6b7280',
  },
  buttons: {
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: '#6B7FC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnPrimaryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnSecondary: {
    backgroundColor: '#f3f4f6',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
});
