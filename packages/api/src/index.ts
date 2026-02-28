/**
 * Balkina AI — Express API
 * Deployed as Vercel serverless functions.
 * All routes validate auth via supabase.auth.getUser() before any data operation.
 */
import express from 'express';
import cors from 'cors';
import { router } from './routes/index.js';

const app = express();

app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Health check — no auth required
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'balkina-api', timestamp: new Date().toISOString() });
});

// All API routes
app.use('/api', router);

// 404 fallback
app.use((_req, res) => {
  res.status(404).json({ data: null, error: { message: 'Not found', code: 'NOT_FOUND' } });
});

const PORT = process.env['PORT'] ?? 3002;
if (process.env['NODE_ENV'] !== 'test') {
  app.listen(PORT, () => {
    console.log(`Balkina API running on port ${PORT}`);
  });
}

export default app;
