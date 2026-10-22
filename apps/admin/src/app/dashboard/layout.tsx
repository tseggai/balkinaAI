import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DashboardShell } from '@/components/dashboard-shell';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Local UI preview only (never honoured in production builds): `ADMIN_PREVIEW_BYPASS=1 next dev`
  // renders the shell without a session so pages can be screenshotted with mocked APIs.
  if (process.env.NODE_ENV !== 'production' && process.env.ADMIN_PREVIEW_BYPASS === '1') {
    return <DashboardShell>{children}</DashboardShell>;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/auth/login');

  const role = (user.app_metadata?.role as string) ?? '';
  if (role !== 'platform_admin') redirect('/auth/login');

  return <DashboardShell>{children}</DashboardShell>;
}
