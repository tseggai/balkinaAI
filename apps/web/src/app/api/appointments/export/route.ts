import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

async function getTenantId() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: tenant } = await supabase.from('tenants').select('id').eq('user_id', user.id).single();
  return (tenant as { id: string } | null)?.id ?? null;
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDuration(startTime: string, endTime: string): string {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const diffMs = end.getTime() - start.getTime();
  const minutes = Math.round(diffMs / 60000);
  return `${minutes} min`;
}

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) return NextResponse.json({ error: { message: 'Unauthorized' } }, { status: 401 });

  const supabase = createClient();
  const { data, error } = await supabase
    .from('appointments')
    .select('*, services(name), customers(display_name, email), staff(name)')
    .eq('tenant_id', tenantId)
    .order('start_time', { ascending: false });

  if (error) return NextResponse.json({ error: { message: error.message } }, { status: 500 });

  const rows = data ?? [];

  const headers = ['ID', 'Date', 'Customer', 'Email', 'Service', 'Staff', 'Status', 'Amount', 'Duration', 'Created'];

  const csvLines: string[] = [headers.join(',')];

  for (const row of rows) {
    const customer = row.customers as { display_name: string | null; email: string | null } | null;
    const service = row.services as { name: string } | null;
    const staff = row.staff as { name: string } | null;

    const line = [
      escapeCSV(row.id),
      escapeCSV(new Date(row.start_time).toLocaleString()),
      escapeCSV(customer?.display_name ?? 'Unknown'),
      escapeCSV(customer?.email ?? ''),
      escapeCSV(service?.name ?? ''),
      escapeCSV(staff?.name ?? ''),
      escapeCSV(row.status),
      escapeCSV(`$${(row.total_price ?? 0).toFixed(2)}`),
      escapeCSV(formatDuration(row.start_time, row.end_time)),
      escapeCSV(new Date(row.created_at).toLocaleString()),
    ].join(',');

    csvLines.push(line);
  }

  const csv = csvLines.join('\n');

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="appointments-${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
