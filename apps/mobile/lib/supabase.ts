import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';

const ExpoSecureStoreAdapter = {
  getItem(key: string) {
    return SecureStore.getItemAsync(key);
  },
  setItem(key: string, value: string) {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem(key: string) {
    return SecureStore.deleteItemAsync(key);
  },
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

export interface StaffInfo {
  id: string;
  tenant_id: string;
  name: string;
  requires_approval: boolean;
}

export async function getAuthenticatedRole(): Promise<{ role: 'customer' | 'staff' | null; staffInfo?: StaffInfo }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { role: null };

  // Check if this user is a staff member
  const { data: staffRecord } = await supabase
    .from('staff')
    .select('id, tenant_id, name, requires_approval')
    .eq('user_id', user.id)
    .single();

  if (staffRecord) {
    const staff = staffRecord as StaffInfo;
    return { role: 'staff', staffInfo: staff };
  }

  return { role: 'customer' };
}
