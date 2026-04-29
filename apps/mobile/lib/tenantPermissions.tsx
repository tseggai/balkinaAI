import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from './supabase';

export type StaffRole = 'owner' | 'manager' | 'staff';

interface TenantPermissions {
  role: StaffRole;
  staffId: string | null;
  tenantId: string | null;
  tenantName: string | null;
  ownerName: string | null;
  staffName: string | null;
  canManageServices: boolean;
  canManageStaff: boolean;
  canManageLocations: boolean;
  canManageSettings: boolean;
  canViewAllBookings: boolean;
  canApproveBookings: boolean;
  loading: boolean;
}

const defaults: TenantPermissions = {
  role: 'staff',
  staffId: null,
  tenantId: null,
  tenantName: null,
  ownerName: null,
  staffName: null,
  canManageServices: false,
  canManageStaff: false,
  canManageLocations: false,
  canManageSettings: false,
  canViewAllBookings: false,
  canApproveBookings: false,
  loading: true,
};

const TenantPermissionsContext = createContext<TenantPermissions>(defaults);

export function useTenantPermissions() {
  return useContext(TenantPermissionsContext);
}

export function TenantPermissionsProvider({ children }: { children: React.ReactNode }) {
  const [perms, setPerms] = useState<TenantPermissions>(defaults);

  useEffect(() => {
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Check if owner (has tenants row)
        const { data: tenant } = await supabase
          .from('tenants')
          .select('id, name, owner_name')
          .eq('user_id', user.id)
          .single();

        if (tenant) {
          const t = tenant as { id: string; name: string; owner_name: string | null };
          // Owner — also get their staff record
          const { data: staffRecord } = await supabase
            .from('staff')
            .select('id, name')
            .eq('user_id', user.id)
            .eq('tenant_id', t.id)
            .single();

          setPerms({
            role: 'owner',
            staffId: (staffRecord as { id: string } | null)?.id ?? null,
            tenantId: t.id,
            tenantName: t.name,
            ownerName: t.owner_name,
            staffName: (staffRecord as { name: string } | null)?.name ?? t.owner_name,
            canManageServices: true,
            canManageStaff: true,
            canManageLocations: true,
            canManageSettings: true,
            canViewAllBookings: true,
            canApproveBookings: true,
            loading: false,
          });
          return;
        }

        // Check if staff
        const { data: staff } = await supabase
          .from('staff')
          .select('id, tenant_id, name, role')
          .eq('user_id', user.id)
          .single();

        if (staff) {
          const s = staff as { id: string; tenant_id: string; name: string; role: string };
          const { data: tenantData } = await supabase
            .from('tenants')
            .select('name, owner_name')
            .eq('id', s.tenant_id)
            .single();
          const td = tenantData as { name: string; owner_name: string | null } | null;
          const role = (s.role as StaffRole) || 'staff';

          setPerms({
            role,
            staffId: s.id,
            tenantId: s.tenant_id,
            tenantName: td?.name ?? null,
            ownerName: td?.owner_name ?? null,
            staffName: s.name,
            canManageServices: role === 'owner' || role === 'manager',
            canManageStaff: role === 'owner',
            canManageLocations: role === 'owner' || role === 'manager',
            canManageSettings: role === 'owner',
            canViewAllBookings: role === 'owner' || role === 'manager',
            canApproveBookings: role === 'owner' || role === 'manager',
            loading: false,
          });
        }
      } catch {
        setPerms({ ...defaults, loading: false });
      }
    })();
  }, []);

  return (
    <TenantPermissionsContext.Provider value={perms}>
      {children}
    </TenantPermissionsContext.Provider>
  );
}
