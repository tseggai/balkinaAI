/**
 * useDepositPayment — hook for in-app deposit payments via Stripe PaymentSheet.
 *
 * Usage:
 *   const { payDeposit, loading } = useDepositPayment();
 *   const success = await payDeposit(appointmentId);
 */
import { useState, useCallback } from 'react';
import { Alert } from 'react-native';
import { useStripe } from '@/lib/stripe';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

interface PayResult {
  success: boolean;
  error?: string;
}

export function useDepositPayment() {
  const { initPaymentSheet, presentPaymentSheet } = useStripe();
  const [loading, setLoading] = useState(false);

  const payDeposit = useCallback(async (appointmentId: string): Promise<PayResult> => {
    setLoading(true);
    try {
      // 1. Fetch or create PaymentIntent from our API
      const res = await fetch(`${API_BASE}/api/payments/create-deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId }),
      });

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = err.error ?? 'Failed to prepare payment';
        Alert.alert('Payment Error', msg);
        return { success: false, error: msg };
      }

      const { clientSecret } = (await res.json()) as { clientSecret: string; paymentIntentId: string; amount: number; currency: string };

      if (!clientSecret) {
        Alert.alert('Payment Error', 'No payment secret returned');
        return { success: false, error: 'No client secret' };
      }

      // 2. Initialize PaymentSheet
      const { error: initError } = await initPaymentSheet({
        paymentIntentClientSecret: clientSecret,
        merchantDisplayName: 'Balkina AI',
        allowsDelayedPaymentMethods: false,
        applePay: { merchantCountryCode: 'US' },
        googlePay: { merchantCountryCode: 'US', testEnv: true },
      });

      if (initError) {
        if (initError.code === 'Unavailable') {
          Alert.alert(
            'Development Build Required',
            'In-app payments are not available in Expo Go. To test payments, use a development build:\n\nnpx expo run:ios\nnpx expo run:android',
          );
        } else {
          Alert.alert('Payment Error', initError.message);
        }
        return { success: false, error: initError.message };
      }

      // 3. Present PaymentSheet — user sees Apple Pay / Google Pay / card entry
      const { error: presentError } = await presentPaymentSheet();

      if (presentError) {
        // User cancelled is not an error
        if (presentError.code === 'Canceled') {
          return { success: false, error: 'cancelled' };
        }
        Alert.alert('Payment Failed', presentError.message);
        return { success: false, error: presentError.message };
      }

      // 4. Payment succeeded — webhook will update the appointment
      return { success: true };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Payment failed';
      Alert.alert('Payment Error', msg);
      return { success: false, error: msg };
    } finally {
      setLoading(false);
    }
  }, [initPaymentSheet, presentPaymentSheet]);

  return { payDeposit, loading };
}
