/**
 * POST /api/chat
 * AI Chatbot endpoint — streams responses from GPT-4o-mini with function calling.
 * Accepts: { message, tenantId, sessionId, customerName?, customerPhone? }
 * Returns: streaming text/event-stream
 */
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/server';
import { executeTool } from './tool-handlers';

const MAX_TOOL_ROUNDS = 5;

// Tool definitions in OpenAI function calling format
const chatTools: OpenAI.ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_services',
      description: 'List all services available at this business with pricing and duration.',
      parameters: {
        type: 'object',
        properties: {},
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
      description: 'List all staff members at this business.',
      parameters: {
        type: 'object',
        properties: {},
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
      description: 'Cancel an existing appointment.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'UUID of the appointment to cancel' },
        },
        required: ['appointment_id'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_booking_details',
      description: 'Get details of a specific booking/appointment.',
      parameters: {
        type: 'object',
        properties: {
          appointment_id: { type: 'string', description: 'UUID of the appointment' },
        },
        required: ['appointment_id'],
      },
    },
  },
];

function buildWidgetSystemPrompt(tenantName: string, customerName: string | null, currentDate: string): string {
  const customerSection = customerName
    ? `The customer's name is ${customerName}.`
    : 'The customer has not provided their name yet. Ask for their name and phone number before booking.';

  return `You are the booking assistant for "${tenantName}" — a friendly, efficient AI that helps customers discover services and book appointments through Balkina AI.

Today's date is ${currentDate}.

## Your role
- Help customers find services, check availability, and book appointments at ${tenantName}.
- Answer questions about services, pricing, availability, and staff.
- Guide customers through booking step by step.
- Always show the full price AND any deposit amount BEFORE booking.
- ALWAYS ask for explicit confirmation before calling the create_booking tool.
  Confirmation means the customer replied with a clear affirmative ("yes", "confirm", "book it", etc.).
- If the customer hasn't explicitly confirmed, DO NOT call create_booking.
- Before booking, you MUST have the customer's name and phone number. If not provided, ask for them.

## Communication style
- Conversational and warm, not robotic.
- Keep responses concise — customers may be on mobile.
- Use the customer's name when known.
- If you're uncertain about availability, use the check_availability tool rather than guessing.

## Customer info
${customerSection}

## Booking flow
1. Customer asks about services -> use get_services tool
2. Customer picks a service -> use get_service_details for full info
3. Customer asks about availability -> use check_availability tool
4. Customer confirms a time -> summarize details and ask for confirmation
5. Customer confirms -> use create_booking tool
6. After booking -> share the confirmation details

## Boundaries
- You only help with booking appointments at ${tenantName}.
- Do not provide medical, legal, or financial advice.
- Do not discuss other booking platforms or competitors.
`;
}

interface ChatRequestBody {
  message: string;
  tenantId: string;
  sessionId: string;
  customerName?: string;
  customerPhone?: string;
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequestBody;
  const { message, tenantId, sessionId, customerName, customerPhone } = body;

  if (!message || !tenantId || !sessionId) {
    return new Response(JSON.stringify({ error: 'message, tenantId, and sessionId are required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI service not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createAdminClient();

  // 1. Verify tenant exists and is active
  const { data: tenantData } = await supabase
    .from('tenants')
    .select('id, name, status')
    .eq('id', tenantId)
    .single();

  const tenant = tenantData as { id: string; name: string; status: string } | null;
  if (!tenant || tenant.status !== 'active') {
    return new Response(JSON.stringify({ error: 'Business not found or inactive' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Get or create chat session
  const { data: existingSession } = await supabase
    .from('chat_sessions')
    .select('id, customer_id, customer_name, customer_phone')
    .eq('session_id', sessionId)
    .single();

  let chatSession = existingSession as { id: string; customer_id: string | null; customer_name: string | null; customer_phone: string | null } | null;

  if (!chatSession) {
    const { data: newSession } = await supabase
      .from('chat_sessions')
      .insert({
        tenant_id: tenantId,
        session_id: sessionId,
        customer_name: customerName ?? null,
        customer_phone: customerPhone ?? null,
      } as never)
      .select('id, customer_id, customer_name, customer_phone')
      .single();
    chatSession = newSession as typeof chatSession;
  } else {
    // Update customer info if newly provided
    if ((customerName && !chatSession.customer_name) || (customerPhone && !chatSession.customer_phone)) {
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
        const toolCalls = msg.tool_calls as { id: string; name: string; input: Record<string, unknown> }[];
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
          const toolResults = msg.tool_results as { tool_use_id: string; content: string }[];
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

  // 5. Stream response from OpenAI with tool loop
  const openai = new OpenAI({ apiKey });
  const systemPrompt = buildWidgetSystemPrompt(
    tenant.name,
    chatSession.customer_name ?? customerName ?? null,
    new Date().toISOString().slice(0, 10),
  );

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
          const stream = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            max_tokens: 4096,
            tools: chatTools,
            messages: currentMessages,
            stream: true,
          });

          let textContent = '';
          const toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();

          for await (const chunk of stream) {
            const delta = chunk.choices[0]?.delta;
            if (!delta) continue;

            // Stream text content
            if (delta.content) {
              textContent += delta.content;
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type: 'text', content: delta.content })}\n\n`)
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

            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
            controller.close();
            return;
          }

          // Execute tool calls
          const toolCallsList = Array.from(toolCalls.values());
          const toolResults: { tool_use_id: string; content: string }[] = [];

          for (const toolCall of toolCallsList) {
            // Stream tool call notification
            controller.enqueue(
              encoder.encode(`data: ${JSON.stringify({ type: 'tool_call', name: toolCall.name })}\n\n`)
            );

            let parsedInput: Record<string, unknown> = {};
            try {
              parsedInput = JSON.parse(toolCall.arguments) as Record<string, unknown>;
            } catch {
              // Empty or malformed arguments — use empty object
            }

            const result = await executeTool(
              toolCall.name,
              parsedInput,
              supabase,
              tenantId,
              {
                customerId: chatSession!.customer_id,
                customerName: chatSession!.customer_name ?? customerName ?? null,
                customerPhone: chatSession!.customer_phone ?? customerPhone ?? null,
                chatSessionId: chatSession!.id,
              },
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
            input: JSON.parse(tc.arguments || '{}') as Record<string, unknown>,
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
          const toolResultMessages: OpenAI.ChatCompletionToolMessageParam[] = toolResults.map((tr) => ({
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
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'done' })}\n\n`));
        controller.close();
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'An error occurred';
        console.error('[chat] Stream error:', errorMessage);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: 'error', content: errorMessage })}\n\n`)
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
