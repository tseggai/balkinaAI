import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const API_BASE = process.env.EXPO_PUBLIC_API_URL || 'https://app.balkina.ai';

export async function registerPushToken(params: {
  recipientType: 'customer' | 'staff';
  recipientId: string;
  accessToken: string;
}): Promise<void> {

  console.log('[push-reg] checking notification permissions...');
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  console.log('[push-reg] existing permission status:', existingStatus);
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    console.log('[push-reg] requesting notification permissions...');
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
    console.log('[push-reg] permission after request:', finalStatus);
  }
  if (finalStatus !== 'granted') {
    console.log('[push-reg] notification permission NOT granted:', finalStatus);
    return;
  }

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  console.log('[push-reg] EAS projectId:', projectId ?? 'MISSING');
  if (!projectId) {
    console.warn('[push-reg] no EAS projectId found — cannot get push token');
    return;
  }

  console.log('[push-reg] getting expo push token...');
  const tokenData = await Notifications.getExpoPushTokenAsync({ projectId });
  console.log('[push-reg] got expo push token:', tokenData.data);

  try {
    const response = await fetch(`${API_BASE}/api/push-tokens`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.accessToken}`,
      },
      body: JSON.stringify({
        token: tokenData.data,
        recipientType: params.recipientType,
        recipientId: params.recipientId,
        platform: Platform.OS === 'ios' ? 'ios' : 'android',
      }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn('[push-reg] API returned', response.status, text);
      throw new Error(`Push token API failed: ${response.status}`);
    } else {
      console.log('[push-reg] push token registered successfully');
    }
  } catch (err) {
    console.warn('[push-reg] fetch failed:', err);
  }
}
