import { createAdminClient } from '@/lib/supabase/server';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get('authorization') ?? '';
  if (auth.startsWith('Bearer ')) return auth.slice(7);
  return null;
}

export async function getTenantContext(request: Request) {
  const token = getBearerToken(request);
  if (!token) return null;
  const admin = createAdminClient();
  const { data: { user } } = await admin.auth.getUser(token);
  if (!user) return null;
  const { data: tenant } = await admin.from('tenants').select('id, name').eq('user_id', user.id).single();
  if (!tenant) return null;
  const t = tenant as { id: string; name: string };
  return { tenantId: t.id, tenantName: t.name, userId: user.id, admin };
}
