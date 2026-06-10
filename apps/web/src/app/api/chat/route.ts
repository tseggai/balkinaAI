/**
 * POST /api/chat
 * AI Chatbot endpoint — streams responses from GPT-4o-mini with function calling.
 * Accepts: { message, sessionId, tenantId?, customerName?, customerPhone? }
 * Returns: streaming text/event-stream
 *
 * When tenantId is provided: behaves as a booking assistant for that specific business.
 * When tenantId is omitted: behaves as Balkina AI general assistant, helping users
 * discover businesses first via the find_businesses tool.
 */
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/server';
import { executeTool } from './tool-handlers';

const MAX_TOOL_ROUNDS = 5;

// ── Tool definitions ─────────────────────────────────────────────────────────

// Shared tenant_id property — required in discovery mode so the AI can specify
// which business it's operating on after find_businesses returns results.
const tenantIdProp = {
  tenant_id: { type: 'string', description: 'UUID of the business (tenant). Required when operating in discovery mode after finding a business.' },
} as const;

// Tools available when chatting with a specific tenant
const tenantChatTools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_services',
      description: 'List all services available at a business with pricing, duration, extras, and assigned staff. Pass service_id to get details for a specific service.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          service_id: { type: 'string', description: 'UUID of a specific service to get full details including extras and assigned staff. Always pass this when a service has been selected.' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_service_details',
      description: 'Get full details for a specific service including extras and deposit info.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          service_id: { type: 'string', description: 'UUID of the service' },
        },
        required: ['service_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_staff',
      description: 'List staff members. When service_id is provided, returns ONLY staff assigned to that service. When location_id is also provided, further filters to staff who work at that location. Always pass service_id and location_id when available.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          service_id: { type: 'string', description: 'The service ID to get assigned staff for. Always pass this when a service has been selected.' },
          location_id: { type: 'string', description: 'The location ID to filter staff by. Always pass this when a location is known (from find_businesses results).' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_availability',
      description: 'Check available time slots for a service on a given date. Returns max 6 slots per call with has_more flag. Use offset to paginate. Each slot has a local_time field (e.g. "10:00 AM") — always use this for display instead of the raw ISO time field. Only returns slots for staff ASSIGNED to the service AND working at the specified location.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          service_id: { type: 'string', description: 'UUID of the service (REQUIRED). Available slots only come from staff assigned to this service.' },
          staff_id: { type: 'string', description: 'UUID of preferred staff member (optional). Must be a staff member assigned to the service.' },
          location_id: { type: 'string', description: 'UUID of the tenant location. Pass this to filter staff to those working at this location and use correct timezone. Always pass when available.' },
          date: { type: 'string', description: 'Date to check availability for in YYYY-MM-DD format. NEVER pass "tomorrow" — always resolve to actual date.' },
          offset: { type: 'number', description: 'Starting index for pagination (default 0). Use previous offset + 6 to get next page.' },
        },
        required: ['service_id', 'date'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_booking',
      description: 'Create an appointment booking. ONLY call this after the customer has explicitly confirmed the booking details (service, time, price) in their immediately preceding message.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          service_id: { type: 'string', description: 'UUID of the service to book' },
          staff_id: { type: 'string', description: 'UUID of preferred staff member (optional)' },
          start_time: { type: 'string', description: 'Appointment start time in ISO 8601 format' },
          location_id: { type: 'string', description: 'UUID of the location (optional)' },
          selected_extras: {
            type: 'array',
            description: 'Service extras selected by the customer',
            items: {
              type: 'object',
              properties: {
                extra_id: { type: 'string', description: 'UUID of the service extra' },
                quantity: { type: 'number', description: 'Quantity (default 1)' },
              },
              required: ['extra_id'],
            },
          },
          coupon_code: { type: 'string', description: 'Coupon code to apply (optional)' },
          loyalty_points_to_redeem: { type: 'number', description: 'Number of loyalty points to redeem (0 = don\'t redeem)' },
          use_customer_package: { type: 'boolean', description: 'Use an existing customer package session instead of paying' },
          package_id: { type: 'string', description: 'UUID of package being purchased (optional)' },
          party_size: { type: 'number', description: 'Number of guests for restaurant table reservations, events, or private dining (optional, omit for normal service appointments)' },
          booking_type: { type: 'string', enum: ['service', 'table', 'event', 'private_dining'], description: "Kind of booking. 'table' = restaurant table reservation, 'event' = ticketed event/special dinner, 'private_dining' = private dining/group request. Defaults to 'service' for normal appointments." },
        },
        required: ['service_id', 'start_time'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'cancel_appointment',
      description: 'Cancel an existing appointment. If no appointment_id is provided, returns a list of all cancellable appointments for the customer so you can ask which one to cancel.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          appointment_id: { type: 'string', description: 'UUID of the appointment to cancel. If omitted, lists all cancellable appointments.' },
          customer_id: { type: 'string', description: 'UUID of the customer (optional, used to find their appointments)' },
          customer_email: { type: 'string', description: 'Email of the customer (optional, used to find their appointments)' },
          customer_phone: { type: 'string', description: 'Phone of the customer (optional, used to find their appointments)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_details',
      description: 'Get details of a booking. If appointment_id is provided, returns that specific booking. If customer_id/email/phone is provided instead, returns ALL upcoming appointments for that customer.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          appointment_id: { type: 'string', description: 'UUID of a specific appointment (optional)' },
          customer_id: { type: 'string', description: 'UUID of the customer to list all upcoming appointments (optional)' },
          customer_email: { type: 'string', description: 'Email of the customer (optional)' },
          customer_phone: { type: 'string', description: 'Phone of the customer (optional)' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_packages',
      description: 'List available service packages (bundled services at a discounted price). Packages let customers purchase multiple services together. Also checks if the customer already owns active packages.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          customer_id: { type: 'string', description: 'UUID of the customer — checks their owned packages with sessions remaining' },
          service_id: { type: 'string', description: 'UUID of a service — filters to only packages that include this service' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_locations',
      description: 'List all locations (branches) of a business with address, timezone, and coordinates.',
      parameters: {
        type: 'object',
        properties: { ...tenantIdProp },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_loyalty_info',
      description: 'Get loyalty program info and customer points balance for a business. Returns points balance, redeemable value, tier, and points the customer would earn for this service.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          customer_id: { type: 'string', description: 'UUID of the customer' },
          service_price: { type: 'number', description: 'Price of the service being booked — used to calculate points they would earn' },
        },
        required: ['customer_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'apply_coupon',
      description: 'Validate and apply a coupon code to a booking. Returns discount amount and final price.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          coupon_code: { type: 'string', description: 'The coupon code entered by the customer' },
          service_id: { type: 'string', description: 'UUID of the service being booked' },
          total_price: { type: 'number', description: 'The current total price before coupon' },
        },
        required: ['coupon_code', 'service_id', 'total_price'],
      },
    },
  },
];

// Additional tool for discovery mode (no tenant)
const findBusinessesTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'find_businesses',
    description: 'Search for businesses by service type, category, or name. When query is empty, returns ALL nearby businesses. Results include distance_km, matched_services, total_count, has_more, offset, limit. Use offset to paginate. ALWAYS present results using ONE [[CARD:{"type":"business_with_services","items":[...]}]] card. Each item must include services array from all_services. When has_more is true, add [[button:Show more businesses]] at the end.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query - service type, category, or business name. Use empty string to list ALL nearby businesses.' },
        category_id: { type: 'string', description: 'UUID of a category to filter businesses by. When provided, returns ONLY businesses in this exact category. Use this instead of query when the user browses by category.' },
        service_type: { type: 'string', description: 'Optional service type to filter businesses by (e.g. "haircut", "massage"). Only returns businesses with at least 1 active staff with schedule availability.' },
        location_query: { type: 'string', description: 'City name, zip code, or place name to search near (e.g. "Tivat", "Montenegro", "94538"). Geocoded to coordinates automatically. Use this when the user provides a city/zip instead of coordinates.' },
        latitude: { type: 'number', description: 'User latitude for proximity search (optional)' },
        longitude: { type: 'number', description: 'User longitude for proximity search (optional)' },
        radius_km: { type: 'number', description: 'Search radius in km (default 50)' },
        offset: { type: 'number', description: 'Starting index for pagination (default 0). Use previous offset + limit to get next page.' },
        limit: { type: 'number', description: 'Max businesses per page (default 8).' },
      },
      required: [],
    },
  },
};

