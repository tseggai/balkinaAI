import { Alert } from 'react-native';

let Google: typeof import('expo-auth-session/providers/google') | null = null;
let WebBrowser: typeof import('expo-web-browser') | null = null;

try {
  WebBrowser = require('expo-web-browser');
  WebBrowser?.maybeCompleteAuthSession();
  Google = require('expo-auth-session/providers/google');
} catch {
  // Native modules not available (Expo Go)
}

const GOOGLE_CLIENT_ID_WEB = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_WEB ?? '';
const GOOGLE_CLIENT_ID_IOS = process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID_IOS ?? '';

type GooglePromptAsync = () => Promise<{ type: string; authentication?: { idToken?: string } | null }>;

export function useGoogleAuth(): { promptAsync: GooglePromptAsync | null } {
  if (!Google) return { promptAsync: null };

  try {
    const [, , promptAsync] = Google.useAuthRequest({
      iosClientId: GOOGLE_CLIENT_ID_IOS,
      webClientId: GOOGLE_CLIENT_ID_WEB,
    });
    return { promptAsync: promptAsync as unknown as GooglePromptAsync };
  } catch {
    return { promptAsync: null };
  }
}

export function googleAvailable(): boolean {
  return Google !== null;
}

export async function handleGoogleResult(
  result: { type: string; authentication?: { idToken?: string } | null },
  signInWithIdToken: (params: { provider: 'google'; token: string }) => Promise<{ error: Error | null }>,
): Promise<boolean> {
  if (result.type === 'success' && result.authentication?.idToken) {
    const { error } = await signInWithIdToken({
      provider: 'google',
      token: result.authentication.idToken,
    });
    if (error) {
      Alert.alert('Sign in failed', error.message);
      return false;
    }
    return true;
  }
  return false;
}
