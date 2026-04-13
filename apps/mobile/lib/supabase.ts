import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

/**
 * Chunked SecureStore adapter for Supabase auth.
 *
 * expo-secure-store has a ~2048-byte limit per value on iOS. Supabase
 * session tokens (JWT + refresh + metadata) regularly exceed this. When
 * the limit is hit SecureStore silently drops the value, causing the
 * session to "vanish" on next read — which triggers infinite redirect
 * loops and the "unresponsive after login" bug Apple reviewers see.
 *
 * This adapter transparently splits large values into numbered chunks
 * (key, key-1, key-2, ...) on write and reassembles them on read.
 */
const CHUNK_SIZE = 1800; // leave headroom below the 2048 limit

const ChunkedSecureStoreAdapter = {
  async getItem(key: string): Promise<string | null> {
    try {
      const first = await SecureStore.getItemAsync(key);
      if (first === null) return null;

      // If there are no chunks, the whole value fits in one slot.
      let result = first;
      let idx = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const chunk = await SecureStore.getItemAsync(`${key}-${idx}`);
        if (chunk === null) break;
        result += chunk;
        idx++;
      }
      return result;
    } catch {
      return null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Remove any old chunks first
      await ChunkedSecureStoreAdapter.removeItem(key);

      if (value.length <= CHUNK_SIZE) {
        await SecureStore.setItemAsync(key, value);
        return;
      }

      // Split into chunks
      const chunks = Math.ceil(value.length / CHUNK_SIZE);
      await SecureStore.setItemAsync(key, value.slice(0, CHUNK_SIZE));
      for (let i = 1; i < chunks; i++) {
        await SecureStore.setItemAsync(
          `${key}-${i}`,
          value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
        );
      }
    } catch {
      // SecureStore write failed — log but don't crash
      console.warn('[supabase] SecureStore write failed for key:', key);
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await SecureStore.deleteItemAsync(key);
      // Clean up any chunks
      let idx = 1;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        try {
          // getItemAsync returns null if key doesn't exist (no throw)
          const exists = await SecureStore.getItemAsync(`${key}-${idx}`);
          if (exists === null) break;
          await SecureStore.deleteItemAsync(`${key}-${idx}`);
          idx++;
        } catch {
          break;
        }
      }
    } catch {
      // Ignore cleanup errors
    }
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: ChunkedSecureStoreAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : (null as unknown as ReturnType<typeof createClient>);

export interface StaffInfo {
  id: string;
  tenant_id: string;
  name: string;
  requires_approval: boolean;
}

/**
 * Determine if the logged-in user is a staff member or a customer.
 * Includes a timeout to prevent the app from hanging if the network is slow.
 */
export async function getAuthenticatedRole(): Promise<{ role: 'customer' | 'staff' | null; staffInfo?: StaffInfo }> {
  const timeout = <T>(promise: Promise<T>, ms: number): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ]);

  try {
    const { data: { user } } = await timeout(supabase.auth.getUser(), 8000);
    if (!user) return { role: null };

    const { data: staffRecord } = await timeout(
      supabase
        .from('staff')
        .select('id, tenant_id, name, requires_approval')
        .eq('user_id', user.id)
        .single(),
      5000,
    );

    if (staffRecord) {
      const staff = staffRecord as StaffInfo;
      return { role: 'staff', staffInfo: staff };
    }

    return { role: 'customer' };
  } catch {
    // Timeout or network error — default to customer so the app isn't stuck
    return { role: 'customer' };
  }
}
