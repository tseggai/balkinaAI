import { createAdminClient } from '@/lib/supabase/server';

export const OCTO_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

interface OctoContext {
  connectionId: string;
  tenantId: string;
  admin: ReturnType<typeof createAdminClient>;
}

export async function getOctoContext(request: Request): Promise<OctoContext | null> {
  const auth = request.headers.get('authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return null;

  const admin = createAdminClient();
  const { data } = await admin
    .from('octo_connections')
    .select('id, tenant_id')
    .eq('api_key', token)
    .eq('is_active', true)
    .single();

  if (!data) return null;
  const conn = data as { id: string; tenant_id: string };
  return { connectionId: conn.id, tenantId: conn.tenant_id, admin };
}
