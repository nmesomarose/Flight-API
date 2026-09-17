import { rateLimit } from 'express-rate-limit';
import type { RateLimitConfig } from '../config';
import { errorEnvelope } from '../shared/envelope';

// Rate limiting applies to the public API by IP address (express-rate-limit's
// default keyGenerator) or globally. It is NEVER scoped per API key or per
// authenticated client, and no client-identification / API-key-issuance
// mechanism may be introduced as a side effect (rate-limiting.md).

export function createRateLimiter(config: RateLimitConfig) {
  return rateLimit({
    windowMs: config.windowMs,
    limit: config.max,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (_req, res) => {
      // 429 body uses the same consistent error shape as every other endpoint
      // (identity-and-contract.md). `Retry-After` is set by express-rate-limit
      // automatically and MUST be preserved (rate-limiting.md).
      res.status(429).json(errorEnvelope('RATE_LIMITED', 'Too many requests, please try again later'));
    },
  });
}