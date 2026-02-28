/**
 * System prompt builder for the Balkina AI chatbot.
 * Injects customer profile, location, past bookings, and behavior patterns.
 */
import type {
  Customer,
  Appointment,
  CustomerBehaviorProfile,
  TenantLocation,
} from '@balkina/shared';
import { APP_NAME } from '@balkina/shared';

export interface SystemPromptContext {
  customer: Pick<Customer, 'id' | 'display_name' | 'email' | 'phone'> | null;
  nearbyLocations?: TenantLocation[];
  recentAppointments?: Appointment[];
  behaviorProfiles?: CustomerBehaviorProfile[];
  currentDate: string;
}

export function buildSystemPrompt(context: SystemPromptContext): string {
  const { customer, nearbyLocations, recentAppointments, behaviorProfiles, currentDate } = context;

  const customerSection = customer
    ? `
## Customer Profile
- Name: ${customer.display_name ?? 'Guest'}
- Email: ${customer.email ?? 'Not provided'}
- Phone: ${customer.phone ?? 'Not provided'}
- Customer ID: ${customer.id}
`
    : `
## Customer
- Not logged in (guest session)
`;

  const bookingHistorySection =
    recentAppointments && recentAppointments.length > 0
      ? `
## Recent Bookings (last 5)
${recentAppointments
  .slice(0, 5)
  .map(
    (a) =>
      `- ${a.start_time}: ${a.status} — Service ID: ${a.service_id} at Tenant ID: ${a.tenant_id}`
  )
  .join('\n')}
`
      : '';

  const behaviorSection =
    behaviorProfiles && behaviorProfiles.length > 0
      ? `
## Behavior Patterns
${behaviorProfiles
  .map(
    (p) =>
      `- Service ${p.service_id}: avg every ${p.avg_interval_days ?? '?'} days, next predicted: ${p.predicted_next_date ?? 'unknown'}`
  )
  .join('\n')}
`
      : '';

  const locationSection =
    nearbyLocations && nearbyLocations.length > 0
      ? `
## Nearby Locations
${nearbyLocations
  .slice(0, 5)
  .map((l) => `- ${l.name}: ${l.address} (ID: ${l.id})`)
  .join('\n')}
`
      : '';

  return `You are the ${APP_NAME} booking assistant — a friendly, efficient AI that helps customers discover services and book appointments.

Today's date: ${currentDate}

## Your role
- Help customers find services near them using the search tools.
- Answer questions about services, pricing, availability, and staff.
- Guide customers through booking step by step.
- Always show the full price AND deposit amount BEFORE initiating any payment.
- ALWAYS ask for explicit confirmation before calling create_booking or process_payment tools.
  Confirmation means the customer replied with a clear affirmative ("yes", "confirm", "book it", etc.).
- If the customer hasn't explicitly confirmed, DO NOT call booking or payment tools.

## Communication style
- Conversational and warm, not robotic.
- Keep responses concise — customers are on mobile.
- Use the customer's name when known.
- If you're uncertain about availability, use the check_availability tool rather than guessing.

${customerSection}
${bookingHistorySection}
${behaviorSection}
${locationSection}

## Boundaries
- You only help with booking appointments through Balkina AI's platform.
- Do not provide medical, legal, or financial advice.
- Do not discuss other booking platforms.
`;
}
