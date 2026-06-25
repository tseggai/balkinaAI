import type { SupabaseClient } from '@supabase/supabase-js';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Push-notify a property's verified members, optionally filtered by type.
 * audience: 'all' (every active member) | 'residents' (homeowner/renter/
 * commercial_owner) | a single member_type. Best-effort. Returns how many
 * members matched and how many push tokens were sent to (scoped to the
 * property's app via property_slug).
 */
export async function notifyMembers(
  admin: SupabaseClient,
  propertyId: string,
  propertySlug: string,
  audience: string,
  msg: { title: string; body: string },
): Promise<{ matched: number; pushed: number }> {
  let q = (admin as any)
    .from('property_members')
    .select('customer_id')
    .eq('property_id', propertyId)
    .eq('status', 'active');
  if (audience !== 'all') {
    const types = audience === 'residents' ? ['homeowner', 'renter', 'commercial_owner'] : [audience];
    q = q.in('member_type', types);
  }
  const { data: members } = await q;
  const customerIds = Array.from(new Set(((members ?? []) as { customer_id: string }[]).map((m) => m.customer_id)));
  if (customerIds.length === 0) return { matched: 0, pushed: 0 };

  const { data: toks } = await (admin as any)
    .from('customer_push_tokens')
    .select('token')
    .in('customer_id', customerIds)
    .eq('property_slug', propertySlug);
  const tokens = Array.from(new Set(((toks ?? []) as { token: string }[]).map((t) => t.token)));
  if (tokens.length === 0) return { matched: customerIds.length, pushed: 0 };

  const { sendPushNotification } = await import('@balkina/notifications');
  await sendPushNotification(
    tokens.map((token) => ({
      pushToken: token,
      title: msg.title,
      body: msg.body,
      data: { type: 'property_message' },
    })),
  );
  return { matched: customerIds.length, pushed: tokens.length };
}
