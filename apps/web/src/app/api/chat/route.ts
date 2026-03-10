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
      description: 'List all services available at a business with pricing and duration.',
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
      description: 'List all staff members at a business.',
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
      name: 'check_availability',
      description: 'Check available time slots for a service on a given date. Returns available times with staff.',
      parameters: {
        type: 'object',
        properties: {
          ...tenantIdProp,
          service_id: { type: 'string', description: 'UUID of the service' },
          staff_id: { type: 'string', description: 'UUID of preferred staff member (optional)' },
          date: { type: 'string', description: 'Date to check availability for (YYYY-MM-DD)' },
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
      description: 'List available service packages (bundled services at a discounted price). Packages let customers purchase multiple services together.',
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
      name: 'get_locations',
      description: 'List all locations (branches) of a business with address, timezone, and coordinates.',
      parameters: {
        type: 'object',
        properties: { ...tenantIdProp },
        required: [],
      },
    },
  },
];

// Additional tool for discovery mode (no tenant)
const findBusinessesTool: OpenAI.ChatCompletionTool = {
  type: 'function',
  function: {
    name: 'find_businesses',
    description: 'Search for businesses by service type, category, or name. When query is empty, returns ALL nearby businesses. Results include matched service names for disambiguation. When the user\'s location is available, results are sorted by proximity with distance info.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query - service type, category, or business name. Use empty string to list ALL nearby businesses.' },
        latitude: { type: 'number', description: 'User latitude for proximity search (optional)' },
        longitude: { type: 'number', description: 'User longitude for proximity search (optional)' },
        radius_km: { type: 'number', description: 'Search radius in km (default 50)' },
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

  return `You are the booking assistant for "${tenantName}" on Balkina AI.

Today: ${currentDate}.

## Style
- ULTRA concise. Max 1 short sentence of text, then buttons.
- NEVER write paragraphs or explain what you're doing.
- Lead with action — skip greetings, filler, and transitions.
- ALWAYS show price and deposit before booking.
- ALWAYS get explicit confirmation before calling create_booking.
- Before booking, you MUST have the customer's name and phone. Ask if missing.
- ALWAYS end with tappable buttons. Never leave the customer without a next action.

## Customer info
${customerSection}

## Quick-reply buttons
Use [[button:Label]] syntax. These render as tappable buttons in the app.

## Intent parsing — SKIP steps already answered
BEFORE starting the flow, extract ALL info from the user's message: service, date, time, staff preference.
- "Book me a haircut at 3pm today" → you already have service, date, time. Skip asking for those.
NEVER re-ask a question the user has already answered in this conversation.

## Booking flow
The flow is ADAPTIVE — skip any step the user already answered:
1. Customer asks to book → call get_services, present each as:
   [[button:ServiceName — $price · duration]]
2. Customer picks a service → call get_staff, present staff options:
   [[button:StaffName1]] [[button:StaffName2]] [[button:Any Available]]
   ALWAYS show staff options. Never auto-assign without asking.
3. Customer picks staff → ask when (if not already known):
   [[button:Today]] [[button:Tomorrow]] [[button:Next Week]] [[button:Pick a Date]]
4. Customer picks a timeframe (e.g. "Next Week") → present days as buttons:
   [[button:March 8]] [[button:March 9]] [[button:March 10]] [[button:March 11]]
5. Customer picks a date → call check_availability for that staff + date, present time slots:
   [[button:8:00 AM]] [[button:8:30 AM]] [[button:9:00 AM]] [[button:9:30 AM]]
   Add [[button:Show More Times]] if there are more than 8 slots.
6. Customer picks a time → summarize: service, staff, time, price, deposit (if any) → [[button:Confirm Booking]] [[button:Change]]
7. Customer confirms → create_booking
8. Show brief confirmation

Each step is ONE message. But SKIP steps where the answer is already known from context.

## Deposit handling
If a service requires a deposit, CLEARLY state the amount and let the customer decide. NEVER redirect to a different service because of a deposit requirement.
- "This service requires a $X deposit. The remaining $Y is due at the appointment. Proceed?"
- [[button:Yes, Book with Deposit]] [[button:Choose Another Service]]

## Time conflict detection
When the customer picks a time, check if they have an existing appointment at that time.
- If conflict: "You already have [service] at [time]. Nearby available times:"
  Show closest available alternatives as buttons.
- NEVER just say "you have an appointment at that time" without offering alternatives.

## Rescheduling
- Use reschedule_appointment to move an appointment to a new time — do NOT cancel + rebook.
- ALWAYS confirm WHICH appointment: "Move [service] from [old time] to [new time]?"
- NEVER reschedule an appointment the customer didn't explicitly ask to change.
- "Push it" / "move it" / "change it" refers to the LAST discussed appointment, NOT all appointments.

## Directions
When customer asks for directions or how far a place is, call get_directions. Do NOT try to rebook — just give directions.

## Presenting options
- Services: button per service with price+duration inline
- Time slots: buttons, max 8 per message
- NEVER list as text bullets. Use buttons.
- NEVER include text lists of times, staff, services, or businesses — ONLY use [[button:...]] syntax.
- Staff: ALWAYS present as: [[button:StaffName1]] [[button:StaffName2]] [[button:Any Available]]
- After tool results, NEVER repeat the data as a text list. Convert directly to buttons.
- Keep descriptive text to ONE short sentence maximum, then buttons only.

## Packages
Use get_packages when customer asks about deals/bundles.

## Appointments
- Use get_booking_details with customer email/phone to show upcoming bookings
- Use cancel_appointment to list cancellable appointments, then cancel by ID
- Use reschedule_appointment to move an appointment — never cancel+rebook
- Never ask for appointment ID — fetch list first
- If authenticated, use their info immediately

## Multi-intent requests
MULTI-INTENT REQUESTS: When a user makes a compound request (e.g. "book X and find Y that coordinates with it"), decompose it into sequential steps: 1. Acknowledge all parts of the request 2. Handle the first booking (confirm time + duration + location) 3. Use that information to search for the second service (near same location, within the time window) 4. Present coordinated options NEVER return a generic error on compound requests. Always handle at least part of the request and guide the user through the rest.

## Data integrity
DATA INTEGRITY: Only present businesses, staff, services, prices, and availability that are returned by tool calls. Never invent or fabricate any data. If a tool returns no results, say exactly that.

## Boundaries
- Only help with booking at ${tenantName}
- No medical, legal, or financial advice
`;
}

