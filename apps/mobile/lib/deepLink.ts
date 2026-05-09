let pendingTenantId: string | null = null;

export function setPendingDeepLinkTenant(id: string | null) {
  pendingTenantId = id;
}

export function consumePendingDeepLinkTenant(): string | null {
  const id = pendingTenantId;
  pendingTenantId = null;
  return id;
}
