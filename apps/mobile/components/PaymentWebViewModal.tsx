/**
 * PaymentWebViewModal — In-app Stripe payment via WebView.
 *
 * Opens the /pay/{appointmentId} web page inside the app so the user
 * never leaves to a browser and doesn't need to log in.
 * Detects payment success via URL query params and calls onSuccess.
 */
import React, { useRef, useCallback, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView, type WebViewNavigation } from 'react-native-webview';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://balkina-ai.vercel.app';

interface Props {
  visible: boolean;
  appointmentId: string;
  depositAmount?: number;
  onSuccess: () => void;
  onClose: () => void;
}

export default function PaymentWebViewModal({
  visible,
  appointmentId,
  depositAmount,
  onSuccess,
  onClose,
}: Props) {
  const webViewRef = useRef<WebView>(null);
  const [loading, setLoading] = useState(true);
  const successHandled = useRef(false);

  const payUrl = `${API_BASE}/pay/${appointmentId}`;

  const handleNavigationChange = useCallback(
    (navState: WebViewNavigation) => {
      // Detect success via URL query params set by the pay page
      const url = navState.url;
      if (
        !successHandled.current &&
        (url.includes('status=success') || url.includes('redirect_status=succeeded'))
      ) {
        successHandled.current = true;
        onSuccess();
      }
    },
    [onSuccess],
  );

  const handleClose = useCallback(() => {
    successHandled.current = false;
    setLoading(true);
    onClose();
  }, [onClose]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#374151" />
          </TouchableOpacity>
          <Text style={styles.title}>
            Pay Deposit{depositAmount ? ` ($${depositAmount.toFixed(2)})` : ''}
          </Text>
          <View style={{ width: 40 }} />
        </View>

        {/* WebView */}
        <WebView
          ref={webViewRef}
          source={{ uri: payUrl }}
          style={styles.webview}
          onNavigationStateChange={handleNavigationChange}
          onLoadEnd={() => setLoading(false)}
          startInLoadingState
          javaScriptEnabled
          domStorageEnabled
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          originWhitelist={['*']}
          allowsInlineMediaPlayback
          mixedContentMode="compatibility"
          onShouldStartLoadWithRequest={() => true}
        />

        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#6B7FC4" />
            <Text style={styles.loadingText}>Loading payment...</Text>
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  closeBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: '#111827',
  },
  webview: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    top: 56,
    backgroundColor: 'rgba(255,255,255,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6b7280',
  },
});
