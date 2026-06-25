import type { SupabaseClient } from '@supabase/supabase-js';

// A readable, hard-to-mistype suffix (no 0/O/1/I).
function randomSuffix(len = 4): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < len; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return out;
}

function buildCode(slug: string, type: string): string {
  const base = slug.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
  const typeTag = type === 'commercial_owner' ? 'RETAIL' : type.toUpperCase();
  return `${base}-${typeTag}-${randomSuffix()}`;
}

/** Generate a member code unique within property_member_codes (retry on collision). */
export async function generateUniqueMemberCode(
  admin: SupabaseClient,
  slug: string,
  memberType: string,
): Promise<string> {
  /* eslint-disable @typescript-eslint/no-explicit-any */
  let code = buildCode(slug, memberType);
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: existing } = await (admin as any)
      .from('property_member_codes')
      .select('id')
      .eq('code', code)
      .maybeSingle();
    if (!existing) break;
    code = buildCode(slug, memberType);
  }
  return code;
}
