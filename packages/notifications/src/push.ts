/**
 * Expo Push Notifications.
 * Used for AI memory triggers (rebooking nudges) and booking updates.
 */
import { Expo, type ExpoPushMessage, type ExpoPushTicket } from 'expo-server-sdk';

export const expo = new Expo();

export interface SendPushParams {
  pushToken: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  badge?: number;
}

export interface PushResult {
  tickets: ExpoPushTicket[];
  invalidTokens: string[];
}

/**
 * Send a push notification to one or more Expo push tokens.
 */
export async function sendPushNotification(
  notifications: SendPushParams[]
): Promise<PushResult> {
  const messages: ExpoPushMessage[] = [];
  const invalidTokens: string[] = [];

  for (const { pushToken, title, body, data, badge } of notifications) {
    if (!Expo.isExpoPushToken(pushToken)) {
      invalidTokens.push(pushToken);
      continue;
    }
    messages.push({ to: pushToken, title, body, data, badge, sound: 'default' });
  }

  const chunks = expo.chunkPushNotifications(messages);
  const tickets: ExpoPushTicket[] = [];

  for (const chunk of chunks) {
    const chunkTickets = await expo.sendPushNotificationsAsync(chunk);
    tickets.push(...chunkTickets);
  }

  return { tickets, invalidTokens };
}

/**
 * Send an AI rebooking nudge push notification.
 */
export async function sendRebookingNudge(params: {
  pushToken: string;
  customerName: string;
  serviceName: string;
  tenantName: string;
}): Promise<PushResult> {
  const { pushToken, customerName, serviceName, tenantName } = params;
  return sendPushNotification([
    {
      pushToken,
      title: `Time to rebook, ${customerName}!`,
      body: `Your ${serviceName} at ${tenantName} is due again. Tap to book.`,
      data: { type: 'rebooking_nudge', service_name: serviceName },
    },
  ]);
}
