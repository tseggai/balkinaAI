import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('staff_roles')
    .select('*, staff_role_assignments(staff_id, staff(name)), role_permissions(*)')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data, error: null });
}

export async function POST(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from('staff_roles')
    .insert({
      tenant_id: tenantId,
      name: body.name,
      notes: body.notes || null,
    } as never)
    .select()
    .single();

  const roleData = data as { id: string } | null;
  if (error || !roleData) return NextResponse.json({ data: null, error: { message: error?.message ?? 'Insert failed' } }, { status: 500 });

  // Insert staff assignments
  const staffIds = body.staff_ids as string[] | undefined;
  if (staffIds && Array.isArray(staffIds) && staffIds.length > 0) {
    await supabase.from('staff_role_assignments').insert(
      staffIds.map((staffId) => ({
        role_id: roleData.id,
        staff_id: staffId,
      })) as never
    );
  }

  // Insert permissions
  const permissions = body.permissions as { module: string; can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }[] | undefined;
  if (permissions && Array.isArray(permissions) && permissions.length > 0) {
    await supabase.from('role_permissions').insert(
      permissions.map((p) => ({
        role_id: roleData.id,
        module: p.module,
        can_view: p.can_view ?? false,
        can_add: p.can_add ?? false,
        can_edit: p.can_edit ?? false,
        can_delete: p.can_delete ?? false,
      })) as never
    );
  }

  return NextResponse.json({ data: roleData, error: null }, { status: 201 });
}

export async function PATCH(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as { [key: string]: unknown };
  const id = body.id as string | undefined;
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const supabase = createAdminClient();

  const updateFields: Record<string, unknown> = {};
  if ('name' in body) updateFields.name = body.name;
  if ('notes' in body) updateFields.notes = body.notes;

  const { data, error } = await supabase
    .from('staff_roles')
    .update(updateFields as never)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select()
    .single();

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });

  // Replace staff assignments
  const staffIds = body.staff_ids as string[] | undefined;
  if (staffIds && Array.isArray(staffIds)) {
    await supabase.from('staff_role_assignments').delete().eq('role_id', id);
    if (staffIds.length > 0) {
      await supabase.from('staff_role_assignments').insert(
        staffIds.map((staffId) => ({
          role_id: id,
          staff_id: staffId,
        })) as never
      );
    }
  }

  // Replace permissions
  const permissions = body.permissions as { module: string; can_view: boolean; can_add: boolean; can_edit: boolean; can_delete: boolean }[] | undefined;
  if (permissions && Array.isArray(permissions)) {
    await supabase.from('role_permissions').delete().eq('role_id', id);
    if (permissions.length > 0) {
      await supabase.from('role_permissions').insert(
        permissions.map((p) => ({
          role_id: id,
          module: p.module,
          can_view: p.can_view ?? false,
          can_add: p.can_add ?? false,
          can_edit: p.can_edit ?? false,
          can_delete: p.can_delete ?? false,
        })) as never
      );
    }
  }

  return NextResponse.json({ data, error: null });
}

export async function DELETE(request: Request) {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) return NextResponse.json({ data: null, error: { message: 'Missing id' } }, { status: 400 });

  const supabase = createAdminClient();
  const { error } = await supabase.from('staff_roles').delete().eq('id', id).eq('tenant_id', tenantId);

  if (error) return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
  return NextResponse.json({ data: { id }, error: null });
}