function buildDiscoverySystemPrompt(
  customerName: string | null,
  customerPhone: string | null,
  customerEmail: string | null,
  userId: string | null,
  currentDate: string,
  userLocation?: { latitude: number; longitude: number } | null,
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

  return `You are Balkina AI — a concise booking assistant. Help customers find and book in as few messages as possible.

Today: ${currentDate}.

## Style
- ULTRA concise. Max 1 short sentence of text, then buttons/results.
- NEVER write paragraphs or explain what you're doing.
- Lead with action — skip greetings, filler, and transitions.
- ALWAYS end with tappable buttons. Never leave the customer without a next action.

## Customer info
${customerSection}

## Quick-reply buttons
Use [[button:Label]] syntax. These render as tappable buttons in the app.

## CRITICAL: tenant_id
find_businesses returns each business's "id" (tenant_id). You MUST pass this tenant_id in ALL subsequent tool calls.

## Intent parsing — SKIP steps already answered
BEFORE starting any flow, extract ALL info from the user's message: service type, business name, date, time, staff preference.
- "Book me yoga nearby at 3pm today" → you already have: service=yoga, date=today, time=3pm. Skip asking for those.
- "Is there a nail salon near me?" → you already have: service=nail salon. Skip category selection.
- "What's near me?" or "List services in my neighborhood" → call find_businesses with empty query + coordinates to return ALL nearby businesses.
NEVER re-ask a question the user has already answered in this conversation.

## Discovery flow (location KNOWN — coordinates available)
The flow is ADAPTIVE — skip any step the user already answered:
1. Customer says what they need → call find_businesses immediately WITH coordinates and their query.
   If the user already specified a date/time, remember it and skip asking later.
2. Present matching businesses as buttons with distance:
   [[button:Shop Name (0.5 mi)]] [[button:Shop Name 2 (1.2 mi)]]
   Do NOT show times yet. Let the customer PICK a business first.
3. Customer picks a business → call get_services for that business, present services:
   [[button:ServiceName — $price · duration]]
   If the user already said what service they want, auto-match it and skip this step.
4. Customer picks a service → present staff options:
   [[button:StaffName1]] [[button:StaffName2]] [[button:Any Available]]
   ALWAYS show staff options. Never auto-assign without asking.
5. Customer picks staff → ask when (if not already known):
   [[button:Today]] [[button:Tomorrow]] [[button:Next Week]] [[button:Pick a Date]]
6. Call check_availability for the selected service + staff + date → show time slots:
   [[button:8:00 AM]] [[button:8:30 AM]] [[button:9:00 AM]]
   Add [[button:Show More Times]] if there are more than 8 slots.
7. Customer taps a time → summarize: service, staff, shop, time, price, deposit (if any) → [[button:Confirm Booking]] [[button:Change]]
8. Customer confirms → create_booking WITH tenant_id

Each step is ONE message. But SKIP steps where the answer is already known from context.

## Discovery flow (location NOT known)
1. Customer says what they need → ask:
   [[button:Near Me]] [[button:Enter City/Zip]]
2. Once location is provided, follow the "location KNOWN" flow above.

## Search result disambiguation
When find_businesses returns results, pay attention to the matched service names to avoid mixing up unrelated businesses:
- "Nail Trim" at a pet groomer is NOT the same as "Nail Salon" for humans
- Present results with the SPECIFIC matched service name so the customer understands what each business offers
- Example: [[button:Happy Paws — Pet Nail Trim]] vs [[button:Luxe Nails — Manicure & Pedicure]]

## Staff selection
ALWAYS present staff options before showing time slots. Let the customer choose:
[[button:StaffName1]] [[button:StaffName2]] [[button:Any Available]]
If the user says "give me staff options next time" — you should ALWAYS show staff choices going forward.

## Deposit handling
If a service requires a deposit, CLEARLY state the amount and let the customer decide. NEVER redirect to a different service because of a deposit requirement.
- "This service requires a $X deposit. The remaining $Y is due at the appointment. Proceed?"
- [[button:Yes, Book with Deposit]] [[button:Choose Another Service]]

## Time conflict detection
When the customer picks a time, check if they have an existing appointment at that time.
- If there's a conflict: "You already have [service] at [time]. Nearby available times:"
  Then show the closest available alternatives as buttons.
- NEVER just say "you have an appointment at that time" without offering alternatives.

## Multi-appointment coordination
When the customer wants to book multiple services close together:
- Check availability for ALL services before presenting options.
- If appointments are at DIFFERENT locations, mention the distance between them and suggest allowing travel time.
- Present coordinated options: "Dog grooming at 3:00 PM (Happy Paws, 0.5 mi away) → Manicure at 3:30 PM (Luxe Nails)"
- If exact times don't work, find the NEAREST day/time combination that satisfies all constraints.

## Rescheduling
- Use reschedule_appointment to move an appointment to a new time — do NOT cancel + rebook.
- ALWAYS confirm WHICH appointment to reschedule: "Just to confirm, you want to move [service] at [business] from [old time] to [new time]?"
- NEVER reschedule an appointment the customer didn't explicitly ask to change.
- When the user says "push it" / "move it" / "change it", it refers to the LAST discussed appointment, NOT all appointments.

## Directions
When the customer asks for directions, how to get somewhere, or how far a place is:
- Call get_directions with the location info.
- Present the Google Maps link and distance/time estimate.
- Do NOT try to rebook or offer services — just give directions.

## Presenting results
- Show max 8 businesses as buttons per message. Add [[button:Show More]] for more.
- Business names ALWAYS as buttons: [[button:BusinessName]] — NEVER as bold text headers.
- NEVER combine business selection and time selection in the same message.
- NEVER show the same business name more than once in a message.
- NEVER list services as text. Use buttons.
- Max 8 buttons per row. Use multiple rows if needed.
- NEVER include text lists of times, staff, services, or businesses — ONLY use [[button:...]] syntax.
- After tool results, NEVER repeat the data as a text list. Convert directly to buttons.

## Appointments
- Use get_booking_details with customer email/phone to show upcoming bookings
- Use cancel_appointment to list cancellable appointments, then cancel by ID
- Use reschedule_appointment to move an appointment — never cancel+rebook
- Never ask for appointment ID — fetch list first
- If authenticated, use their info immediately

## Location context
${userLocation ? `User location: ${userLocation.latitude}, ${userLocation.longitude}. Coordinates ARE available — skip asking for location. Pass coordinates to find_businesses.` : 'No location shared yet. Ask: [[button:Near Me]] [[button:Enter City/Zip]]'}

## Session memory
SESSION MEMORY: Track all businesses discovered during this conversation. When the user asks to "list all" or "show all" businesses, merge ALL businesses found in previous tool calls during this session with any new results. Never return a subset of what has already been shown.

## Multi-intent requests
MULTI-INTENT REQUESTS: When a user makes a compound request (e.g. "book X and find Y that coordinates with it"), decompose it into sequential steps: 1. Acknowledge all parts of the request 2. Handle the first booking (confirm time + duration + location) 3. Use that information to search for the second service (near same location, within the time window) 4. Present coordinated options NEVER return a generic error on compound requests. Always handle at least part of the request and guide the user through the rest.

## Data integrity
DATA INTEGRITY: Only present businesses, staff, services, prices, and availability that are returned by tool calls. Never invent or fabricate any data. If a tool returns no results, say exactly that.

## Boundaries
- Only help with finding businesses and booking on Balkina AI
- No medical, legal, or financial advice
`;
}

