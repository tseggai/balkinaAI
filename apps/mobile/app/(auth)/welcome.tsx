import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Animated, Linking } from 'react-native';
import { useRouter } from 'expo-router';

export default function WelcomeScreen() {
  const router = useRouter();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/logo.png')}
          style={styles.logoImage}
          resizeMode="contain"
        />
        <Text style={styles.tagline}>Book appointments with AI</Text>
      </View>

      <View style={styles.buttons}>
        <TouchableOpacity
          style={styles.btnPrimary}
          onPress={() => router.push('/(auth)/email-login')}
        >
          <Text style={styles.btnPrimaryText}>Continue with email</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.terms}>
        By continuing, you agree to our{' '}
        <Text style={styles.link} onPress={() => Linking.openURL('https://balkina.ai/terms')}>Terms of Service</Text>
        {' '}and{' '}
        <Text style={styles.link} onPress={() => Linking.openURL('https://balkina.ai/privacy')}>Privacy Policy</Text>.
      </Text>
    </Animated.View>
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
  logoImage: {
    width: 180,
    height: 180,
    marginBottom: 12,
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
  btnStaff: {
    borderWidth: 1,
    borderColor: '#6B7FC4',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnStaffText: {
    color: '#6B7FC4',
    fontSize: 16,
    fontWeight: '600',
  },
  terms: {
    textAlign: 'center',
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
  link: {
    color: '#6B7FC4',
    textDecorationLine: 'underline' as const,
  },
});