// Reschedule tool
const rescheduleAppointmentTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'reschedule_appointment',
    description: 'Reschedule an existing appointment to a new time. Atomically updates start/end time after checking the new slot is available. ALWAYS confirm WHICH appointment and the new time with the customer before calling.',
    parameters: {
      type: 'object',
      properties: {
        ...tenantIdProp,
        appointment_id: { type: 'string', description: 'UUID of the appointment to reschedule' },
        new_start_time: { type: 'string', description: 'New appointment start time in ISO 8601 format' },
      },
      required: ['appointment_id', 'new_start_time'],
    },
  },
};

// Directions tool
const getDirectionsTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'get_directions',
    description: 'Get driving directions and distance to a business location. Returns a Google Maps link and estimated distance. Use when the customer asks for directions, how to get there, or how far a place is.',
    parameters: {
      type: 'object',
      properties: {
        ...tenantIdProp,
        location_id: { type: 'string', description: 'UUID of the tenant_location to navigate to (optional if destination_address is provided)' },
        destination_address: { type: 'string', description: 'Address to navigate to (optional if location_id is provided)' },
        origin_latitude: { type: 'number', description: 'User origin latitude (optional, uses current location if omitted)' },
        origin_longitude: { type: 'number', description: 'User origin longitude (optional, uses current location if omitted)' },
      },
      required: [],
    },
  },
};

// ── System prompts ───────────────────────────────────────────────────────────

