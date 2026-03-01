/**
 * Route registry.
 * Follows REST conventions:
 *   GET    /services
 *   POST   /appointments
 *   PATCH  /appointments/:id
 *   DELETE /appointments/:id
 */
import { Router } from 'express';
import { stripeWebhookRouter } from './webhooks/stripe.js';

export const router = Router();

// ── Placeholder routes (implemented in subsequent phases) ────────────────────

// Services
router.get('/services', (_req, res) => {
  res.json({ data: [], error: null });
});

// Appointments
router.get('/appointments', (_req, res) => {
  res.json({ data: [], error: null });
});

router.post('/appointments', (_req, res) => {
  res.status(501).json({ data: null, error: { message: 'Not implemented', code: 'NOT_IMPLEMENTED' } });
});

router.patch('/appointments/:id', (_req, res) => {
  res.status(501).json({ data: null, error: { message: 'Not implemented', code: 'NOT_IMPLEMENTED' } });
});

router.delete('/appointments/:id', (_req, res) => {
  res.status(501).json({ data: null, error: { message: 'Not implemented', code: 'NOT_IMPLEMENTED' } });
});

// Tenants
router.get('/tenants/:id', (_req, res) => {
  res.status(501).json({ data: null, error: { message: 'Not implemented', code: 'NOT_IMPLEMENTED' } });
});

// Stripe webhooks (raw body for signature verification)
router.use('/webhooks/stripe', stripeWebhookRouter);
