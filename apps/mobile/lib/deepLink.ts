let pendingTenantId: string | null = null;

export function setPendingDeepLinkTenant(id: string | null) {
  pendingTenantId = id;
}

export function consumePendingDeepLinkTenant(): string | null {
  const id = pendingTenantId;
  pendingTenantId = null;
  return id;
}

export function parseTenantFromUrl(url: string | null): string | null {
  if (!url) return null;
  // Match balkina://?tenant=UUID or balkina://book/UUID (legacy)
  const queryMatch = url.match(/[?&]tenant=([a-f0-9-]+)/i);
  if (queryMatch?.[1]) return queryMatch[1];
  const pathMatch = url.match(/balkina:\/\/book\/([a-f0-9-]+)/i);
  if (pathMatch?.[1]) return pathMatch[1];
  return null;
}