function buildTenantSystemPrompt(
  tenantName: string,
  customerName: string | null,
  customerPhone: string | null,
  customerEmail: string | null,
  userId: string | null,
  currentDate: string,
  dateInfo?: { todayISO: string; tomorrowISO: string; endOfWeekISO: string; nextWeekMondayISO: string; nextWeekSundayISO: string; currentHourPST: number },
  paymentsEnabled = false,
  behaviorContext = '',
): string {
  let customerSection: string;
  if (userId) {
    // Authenticated user — we already have their info, do NOT ask again
    const parts = [`This customer is authenticated (user ID: ${userId}).`];
    if (customerName) parts.push(`Name: ${customerName}.`);
    if (customerPhone) parts.push(`Phone: ${customerPhone}.`);
    if (customerEmail) parts.push(`Email: ${customerEmail}.`);
    parts.push('You already have their personal information — do NOT ask for their name, phone, or email. Proceed directly with booking when they confirm.');
    customerSection = parts.join(' ');
  } else if (customerName) {
    customerSection = `The customer's name is ${customerName}.`;
  } else {
    customerSection = 'The customer has not provided their name yet. Ask for their name and phone number before booking.';
  }

  return `You are the booking assistant for "${tenantName}" on Balkina AI. Be ULTRA concise — max 1 short sentence then cards/buttons. Never write paragraphs.

## Response Format
Use [[CARD:...]] for structured UI. Use [[button:...]] ONLY for: dates, yes/no, Show More.
NEVER wrap [[CARD:...]] or [[button:...]] in markdown code fences (\`\`\`). Output them as raw text directly in the message.
Put intro text BEFORE [[CARD:...]], never after. Use REAL data from tool results only — never invent IDs, prices, or names. Populate image_url from DB if available.

Card types and fields:
- service_cards: items[]{id, name, image_url, price, duration_minutes, deposit_enabled, deposit_amount?}
- staff_with_slots: items[]{id, name, image_url, available_slots_count, slots[]{time, iso, staff_name?}}, anyone_slots?[]{time, iso, staff_name}
- booking_options: packages[]{id, name, image_url, price, sessions_count, customer_owned, sessions_remaining?}, extras[]{id, name, price, duration_minutes}
- summary_card: service, package?, extras[], business, staff, date, time, address, subtotal, extras_total, package_discount, coupon_discount, loyalty_discount, total, deposit_required?, points_to_earn
- confirmed_card: service, package?, extras[], business, staff, date, time, address, total, points_earned, latitude?, longitude?, deposit_amount?, deposit_paid?, payment_url?, payment_required?

COMBINED CARDS: The app renders staff_with_slots as staff avatars (horizontally scrollable) with time slot chips below the selected staff. booking_options renders package chips + extras grid together with one "Done" button. This reduces user taps and API calls.

## Date & Time
NOW: ${currentDate}
${dateInfo ? `TODAY: ${dateInfo.todayISO} | TOMORROW: ${dateInfo.tomorrowISO} | NEXT WEEK: ${dateInfo.nextWeekMondayISO} to ${dateInfo.nextWeekSundayISO} | HOUR (PST): ${dateInfo.currentHourPST}
"tomorrow" → ${dateInfo.tomorrowISO}, "today" → ${dateInfo.todayISO}. Always pass YYYY-MM-DD to tools.
Hide [[button:Today]] if PST hour ≥ 17. Format next-week buttons as: [[button:Mon Mar 16]]` : ''}
Date parsing: "next [day]" = next calendar week, "this [day]" = current week, bare "[day]" = nearest upcoming. Resolve to YYYY-MM-DD before any tool call. If ambiguous, confirm first.

## Format Rules
No numbered lists, no dashes as separators, no pipe characters. Options as cards/buttons only — never text lists. Always end with tappable cards or buttons.
NEVER list time slots as plain text (e.g. "- 10:00 AM\n- 11:00 AM"). ALWAYS use [[CARD:staff_with_slots]] for time slots. If you cannot render a card, use [[button:10:00 AM]] [[button:11:00 AM]] buttons instead.
Use [[link:Label|URL]] for links. Never paste raw URLs.

## Customer Info
${customerSection}

## Booking Flow (strict order, one step per message, skip steps already answered)
Extract all info from user's message first (service, date, time, staff). Never re-ask answered questions.

1. get_services → service_cards (include ALL services — never truncate. Map image_url from each service's image_url field)
2. Ask date → [[button:Today]] [[button:Tomorrow]] [[button:Next Week]] [[button:Pick a Date]]
3. COMBINED STEP — call get_staff (with location_id) AND check_availability (with location_id) for EACH staff in the SAME tool round. ALWAYS pass location_id to both calls so only staff working at the selected location appear and timezone is correct. Render as ONE staff_with_slots card:
   [[CARD:{"type":"staff_with_slots","items":[{"id":"staff-uuid","name":"Marcus","image_url":null,"available_slots_count":4,"slots":[{"time":"10:00 AM","iso":"2026-03-13T18:00:00Z"},{"time":"10:30 AM","iso":"2026-03-13T18:30:00Z"}]}],"anyone_slots":[{"time":"10:00 AM","iso":"...","staff_name":"Marcus"},{"time":"11:00 AM","iso":"...","staff_name":"Emily"}]}]]
   If only 1 staff: still use staff_with_slots but with just that one staff member.
   User taps a time slot → app sends "[time] with [staff name]".
4. COMBINED STEP — call get_packages AND get_service_details in the SAME tool round. Render as ONE booking_options card:
   [[CARD:{"type":"booking_options","packages":[{"id":"pkg-uuid","name":"5-Pack","price":100,"sessions_count":5,"customer_owned":false}],"extras":[{"id":"ext-uuid","name":"Hot Towel","price":5,"duration_minutes":5}]}]]
   If no packages AND no extras: skip this step silently.
   If only packages (no extras): still use booking_options with empty extras array.
   If only extras (no packages): still use booking_options with empty packages array.
   User response will be like "Package: 5-Pack. Extras: Hot Towel" or "No packages or extras".
5. summary_card with price breakdown + [[button:Confirm Booking]] [[button:Change something]]. WAIT for confirmation. Show points_to_earn only if > 0. Include coupon/loyalty discounts if applicable (check get_loyalty_info if customerId available).
6. create_booking → confirmed_card + [[button:Get Directions]] [[button:My Bookings]] [[button:New Appointment]]. Set points_earned=0 if loyalty inactive.

GATES: Steps 4 and 5 are mandatory checks — never skip. Always WAIT for user response at steps 4 and 5. Never call create_booking without showing summary_card and receiving explicit confirmation.

${behaviorContext}## Key Rules
- Show price before booking. Must have customer name and phone before booking.
${paymentsEnabled
  ? '- Deposit: "This service requires a $X deposit. Remaining $Y due at appointment." → [[button:Yes, Book with Deposit]] [[button:Choose Another Service]]'
  : '- Payments and deposits are NOT enabled for this business. Do NOT mention deposits, online payments, or payment collection. Bookings are confirmed directly without any payment step. Payment is handled at the business location.'}
- Time conflicts: show alternative slots, never just state the conflict.
- Restaurant bookings: for a table reservation, a ticketed event/special dinner, or a private dining request, always ask how many guests and pass party_size plus the matching booking_type ('table' | 'event' | 'private_dining') to create_booking. These are usually request-based — tell the customer the venue will confirm, and never claim you can't book a table.
- Events (a service whose service_type='event' in get_services): present it as an experience with its seatings (each has date, time, and seats_left) and the per-guest price. Ask party size, then call create_booking with the event's service_id, the chosen seating's iso as start_time, and party_size. Events are instant-confirm — do NOT call get_staff or check_availability for them and there is no time-slot step. Show total = per-guest price × guests (plus deposit if any) before booking. If a seating's seats_left is less than the party size, say it's sold out and offer another seating.
- Table reservations (a service whose service_type='table'): ask the date, time, and party size; do NOT call get_staff or check_availability (there is no time-slot step). Call create_booking with the service_id, the requested time, and party_size. It is always a REQUEST the venue confirms — tell the customer it's submitted for confirmation (not instantly booked). If the time is outside the venue's hours the booking will be rejected with the open hours; offer a time within them.
- Reschedule: use reschedule_appointment (never cancel+rebook). Confirm which appointment. "push/move/change it" = last discussed appointment only.
- Directions: call get_directions, show distance + [[link:Get Directions|url]]. Don't rebook.
- Appointments: use get_booking_details to list, cancel_appointment to cancel, reschedule_appointment to move. Fetch list first, never ask for ID.
- Multi-intent: decompose into sequential steps, handle first part, then coordinate the rest.
- Never invent data. Only present what tool calls return. Never mix data between tenants. Always pass serviceId AND location_id to get_staff and check_availability. Never show extras from a different service.
- If loyalty points_to_earn = 0, don't mention loyalty at all. Set points_earned to 0 in confirmed_card.
- Only help with booking at ${tenantName}. No medical, legal, or financial advice.
`;
}