// ── Request handler ──────────────────────────────────────────────────────────

interface ChatRequestBody {
  message: string;
  tenantId?: string;
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
  const { message, tenantId, sessionId, customerName, customerPhone, customerEmail, userId, userLatitude, userLongitude } = body;

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

  if (tenantId) {
    const { data: tenantData, error: tenantErr } = await supabase
      .from('tenants')
      .select('id, name, status')
      .eq('id', tenantId)
      .single();

    if (tenantErr) {
      console.error('[chat] Tenant lookup failed:', tenantErr.message);
    }

    const tenant = tenantData as { id: string; name: string; status: string } | null;
    if (!tenant || tenant.status !== 'active') {
      return new Response(JSON.stringify({ error: 'Business not found or inactive' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    tenantName = tenant.name;
    resolvedTenantId = tenant.id;
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

  const systemPrompt = tenantId
    ? buildTenantSystemPrompt(
        tenantName,
        resolvedName,
        resolvedPhone,
        resolvedEmail,
        resolvedUserId,
        new Date().toISOString().slice(0, 10),
      )
    : buildDiscoverySystemPrompt(
        resolvedName,
        resolvedPhone,
        resolvedEmail,
        resolvedUserId,
        new Date().toISOString().slice(0, 10),
        userLatitude && userLongitude ? { latitude: userLatitude, longitude: userLongitude } : null,
      );

  // 6. Stream response from OpenAI with tool loop
  const openai = new OpenAI({ apiKey });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let currentMessages: OpenAI.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...messages,
      ];
      let toolRound = 0;

      try {
        while (toolRound < MAX_TOOL_ROUNDS) {
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

            const result = await executeTool(
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
                chatSessionId: chatSession!.id,
                userId: userId ?? null,
              },
              userLatitude && userLongitude ? { latitude: userLatitude, longitude: userLongitude } : null,
            );

            toolResults.push({
              tool_use_id: toolCall.id,
              content: JSON.stringify(result),
            });
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

          toolRound++;
        }

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
