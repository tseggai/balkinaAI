let pendingTenantId: string | null = null;

export function setPendingDeepLinkTenant(id: string | null) {
  console.log('[deep-link] setPendingDeepLinkTenant:', id);
  pendingTenantId = id;
}

export function consumePendingDeepLinkTenant(): string | null {
  const id = pendingTenantId;
  pendingTenantId = null;
  console.log('[deep-link] consumePendingDeepLinkTenant:', id);
  return id;
}

export function parseTenantFromUrl(url: string | null): string | null {
  console.log('[deep-link] parseTenantFromUrl input:', url);
  if (!url) return null;
  const queryMatch = url.match(/[?&]tenant=([a-f0-9-]+)/i);
  if (queryMatch?.[1]) {
    console.log('[deep-link] parsed tenant from query:', queryMatch[1]);
    return queryMatch[1];
  }
  const pathMatch = url.match(/balkina:\/\/book\/([a-f0-9-]+)/i);
  if (pathMatch?.[1]) {
    console.log('[deep-link] parsed tenant from path:', pathMatch[1]);
    return pathMatch[1];
  }
  console.log('[deep-link] no tenant found in URL');
  return null;
}
