/**
 * Claude tool definitions for the Balkina AI chatbot.
 * 11 tools total — one file per tool (see individual files).
 * Assembled here for the chat.ts streaming call.
 *
 * IMPORTANT: create_booking and process_payment MUST NOT be called without
 * an explicit customer confirmation message immediately prior in the conversation.
 */
import type Anthropic from '@anthropic-ai/sdk';

export const tools: Anthropic.Tool[] = [
  // ── Discovery ──────────────────────────────────────────────────────────────
  {
    name: 'search_services',
    description:
      'Search for services by category, name, location, or price range. Returns a list of matching services with pricing and duration.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Free-text search query' },
        category_slug: { type: 'string', description: 'Filter by category slug' },
        lat: { type: 'number', description: 'Customer latitude for proximity search' },
        lng: { type: 'number', description: 'Customer longitude for proximity search' },
        radius_km: { type: 'number', description: 'Search radius in km (default: 10)' },
        max_price: { type: 'number', description: 'Maximum price filter' },
      },
      required: [],
    },
  },
  {
    name: 'get_service_details',
    description: 'Get full details for a specific service including extras, deposit info, and staff.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_id: { type: 'string', description: 'UUID of the service' },
      },
      required: ['service_id'],
    },
  },
  {
    name: 'search_tenants',
    description: 'Search for service providers (tenants/businesses) by name, category, or location.',
    input_schema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string' },
        lat: { type: 'number' },
        lng: { type: 'number' },
        radius_km: { type: 'number' },
        category_slug: { type: 'string' },
      },
      required: [],
    },
  },
  // ── Availability ───────────────────────────────────────────────────────────
  {
    name: 'check_availability',
    description:
      'Check available time slots for a service on a given date. Returns slots as ISO 8601 timestamps.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_id: { type: 'string', description: 'UUID of the service' },
        staff_id: { type: 'string', description: 'UUID of preferred staff (optional)' },
        date: { type: 'string', description: 'Date to check in YYYY-MM-DD format' },
        location_id: { type: 'string', description: 'UUID of the location' },
      },
      required: ['service_id', 'date'],
    },
  },
  // ── Booking ────────────────────────────────────────────────────────────────
  {
    name: 'create_booking',
    description:
      'Create an appointment booking. ONLY call this after the customer has explicitly confirmed the booking details (time, service, price, deposit) in their immediately preceding message.',
    input_schema: {
      type: 'object' as const,
      properties: {
        service_id: { type: 'string' },
        staff_id: { type: 'string' },
        location_id: { type: 'string' },
        start_time: { type: 'string', description: 'ISO 8601 datetime' },
        extras: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of service_extra IDs to add',
        },
        coupon_code: { type: 'string' },
      },
      required: ['service_id', 'location_id', 'start_time'],
    },
  },
  // ── Payments ───────────────────────────────────────────────────────────────
  {
    name: 'process_payment',
    description:
      'Initiate the Stripe payment flow for an appointment. ONLY call this after the customer has explicitly confirmed payment intent in their immediately preceding message. Always show full price and deposit amount before calling.',
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: { type: 'string' },
        payment_type: {
          type: 'string',
          enum: ['deposit', 'full'],
          description: 'Whether to charge deposit only or full amount',
        },
      },
      required: ['appointment_id', 'payment_type'],
    },
  },
  // ── Customer account ───────────────────────────────────────────────────────
  {
    name: 'get_customer_appointments',
    description: 'Retrieve the customer\'s upcoming and past appointments.',
    input_schema: {
      type: 'object' as const,
      properties: {
        status: {
          type: 'string',
          enum: ['upcoming', 'past', 'all'],
          description: 'Filter by appointment status',
        },
        limit: { type: 'number', description: 'Max results (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'cancel_appointment',
    description: 'Cancel an upcoming appointment for the customer.',
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: { type: 'string' },
        reason: { type: 'string' },
      },
      required: ['appointment_id'],
    },
  },
  {
    name: 'validate_coupon',
    description: 'Check if a coupon code is valid for a given service and return the discount.',
    input_schema: {
      type: 'object' as const,
      properties: {
        code: { type: 'string' },
        service_id: { type: 'string' },
        tenant_id: { type: 'string' },
      },
      required: ['code', 'service_id', 'tenant_id'],
    },
  },
  // ── Reviews ────────────────────────────────────────────────────────────────
  {
    name: 'submit_review',
    description: 'Submit a review for a completed appointment.',
    input_schema: {
      type: 'object' as const,
      properties: {
        appointment_id: { type: 'string' },
        rating: { type: 'number', description: '1–5 star rating' },
        comment: { type: 'string' },
      },
      required: ['appointment_id', 'rating'],
    },
  },
  // ── Nudge / memory ─────────────────────────────────────────────────────────
  {
    name: 'get_rebooking_suggestion',
    description:
      'Based on the customer\'s booking history and behavior patterns, suggest services they are likely due to rebook.',
    input_schema: {
      type: 'object' as const,
      properties: {
        limit: { type: 'number', description: 'Max suggestions (default 3)' },
      },
      required: [],
    },
  },
];
