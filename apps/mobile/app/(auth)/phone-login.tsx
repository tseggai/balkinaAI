import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/lib/supabase';

export default function PhoneLoginScreen() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSendCode() {
    if (!phone.trim()) {
      Alert.alert('Error', 'Please enter your phone number');
      return;
    }

    setLoading(true);

    const { error } = await supabase.auth.signInWithOtp({
      phone: phone.trim(),
    });

    setLoading(false);

    if (error) {
      Alert.alert('Error', error.message);
      return;
    }

    router.push({ pathname: '/(auth)/verify-otp', params: { phone: phone.trim() } });
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Enter your phone number</Text>
      <Text style={styles.subtitle}>
        {"We'll send you a 6-digit verification code."}
      </Text>

      <TextInput
        style={styles.input}
        value={phone}
        onChangeText={setPhone}
        placeholder="+1 (555) 000-0000"
        keyboardType="phone-pad"
        autoComplete="tel"
        autoFocus
      />

      <TouchableOpacity
        style={[styles.btn, loading && styles.btnDisabled]}
        onPress={handleSendCode}
        disabled={loading}
      >
        <Text style={styles.btnText}>
          {loading ? 'Sending...' : 'Send code'}
        </Text>
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
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 15,
    color: '#6b7280',
    marginBottom: 32,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 12,
    padding: 16,
    fontSize: 18,
    marginBottom: 20,
  },
  btn: {
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});
