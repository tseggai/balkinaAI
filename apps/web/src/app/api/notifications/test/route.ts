import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendNotification } from '@/lib/notifications/send';

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

/**
 * POST /api/notifications/test
 * Send a test notification (push + SMS) to the authenticated user.
 * Body: { channel?: "push" | "sms" | "both" }
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  const { data: { user } } = await supabase.auth.getUser(authHeader.slice(7));
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({})) as { channel?: string; role?: string };
  const channel = body.channel ?? 'both';
  const role = body.role ?? 'auto'; // 'customer' | 'staff' | 'auto'

  const results: Record<string, unknown> = {};

  // Determine recipient
  let recipientType: 'customer' | 'staff' = 'customer';
  let recipientId: string | null = null;

  if (role !== 'staff') {
    const { data: customer } = await supabase
      .from('customers')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (customer) {
      recipientType = 'customer';
      recipientId = (customer as { id: string }).id;
    }
  }

  if (!recipientId || role === 'staff') {
    const { data: staffMember } = await supabase
      .from('staff')
      .select('id')
      .eq('user_id', user.id)
      .single();
    if (staffMember) {
      recipientType = 'staff';
      recipientId = (staffMember as { id: string }).id;
    }
  }

  if (!recipientId) {
    return NextResponse.json({ error: 'No customer or staff record linked to this user' }, { status: 404 });
  }

  // Temporarily override notification preferences for the test
  const overrideTable = recipientType === 'customer' ? 'customers' : 'staff';
  const overrideCol = recipientType === 'customer' ? 'id' : 'id';

  // Get current preferences
  const { data: prefs } = await supabase
    .from(overrideTable)
    .select('notify_sms, notify_push')
    .eq(overrideCol, recipientId)
    .single();

  const currentPrefs = prefs as { notify_sms: boolean | null; notify_push: boolean | null } | null;

  try {
    // Send test notification through the same pipeline as real notifications
    await sendNotification({
      type: 'booking_confirmed',
      recipientType,
      recipientId,
      data: {
        customerName: 'Test User',
        serviceName: 'Test Service',
        businessName: 'Balkina AI Test',
        date: new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
        time: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
      },
    });

    results.sent = true;
    results.recipientType = recipientType;
    results.recipientId = recipientId;
    results.channel = channel;
    results.preferences = currentPrefs;
  } catch (err) {
    results.sent = false;
    results.error = err instanceof Error ? err.message : String(err);
  }

  // Check what happened by reading the latest logs
  const { data: latestLogs } = await supabase
    .from('notification_log')
    .select('*')
    .eq('recipient_id', recipientId)
    .order('sent_at', { ascending: false })
    .limit(5);

  results.recentLogs = latestLogs ?? [];

  return NextResponse.json(results);
}
