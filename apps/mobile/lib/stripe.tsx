/**
 * Stripe wrapper that gracefully falls back when native modules are unavailable (Expo Go).
 * In a development build or production, the real Stripe SDK is used.
 * In Expo Go, no-op stubs are provided so the app doesn't crash.
 */
import React from 'react';
import { Alert } from 'react-native';

type PaymentSheetError = { code: string; message: string };
type InitResult = { error?: PaymentSheetError };
type PresentResult = { error?: PaymentSheetError };

interface StripeHook {
  initPaymentSheet: (params: {
    paymentIntentClientSecret: string;
    merchantDisplayName: string;
    allowsDelayedPaymentMethods?: boolean;
    applePay?: { merchantCountryCode: string };
    googlePay?: { merchantCountryCode: string; testEnv?: boolean };
  }) => Promise<InitResult>;
  presentPaymentSheet: () => Promise<PresentResult>;
}

// Try to load the native Stripe module
let RealStripeProvider: React.ComponentType<{
  publishableKey: string;
  merchantIdentifier?: string;
  children: React.ReactNode;
}> | null = null;

let realUseStripe: (() => StripeHook) | null = null;

try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const stripeMod = require('@stripe/stripe-react-native');
  RealStripeProvider = stripeMod.StripeProvider;
  realUseStripe = stripeMod.useStripe;
} catch {
  // Native module not available (Expo Go)
}

const EXPO_GO_ERROR: PaymentSheetError = {
  code: 'Unavailable',
  message: 'Stripe payments require a development build. They are not available in Expo Go.',
};

function fallbackUseStripe(): StripeHook {
  return {
    initPaymentSheet: async () => {
      Alert.alert(
        'Development Build Required',
        'Stripe payments are not available in Expo Go. Please use a development build (npx expo run:ios or npx expo run:android).',
      );
      return { error: EXPO_GO_ERROR };
    },
    presentPaymentSheet: async () => ({ error: EXPO_GO_ERROR }),
  };
}

/**
 * Safe useStripe hook — returns real Stripe in dev builds, no-op stubs in Expo Go.
 */
export function useStripe(): StripeHook {
  if (realUseStripe) {
    return realUseStripe();
  }
  return fallbackUseStripe();
}

/**
 * Safe StripeProvider — wraps children with real provider in dev builds,
 * passes through in Expo Go.
 */
export function SafeStripeProvider({
  publishableKey,
  merchantIdentifier,
  children,
}: {
  publishableKey: string;
  merchantIdentifier?: string;
  children: React.ReactNode;
}) {
  if (RealStripeProvider) {
    return (
      <RealStripeProvider
        publishableKey={publishableKey}
        merchantIdentifier={merchantIdentifier}
      >
        {children}
      </RealStripeProvider>
    );
  }
  // In Expo Go, just render children without Stripe provider
  return <>{children}</>;
}
