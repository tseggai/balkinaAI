import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';

export default function PhoneLoginScreen() {
  const router = useRouter();

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>📱</Text>
      </View>

      <Text style={styles.title}>Phone login coming soon</Text>
      <Text style={styles.subtitle}>
        {"We're working on phone number authentication with SMS verification. In the meantime, please use email and password to sign in."}
      </Text>

      <TouchableOpacity
        style={styles.btn}
        onPress={() => router.replace('/(auth)/email-login')}
      >
        <Text style={styles.btnText}>Continue with email</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.btnSecondary}
        onPress={() => router.back()}
      >
        <Text style={styles.btnSecondaryText}>Go back</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    paddingTop: 80,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 32,
    lineHeight: 22,
    textAlign: 'center',
  },
  btn: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  btnSecondary: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnSecondaryText: {
    color: '#6366f1',
    fontSize: 16,
    fontWeight: '600',
  },
});