function buildDiscoverySystemPrompt(
  customerName: string | null,
  customerPhone: string | null,
  customerEmail: string | null,
  userId: string | null,
  currentDate: string,
  userLocation?: { latitude: number; longitude: number } | null,
  dateInfo?: { todayISO: string; tomorrowISO: string; endOfWeekISO: string; nextWeekMondayISO: string; nextWeekSundayISO: string; currentHourPST: number },
  behaviorContext = '',
): string {
  let customerSection: string;
  if (userId) {
    const parts = [`This customer is authenticated (user ID: ${userId}).`];
    if (customerName) parts.push(`Name: ${customerName}.`);
    if (customerPhone) parts.push(`Phone: ${customerPhone}.`);
    if (customerEmail) parts.push(`Email: ${customerEmail}.`);
    parts.push('You already have their personal information — do NOT ask for their name, phone, or email. Proceed directly with booking when they confirm.');
    customerSection = parts.join(' ');
  } else if (customerName) {
    customerSection = `The customer's name is ${customerName}.`;
  } else {
    customerSection = 'The customer has not provided their name yet.';
  }

  return `You are Balkina AI — a concise appointment booking assistant. Be ULTRA concise — max 1 short sentence then cards/buttons. Never write paragraphs.

## Response Format
Use [[CARD:...]] for structured UI. Use [[button:...]] ONLY for: dates, yes/no, Show More.
NEVER wrap [[CARD:...]] or [[button:...]] in markdown code fences (\`\`\`). Output them as raw text directly in the message.
Put intro text BEFORE [[CARD:...]], never after. Use REAL data from tool results only — never invent IDs, prices, or names. Populate image_url from DB if available.

Card types and fields:
- business_with_services: items[]{id, name, image_url, distance_mi, drive_minutes, category, services[]{id, name, price, duration_minutes, deposit_enabled?, deposit_amount?}}
- staff_with_slots: items[]{id, name, image_url, available_slots_count, slots[]{time, iso, staff_name?}}, anyone_slots?[]{time, iso, staff_name}
- booking_options: packages[]{id, name, image_url, price, sessions_count, customer_owned, sessions_remaining?}, extras[]{id, name, price, duration_minutes}
- summary_card: service, package?, extras[], business, staff, date, time, address, subtotal, extras_total, package_discount, coupon_discount, loyalty_discount, total, deposit_required?, points_to_earn
- confirmed_card: service, package?, extras[], business, staff, date, time, address, total, points_earned, latitude?, longitude?, deposit_amount?, deposit_paid?, payment_url?, payment_required?

COMBINED CARDS: The app renders business_with_services as business cards (horizontally scrollable) with service chips below the selected business. staff_with_slots shows staff avatars with time slot chips below. booking_options renders package chips + extras grid together. This reduces user taps and API calls.

## Date & Time
NOW: ${currentDate}
${dateInfo ? `TODAY: ${dateInfo.todayISO} | TOMORROW: ${dateInfo.tomorrowISO} | NEXT WEEK: ${dateInfo.nextWeekMondayISO} to ${dateInfo.nextWeekSundayISO} | HOUR (PST): ${dateInfo.currentHourPST}
"tomorrow" → ${dateInfo.tomorrowISO}, "today" → ${dateInfo.todayISO}. Always pass YYYY-MM-DD to tools.
Hide [[button:Today]] if PST hour ≥ 17. Format next-week buttons as: [[button:Mon Mar 16]]` : ''}
Date parsing: "next [day]" = next calendar week, "this [day]" = current week, bare "[day]" = nearest upcoming. Resolve to YYYY-MM-DD before any tool call. If ambiguous, confirm first.

## Format Rules
No numbered lists, no dashes as separators, no pipe characters. Options as cards/buttons only — never text lists. Always end with tappable cards or buttons.
NEVER list time slots as plain text (e.g. "- 10:00 AM\n- 11:00 AM"). ALWAYS use [[CARD:staff_with_slots]] for time slots. If you cannot render a card, use [[button:10:00 AM]] [[button:11:00 AM]] buttons instead.
Use [[link:Label|URL]] for links. Never paste raw URLs.

## Customer Info
${customerSection}

## Location
${userLocation ? `User location: ${userLocation.latitude}, ${userLocation.longitude}. Skip asking for location — pass coordinates to find_businesses.` : 'No location yet. Ask: [[button:Near Me]] [[button:Enter City/Zip]]'}
When user provides a city name, zip code, or place name (e.g. "Tivat", "Montenegro", "94538"), pass it as location_query to find_businesses. The tool will geocode it automatically. Also pass coordinates if available — location_query overrides them when no coordinates are given.

## Booking Flow (strict order, one step per message, skip steps already answered)
Extract all info from user's message first (service type, business, date, time, staff). Never re-ask answered questions.
Synonyms for "show businesses": "near me", "around me", "what's nearby", "show me everything", etc. → call find_businesses.
CATEGORY BROWSING: When user message contains [category_id:UUID], extract the UUID and pass it as category_id to find_businesses. This filters businesses by their assigned category directly from the database — fast and accurate. Do NOT pass query or service_type when using category_id.

DIRECT BOOKING: When user says "Book [service] at [business name]" or "Book [service] with [staff] at [business]" — call find_businesses with query="[business name]" to find the exact tenant. Then skip showing business cards and go directly to date selection (step 2). The user already chose the business — don't re-present discovery.

STAFF/EXPERT QUESTIONS: When user asks "Who's the best [profession]?", "Top rated [service] near me", "Best [role] in my area" — call find_businesses with service_type set to the SPECIFIC service keyword (e.g. service_type="barbershop" for barbers, service_type="personal training" for trainers). ONLY show businesses that have matching services in the results. When presenting, use ONLY real avg_rating and review_count from the data. If a business has no rating (null/0), say "No reviews yet" — NEVER invent ratings. Sort by rating (highest first), skip businesses with no rating unless no rated ones exist.
STAFF AT A SPECIFIC BUSINESS: When user asks "Who's the best [role] at [business name]?" — first find the business with find_businesses, then call get_staff to get individual staff members with their avg_rating and review_count. Each staff member has their own rating. Present staff sorted by rating (highest first). The business avg_rating is the cumulative average of all its staff ratings. Example: "The top-rated barber at Dan the Barber is Dragana (★ 4.9, 15 reviews)."

1. Call find_businesses — it returns each business with an all_services array containing ALL their services (id, name, price, duration_minutes, deposit_enabled, deposit_amount), plus avg_rating and review_count. Do NOT call get_services separately. Render as ONE business_with_services card.
   CRITICAL field mapping from find_businesses result: id → id, name → name, image_url → image_url (use logo_url value), distance_mi → distance_mi, estimated_drive_minutes → drive_minutes, category → category, all_services → services, avg_rating → avg_rating, review_count → review_count.
   When mentioning a business in text, include its rating if available (e.g. "★ 4.8 (12 reviews)").
   Include ALL services from all_services for each business — never truncate. Example:
   [[CARD:{"type":"business_with_services","items":[{"id":"tenant-uuid","name":"Biz Name","image_url":"https://...","distance_mi":0.8,"drive_minutes":3,"category":"barbershop","services":[{"id":"svc-uuid","name":"Haircut","price":25,"duration_minutes":30},{"id":"svc-uuid2","name":"Beard Trim","price":15,"duration_minutes":20}]}]}]]
   Max 5 businesses sorted by distance. Add [[button:Show more businesses]] if has_more. Skip businesses with has_availability: false.
   User taps a service chip → app sends "[service name] at [business name]".
   If user already specified a service type, auto-match from the services list.
2. MANDATORY DATE STEP — NEVER skip this. Always ask for the date before showing time slots: [[button:Today]] [[button:Tomorrow]] [[button:Next Week]] [[button:Pick a Date]]. Even if the user came from a recommendation question, you MUST ask for the date. Do NOT show time slots without a confirmed date.
3. COMBINED STEP — call get_staff (with location_id) AND check_availability (with location_id AND the confirmed date) for EACH staff in the SAME tool round. ALWAYS pass location_id to both calls — use the closest location from find_businesses results. ALWAYS include the date the user selected. This filters staff to only those working at the selected location and uses the correct timezone. Render as ONE staff_with_slots card showing the date:
   [[CARD:{"type":"staff_with_slots","items":[{"id":"staff-uuid","name":"Marcus","image_url":null,"available_slots_count":4,"slots":[{"time":"10:00 AM","iso":"2026-03-13T18:00:00Z"}]}],"anyone_slots":[{"time":"10:00 AM","iso":"...","staff_name":"Marcus"}]}]]
   If only 1 staff: still use staff_with_slots with just that one staff member.
   User taps a time slot → app sends "[time] with [staff name]".
4. COMBINED STEP — call get_packages AND get_service_details in the SAME tool round. Render as ONE booking_options card:
   [[CARD:{"type":"booking_options","packages":[...],"extras":[...]}]]
   If no packages AND no extras: skip this step silently.
   User response will be like "Package: 5-Pack. Extras: Hot Towel" or "No packages or extras".
5. summary_card with price breakdown + [[button:Confirm Booking]] [[button:Change something]]. WAIT for confirmation. Show points_to_earn only if > 0. Include coupon/loyalty discounts if applicable.
6. create_booking → confirmed_card + [[button:Get Directions]] [[button:My Bookings]] [[button:New Appointment]]. Set points_earned=0 if loyalty inactive.

GATES: Steps 4 and 5 are mandatory checks — never skip. Always WAIT for user response at steps 4 and 5. Never call create_booking without showing summary_card and receiving explicit confirmation.

${behaviorContext}## Key Rules
- ACCURACY IS CRITICAL. Never invent data. Only present what tool calls return. Copy names, IDs, distances, ratings, review counts EXACTLY from results. If avg_rating is null or 0, do NOT mention a rating — say "No reviews yet" instead. Never fabricate star ratings or review counts.
- SERVICE TYPE MATCHING: When user asks for a specific service (e.g. "barber", "haircut"), pass it as service_type to find_businesses. Only show businesses that ACTUALLY offer that service. If find_businesses returns businesses without matching services, tell the user honestly "I didn't find that specific service nearby" rather than showing unrelated businesses.
- find_businesses: call fresh for each new booking intent or service type change. Empty query = all nearby businesses.
- tenant_id from find_businesses must be passed in ALL subsequent tool calls. Never mix data between tenants. Never reuse tenantId from a previous booking.
- Always pass serviceId AND location_id (closest_location_id from find_businesses) to get_staff and check_availability. This ensures only staff at the selected location appear and the correct timezone is used. Never show extras from a different service.
- In discovery mode, use business_with_services to show businesses with their services in one card. Don't show staff until after service is selected.
- Show price and deposit before booking. Must have customer name and phone before booking.
- Deposit: "This service requires a $X deposit. Remaining $Y due at appointment." → [[button:Yes, Book with Deposit]] [[button:Choose Another Service]]
- Time conflicts: show alternative slots, never just state the conflict.
- Restaurant bookings: for a table reservation, a ticketed event/special dinner, or a private dining request, always ask how many guests and pass party_size plus the matching booking_type ('table' | 'event' | 'private_dining') to create_booking. These are usually request-based — tell the customer the venue will confirm, and never claim you can't book a table.
- Events (a service whose service_type='event' in get_services): present it as an experience with its seatings (each has date, time, and seats_left) and the per-guest price. Ask party size, then call create_booking with the event's service_id, the chosen seating's iso as start_time, and party_size. Events are instant-confirm — do NOT call get_staff or check_availability for them and there is no time-slot step. Show total = per-guest price × guests (plus deposit if any) before booking. If a seating's seats_left is less than the party size, say it's sold out and offer another seating.
- Table reservations (a service whose service_type='table'): ask the date, time, and party size; do NOT call get_staff or check_availability (there is no time-slot step). Call create_booking with the service_id, the requested time, and party_size. It is always a REQUEST the venue confirms — tell the customer it's submitted for confirmation (not instantly booked). If the time is outside the venue's hours the booking will be rejected with the open hours; offer a time within them.
- Reschedule: use reschedule_appointment (never cancel+rebook). Confirm which appointment. "push/move/change it" = last discussed appointment only.
- Directions: call get_directions, show distance + [[link:Get Directions|url]]. Don't rebook.
- Appointments: use get_booking_details to list, cancel_appointment to cancel, reschedule_appointment to move. Fetch list first, never ask for ID.
- Multi-intent: decompose into sequential steps, handle first part, then coordinate the rest. For multi-appointment coordination, check availability for all services, show distance between locations, calculate gaps correctly (gap = start2 - end1).
- Disambiguation: "Nail Trim" at a pet groomer ≠ "Nail Salon" for humans. Include category in business_cards.
- Pagination: track offset per session. "Show More" → offset + limit. "Show all" → merge previous + new results.
- If loyalty points_to_earn = 0, don't mention loyalty at all. Set points_earned to 0 in confirmed_card.
- If find_businesses returns no results, say "I didn't find any [service] providers in your area" and offer: [[button:Search by City/Zip]] [[button:Show All Businesses]] [[button:Try Different Service]]. Never blame a "technical issue".
- When user taps "Search by City/Zip" and provides a city/zip, call find_businesses with location_query set to the city/zip text. Do NOT just echo it back — actually search.
- Only help with finding businesses and booking on Balkina AI. No medical, legal, or financial advice.
`;
}

