import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * GET /api/notifications/test
 * Diagnostic endpoint to check notification system health.
 * Returns info about env vars, push tokens, and recent notification logs.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check env vars (existence only, not values)
  const envCheck = {
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER: !!process.env.TWILIO_PHONE_NUMBER,
    RESEND_API_KEY: !!process.env.RESEND_API_KEY,
    RESEND_FROM_EMAIL: !!process.env.RESEND_FROM_EMAIL,
  };

  // Check push tokens for staff linked to this user
  const { data: staff } = await supabase
    .from('staff')
    .select('id, name, phone, notify_sms, notify_push')
    .eq('user_id', user.id)
    .single();

  let staffPushTokens: { token: string; platform: string | null }[] = [];
  if (staff) {
    const { data: tokens } = await supabase
      .from('staff_push_tokens')
      .select('token, platform')
      .eq('staff_id', (staff as { id: string }).id);
    staffPushTokens = (tokens as { token: string; platform: string | null }[] | null) ?? [];
  }

  // Check push tokens for customer linked to this user
  const { data: customer } = await supabase
    .from('customers')
    .select('id, display_name, phone, notify_sms, notify_push')
    .eq('user_id', user.id)
    .single();

  let customerPushTokens: { token: string; platform: string | null }[] = [];
  if (customer) {
    const { data: tokens } = await supabase
      .from('customer_push_tokens')
      .select('token, platform')
      .eq('customer_id', (customer as { id: string }).id);
    customerPushTokens = (tokens as { token: string; platform: string | null }[] | null) ?? [];
  }

  // Recent notification logs
  const { data: recentLogs } = await supabase
    .from('notification_log')
    .select('*')
    .order('sent_at', { ascending: false })
    .limit(20);

  return NextResponse.json({
    env: envCheck,
    staff: staff ? { ...(staff as Record<string, unknown>), pushTokenCount: staffPushTokens.length, pushTokens: staffPushTokens } : null,
    customer: customer ? { ...(customer as Record<string, unknown>), pushTokenCount: customerPushTokens.length, pushTokens: customerPushTokens } : null,
    recentNotifications: recentLogs ?? [],
  });
}
