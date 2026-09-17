import express, { type Request, type Response, type NextFunction } from 'express';
import type { AppConfig } from './config';
import { createRateLimiter } from './middleware/rateLimiter';
import { v1Router } from './routes/v1';
import { errorEnvelope } from './shared/envelope';

export function createApp(config: AppConfig) {
  const app = express();

  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(createRateLimiter(config.rateLimit));

  // Expose the database URL on app.locals so handlers and data-access layers
  // can obtain a Prisma client without importing process.env directly.
  app.locals.databaseUrl = config.databaseUrl;

  // Every route lives under /v1/ (identity-and-contract.md).
  app.use('/v1', v1Router);

  // Unmatched routes return the consistent error envelope.
  app.use((req, res) => {
    res.status(404).json(errorEnvelope('NOT_FOUND', `Route not found: ${req.method} ${req.path}`));
  });

  // JSON parse error handler — returns 400 with the consistent error envelope.
  app.use((err: Error, _req: Request, res: Response, next: NextFunction) => {
    if (err instanceof SyntaxError && 'body' in err) {
      res.status(400).json(errorEnvelope('BAD_REQUEST', 'Malformed JSON in request body'));
      return;
    }
    next(err);
  });

  // Global error handler — catches any unhandled errors and returns 500 with
  // the consistent error envelope. Operational errors should be caught and
  // handled by route handlers before reaching this middleware.
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled error:', err);
    res.status(500).json(errorEnvelope('INTERNAL_ERROR', 'An unexpected error occurred'));
  });

  return app;
}