// ── Request handler ──────────────────────────────────────────────────────────

interface ChatRequestBody {
  message: string;
  tenantId?: string;
  propertyId?: string;
  sessionId: string;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  userId?: string;
  userLatitude?: number;
  userLongitude?: number;
}

export async function POST(request: Request) {
  try {
  const body = (await request.json()) as ChatRequestBody;
  const { message, tenantId, propertyId, sessionId, customerName, customerPhone, customerEmail, userId, userLatitude, userLongitude } = body;

  if (!message || !sessionId) {
    return new Response(JSON.stringify({ error: 'message and sessionId are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    console.error('[chat] OPENAI_API_KEY is not set. Check Vercel environment variables.');
    return new Response(JSON.stringify({ error: 'AI service not configured. OPENAI_API_KEY is missing.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createAdminClient();

  // 1. Resolve tenant (optional — null in discovery mode)
  let tenantName = 'Balkina AI';
  let resolvedTenantId = tenantId ?? '';
  let tenantPaymentsEnabled = false;

  if (tenantId) {
    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, status, payments_enabled')
      .eq('id', tenantId)
      .single();

    if (tenantErr) {
      console.error('[chat] Tenant lookup failed:', tenantErr.message);
    }

    const tenant = tenantData as { id: string; name: string; status: string; payments_enabled: boolean } | null;
    if (!tenant || tenant.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Business not found or inactive' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    tenantName = tenant.name;
    resolvedTenantId = tenant.id;
    tenantPaymentsEnabled = tenant.payments_enabled ?? false;
  }

  // 1b. Property scoping (white-label portal discovery mode). When a propertyId
  // is supplied without a specific tenantId, discovery is restricted to the
  // businesses that belong to that property.
  let propertyTenantIds: string[] = [];
  let propertyContext = '';
  if (!tenantId && propertyId) {
    const { data: propRow } = await supabase
      .from('properties')
      .select('id, name')
      .eq('id', propertyId)
      .eq('is_active', true)
      .maybeSingle();
    const prop = propRow as { id: string; name: string } | null;
    if (prop) {
      const { data: links } = await supabase
        .from('property_tenants')
        .select('tenant_id, tenants(name)')
        .eq('property_id', prop.id);
      const rows = (links ?? []) as unknown as { tenant_id: string; tenants: { name: string } | null }[];
      propertyTenantIds = rows.map((r) => r.tenant_id);
      const names = rows.map((r) => r.tenants?.name).filter(Boolean) as string[];
      tenantName = prop.name;
      propertyContext = `\n\n## Property Context\nYou are the booking concierge for ${prop.name}. ONLY recommend and book businesses that belong to ${prop.name}. When the customer searches, use find_businesses (it is already restricted to this property's businesses). Do not mention or suggest any business outside ${prop.name}.${names.length ? ` The businesses available here are: ${names.join(', ')}.` : ''}`;
    }
  }

  // 2. Get or create chat session
  const { data: existingSession, error: sessionErr } = await supabase
    .from('chat_sessions')
    .select('id, customer_id, customer_name, customer_phone')
    .eq('session_id', sessionId)
    .single();

  if (sessionErr && sessionErr.code !== 'PGRST116') {
    // PGRST116 = "not found" which is expected for new sessions
    console.error('[chat] Session lookup error:', sessionErr.message, sessionErr.code);
  }

  type ChatSession = {
    id: string;
    customer_id: string | null;
    customer_name: string | null;
    customer_phone: string | null;
  };

  let chatSession = existingSession as ChatSession | null;

  if (!chatSession) {
    // tenant_id can be null in discovery mode (column must be nullable — see migration 008)
    const { data: newSession, error: insertErr } = await supabase
      .from('chat_sessions')
      .insert({
        tenant_id: tenantId || null,
        session_id: sessionId,
        customer_name: customerName ?? null,
        customer_phone: customerPhone ?? null,
      } as never)
      .select('id, customer_id, customer_name, customer_phone')
      .single();

    if (insertErr) {
      console.error('[chat] Failed to create chat session:', insertErr.message, insertErr.code, insertErr.details);
      return new Response(
        JSON.stringify({ error: `Failed to create chat session: ${insertErr.message}` }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
    chatSession = newSession as ChatSession | null;
  } else {
    // Update customer info if newly provided
    if (
      (customerName && !chatSession.customer_name) ||
      (customerPhone && !chatSession.customer_phone)
    ) {
      await supabase
        .from('chat_sessions')
        .update({
          customer_name: customerName ?? chatSession.customer_name,
          customer_phone: customerPhone ?? chatSession.customer_phone,
        } as never)
        .eq('id', chatSession.id);
      chatSession.customer_name = customerName ?? chatSession.customer_name;
      chatSession.customer_phone = customerPhone ?? chatSession.customer_phone;
    }
  }

  if (!chatSession) {
    console.error('[chat] chatSession is null after creation attempt');
    return new Response(JSON.stringify({ error: 'Failed to create chat session' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 3. Load conversation history from chat_messages
  const { data: historyData } = await supabase
    .from('chat_messages')
    .select('role, content, tool_calls, tool_results')
    .eq('session_id', chatSession.id)
    .order('created_at', { ascending: true })
    .limit(50);

  const history = (historyData ?? []) as {
    role: string;
    content: string;
    tool_calls: unknown;
    tool_results: unknown;
  }[];

  // Rebuild messages array for OpenAI
  const messages: OpenAI.ChatCompletionMessageParam[] = [];
  for (const msg of history) {
    if (msg.role === 'user') {
      messages.push({ role: 'user', content: msg.content });
    } else if (msg.role === 'assistant') {
      if (msg.tool_calls) {
        // Assistant message with tool calls
        const toolCalls = msg.tool_calls as {
          id: string;
          name: string;
          input: Record<string, unknown>;
        }[];
        messages.push({
          role: 'assistant',
          content: msg.content || null,
          tool_calls: toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: {
              name: tc.name,
              arguments: JSON.stringify(tc.input),
            },
          })),
        });

        // Add corresponding tool results as individual tool messages
        if (msg.tool_results) {
          const toolResults = msg.tool_results as {
            tool_use_id: string;
            content: string;
          }[];
          for (const tr of toolResults) {
            messages.push({
              role: 'tool',
              tool_call_id: tr.tool_use_id,
              content: tr.content,
            });
          }
        }
      } else {
        messages.push({ role: 'assistant', content: msg.content });
      }
    }
  }

  // Add the new user message
  messages.push({ role: 'user', content: message });

  // 4. Save user message to DB
  await supabase.from('chat_messages').insert({
    session_id: chatSession.id,
    role: 'user',
    content: message,
  } as never);

  // 5. Build tools list and system prompt based on whether we have a tenant
  const chatTools: OpenAI.ChatCompletionTool[] = tenantId
    ? [...tenantChatTools, rescheduleAppointmentTool, getDirectionsTool]
    : [findBusinessesTool, ...tenantChatTools, rescheduleAppointmentTool, getDirectionsTool];

  const resolvedName = chatSession.customer_name ?? customerName ?? null;
  const resolvedPhone = chatSession.customer_phone ?? customerPhone ?? null;
  const resolvedEmail = customerEmail ?? null;
  const resolvedUserId = userId ?? null;

  // Compute the real current date and time fresh on every request
  const now = new Date();
  const currentDateTime = now.toLocaleString('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  });

  // Compute explicit ISO date strings for today/tomorrow in PST
  const pstParts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);

  const pstYear = pstParts.find(p => p.type === 'year')!.value;
  const pstMonth = pstParts.find(p => p.type === 'month')!.value;
  const pstDay = pstParts.find(p => p.type === 'day')!.value;
  const todayISO = `${pstYear}-${pstMonth}-${pstDay}`;

  const tomorrowDate = new Date(`${todayISO}T12:00:00-08:00`);
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrowISO = tomorrowDate.toISOString().split('T')[0];

  // Compute end of week (Sunday)
  const todayDateObj = new Date(`${todayISO}T12:00:00-08:00`);
  const dayOfWeekNum = todayDateObj.getDay(); // 0=Sun
  const daysUntilSunday = dayOfWeekNum === 0 ? 0 : 7 - dayOfWeekNum;
  const endOfWeekDate = new Date(todayDateObj);
  endOfWeekDate.setDate(endOfWeekDate.getDate() + daysUntilSunday);
  const endOfWeekISO = endOfWeekDate.toISOString().split('T')[0];

  // Compute next week (Monday to Sunday of the following week)
  const nextWeekMonday = new Date(todayDateObj);
  nextWeekMonday.setDate(nextWeekMonday.getDate() + (7 - dayOfWeekNum + 1)); // Next Monday
  if (dayOfWeekNum === 0) nextWeekMonday.setDate(nextWeekMonday.getDate() - 7 + 1); // If today is Sunday, next Monday is tomorrow
  const nextWeekMondayISO = nextWeekMonday.toISOString().split('T')[0]!;
  const nextWeekSunday = new Date(nextWeekMonday);
  nextWeekSunday.setDate(nextWeekSunday.getDate() + 6);
  const nextWeekSundayISO = nextWeekSunday.toISOString().split('T')[0]!;

  // Get current hour in PST to determine if "Today" should be shown
  const pstHour = parseInt(pstParts.find(p => p.type === 'hour')!.value, 10);

  const dateInfo = { todayISO, tomorrowISO: tomorrowISO!, endOfWeekISO: endOfWeekISO!, nextWeekMondayISO, nextWeekSundayISO, currentHourPST: pstHour };

  // Fetch behavior profiles for AI context
  let behaviorProfiles: { service_id: string; avg_interval_days: number | null; predicted_next_date: string | null; service_name?: string }[] = [];
  if (userId) {
    const { data: profiles } = await supabase
      .from('customer_behavior_profiles')
      .select('service_id, avg_interval_days, last_booking_date, predicted_next_date')
      .eq('customer_id', userId)
      .not('avg_interval_days', 'is', null);

    if (profiles && profiles.length > 0) {
      // Enrich with service names
      const serviceIds = profiles.map(p => p.service_id);
      const { data: services } = await supabase
        .from('services')
        .select('id, name')
        .in('id', serviceIds);
      const serviceMap = new Map((services ?? []).map(s => [s.id, s.name]));

      behaviorProfiles = profiles.map(p => ({
        ...p,
        service_name: serviceMap.get(p.service_id) ?? p.service_id,
      }));
    }
  }

  // Fetch recent completed/confirmed appointments for AI context
  let recentBookings: { service_name: string; date: string; status: string; tenant_name: string }[] = [];
  if (userId) {
    const { data: recentAppts } = await supabase
      .from('appointments')
      .select('start_time, status, services(name), tenants(name)')
      .eq('customer_id', userId)
      .in('status', ['completed', 'confirmed'])
      .order('start_time', { ascending: false })
      .limit(5);

    if (recentAppts) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recentBookings = recentAppts.map((a: any) => ({
        service_name: a.services?.name ?? 'Unknown',
        date: a.start_time,
        status: a.status,
        tenant_name: a.tenants?.name ?? 'Unknown',
      }));
    }
  }

  // Build behavior context string for system prompt
  let behaviorContext = '';
  if (behaviorProfiles.length > 0) {
    behaviorContext += '\n## Customer Behavior Patterns\n';
    behaviorContext += behaviorProfiles.map(p =>
      `- ${p.service_name}: avg every ${p.avg_interval_days} days, next predicted: ${p.predicted_next_date ?? 'unknown'}`
    ).join('\n');
    behaviorContext += '\nUse these patterns to proactively suggest rebookings when relevant.\n';
  }
  if (recentBookings.length > 0) {
    behaviorContext += '\n## Recent Booking History\n';
    behaviorContext += recentBookings.map(b =>
      `- ${b.service_name} at ${b.tenant_name}: ${new Date(b.date).toLocaleDateString()} (${b.status})`
    ).join('\n');
    behaviorContext += '\n';
  }

  let systemPrompt = tenantId
    ? buildTenantSystemPrompt(
        tenantName,
        resolvedName,
        resolvedPhone,
        resolvedEmail,
        resolvedUserId,
        currentDateTime,
        dateInfo,
        tenantPaymentsEnabled,
        behaviorContext,
      )
    : buildDiscoverySystemPrompt(
        resolvedName,
        resolvedPhone,
        resolvedEmail,
        resolvedUserId,
        currentDateTime,
        userLatitude && userLongitude ? { latitude: userLatitude, longitude: userLongitude } : null,
        dateInfo,
        behaviorContext,
      );

  // Restrict discovery to the property's businesses when in portal mode.
  if (propertyContext) systemPrompt += propertyContext;

  // 6. Pre-detect search intent and prefetch businesses in parallel with OpenAI
  const openai = new OpenAI({ apiKey });

  // 7. Stream response from OpenAI with tool loop

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let currentMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];
      let toolRound = 0;

      const chatStartTime = Date.now();
      try {
        while (toolRound < MAX_TOOL_ROUNDS) {
          const tRound = Date.now();
          console.log(`[chat] ⏱ Starting OpenAI round ${toolRound + 1}`);
          const streamResponse = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 4096,
            tools: chatTools,
            messages: currentMessages,
            stream: true,
          });

          let textContent = '';
          const toolCalls: Map<
            number,
            { id: string; name: string; arguments: string }
          > = new Map();

          for await (const chunk of streamResponse) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            // Stream text content
            if (delta.content) {
              textContent += delta.content;
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`,
                ),
              );
            }

            // Accumulate tool call chunks
            if (delta.tool_calls) {
              for (const tc of delta.tool_calls) {
                const existing = toolCalls.get(tc.index);
                if (existing) {
                  existing.arguments += tc.function?.arguments ?? '';
                } else {
                  toolCalls.set(tc.index, {
                    id: tc.id ?? '',
                    name: tc.function?.name ?? '',
                    arguments: tc.function?.arguments ?? '',
                  });
                }
              }
            }
          }

          // If no tool calls, we're done
          if (toolCalls.size === 0) {
            // Save assistant message
            await supabase.from('chat_messages').insert({
              session_id: chatSession!.id,
              role: 'assistant',
              content: textContent,
            } as never);

            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
            );
            controller.close();
            return;
          }

          // Execute tool calls
          const toolCallsList = Array.from(toolCalls.values());
          const toolResults: { tool_use_id: string; content: string }[] = [];

          for (const toolCall of toolCallsList) {
            // Stream tool call notification
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'tool_call', name: toolCall.name })}\n\n`,
              ),
            );

            let parsedInput: Record<string, unknown> = {};
            try {
              parsedInput = JSON.parse(toolCall.arguments) as Record<
                string,
                unknown
              >;
            } catch {
              // Empty or malformed arguments — use empty object
            }

            // In discovery mode, the AI passes tenant_id from find_businesses results
            const effectiveTenantId = (parsedInput.tenant_id as string) || resolvedTenantId;

            let result: { success: boolean; data?: unknown; error?: string };
            const tTool = Date.now();
            try {
              result = await executeTool(
                toolCall.name,
                parsedInput,
                supabase,
                effectiveTenantId,
                {
                  customerId: chatSession!.customer_id,
                  customerName:
                    chatSession!.customer_name ?? customerName ?? null,
                  customerPhone:
                    chatSession!.customer_phone ?? customerPhone ?? null,
                  customerEmail: resolvedEmail,
                  chatSessionId: chatSession!.id,
                  userId: userId ?? null,
                  propertyTenantIds: propertyTenantIds.length ? propertyTenantIds : null,
                },
                userLatitude && userLongitude ? { latitude: userLatitude, longitude: userLongitude } : null,
              );
            } catch (toolErr) {
              console.error(`[chat] Tool "${toolCall.name}" execution failed:`, toolErr instanceof Error ? toolErr.stack : toolErr);
              result = { success: false, error: `Tool ${toolCall.name} failed: ${toolErr instanceof Error ? toolErr.message : 'Unknown error'}` };
            }

            console.log(`[chat] ⏱ Tool "${toolCall.name}" executed in ${Date.now() - tTool}ms (success: ${result.success})`);

            toolResults.push({
              tool_use_id: toolCall.id,
              content: JSON.stringify(result),
            });

            // Stream structured tool data to the client so it can render
            // cards deterministically without relying on the AI's formatting.
            if (toolCall.name === 'find_businesses' && result && typeof result === 'object' && 'success' in result && (result as { success: boolean }).success) {
              const fbResult = result as { data?: { businesses?: unknown[] } };
              if (fbResult.data?.businesses) {
                controller.enqueue(
                  encoder.encode(
                    `data: ${JSON.stringify({ type: 'tool_data', tool: 'find_businesses', data: fbResult.data })}\n\n`,
                  ),
                );
              }
            }

            // Stream debug info for get_staff and check_availability
            if ((toolCall.name === 'get_staff' || toolCall.name === 'check_availability') && result && typeof result === 'object' && '_debug' in result) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'debug', tool: toolCall.name, debug: (result as { _debug: unknown })._debug })}\n\n`,
                ),
              );
            }
          }

          // Save the assistant message with tool calls and results
          const savedToolCalls = toolCallsList.map((tc) => ({
            id: tc.id,
            name: tc.name,
            input: JSON.parse(tc.arguments || '{}') as Record<
              string,
              unknown
            >,
          }));

          await supabase.from('chat_messages').insert({
            session_id: chatSession!.id,
            role: 'assistant',
            content: textContent,
            tool_calls: savedToolCalls,
            tool_results: toolResults,
          } as never);

          // Build assistant message with tool_calls for next round
          const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
            role: 'assistant',
            content: textContent || null,
            tool_calls: toolCallsList.map((tc) => ({
              id: tc.id,
              type: 'function' as const,
              function: {
                name: tc.name,
                arguments: tc.arguments,
              },
            })),
          };

          // Build tool result messages
          const toolResultMessages: OpenAI.ChatCompletionToolMessageParam[] =
            toolResults.map((tr) => ({
              role: 'tool' as const,
              tool_call_id: tr.tool_use_id,
              content: tr.content,
            }));

          // Append to conversation for next round
          currentMessages = [
            ...currentMessages,
            assistantMsg,
            ...toolResultMessages,
          ];

          console.log(`[chat] ⏱ Round ${toolRound + 1} complete: ${Date.now() - tRound}ms`);
          toolRound++;
        }

        console.log(`[chat] ⏱ TOTAL chat processing: ${Date.now() - chatStartTime}ms (${toolRound} rounds)`);
        // Max tool rounds reached
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`),
        );
        controller.close();
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'An error occurred';
        console.error('[chat] Stream error:', err);
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`,
          ),
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    },
  });

  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred';
    console.error('[chat] Unhandled POST error:', err);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } },
    );
  }
}

// CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
