import { NextResponse } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';

async function getStaffRecord() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const admin = createAdminClient();
  const { data: staff } = await admin
    .from('staff')
    .select('id, tenant_id')
    .eq('user_id', user.id)
    .single();

  return staff as { id: string; tenant_id: string } | null;
}

export async function GET() {
  const staff = await getStaffRecord();
  if (!staff) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const admin = createAdminClient();

  // Get staff timesheet/schedule
  const { data: staffRow } = await admin
    .from('staff')
    .select('availability_schedule, requires_approval')
    .eq('id', staff.id)
    .single();

  // Get special days
  const { data: specialDays } = await admin
    .from('staff_special_days')
    .select('*')
    .eq('staff_id', staff.id)
    .order('date');

  return NextResponse.json({
    data: {
      schedule: (staffRow as Record<string, unknown> | null)?.availability_schedule ?? {},
      requires_approval: (staffRow as Record<string, unknown> | null)?.requires_approval ?? false,
      special_days: specialDays ?? [],
    },
    error: null,
  });
}

export async function PATCH(request: Request) {
  const staff = await getStaffRecord();
  if (!staff) return NextResponse.json({ data: null, error: { message: 'Unauthorized' } }, { status: 401 });

  const body = await request.json() as {
    schedule?: Record<string, unknown>;
    requires_approval?: boolean;
    special_days?: { date: string; start_time?: string; end_time?: string; is_day_off: boolean; breaks?: unknown }[];
  };

  const admin = createAdminClient();

  // Update staff schedule fields
  const updateFields: Record<string, unknown> = {};
  if (body.schedule !== undefined) {
    updateFields.availability_schedule = body.schedule;
  }
  if (body.requires_approval !== undefined) {
    updateFields.requires_approval = body.requires_approval;
  }

  if (Object.keys(updateFields).length > 0) {
    const { error } = await admin
      .from('staff')
      .update(updateFields as never)
      .eq('id', staff.id);

    if (error) {
      return NextResponse.json({ data: null, error: { message: error.message } }, { status: 500 });
    }
  }

  // Replace special days if provided
  if (body.special_days !== undefined) {
    await admin.from('staff_special_days').delete().eq('staff_id', staff.id);

    if (body.special_days.length > 0) {
      const { error: sdErr } = await admin.from('staff_special_days').insert(
        body.special_days.map((sd) => ({
          staff_id: staff.id,
          date: sd.date,
          start_time: sd.start_time || null,
          end_time: sd.end_time || null,
          is_day_off: sd.is_day_off ?? false,
          breaks: JSON.stringify(sd.breaks ?? []),
        })) as never,
      );

      if (sdErr) {
        return NextResponse.json({ data: null, error: { message: sdErr.message } }, { status: 500 });
      }
    }
  }

  return NextResponse.json({ data: { success: true }, error: null });
}
