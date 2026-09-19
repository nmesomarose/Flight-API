import request from 'supertest';
import type { AppConfig } from '../../src/config';
import { createApp } from '../../src/app-factory';

function testConfig(rateLimitMax = 100): AppConfig {
  return {
    port: 0,
    databaseUrl: 'postgresql://user:pass@localhost:5432/test',
    rateLimit: { windowMs: 60000, max: rateLimitMax },
  };
}

describe('app-level integration', () => {
  it('mounts the /v1/ prefix: unknown /v1/ paths are 404, never 500', async () => {
    const app = createApp(testConfig());
    const res = await request(app).get('/v1/no-such-resource');
    expect(res.status).toBe(404);
  });

  it('returns the consistent error envelope for unknown routes', async () => {
    const app = createApp(testConfig());
    const res = await request(app).get('/v1/no-such-resource');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String) } });
  });

  it('returns 400 with the consistent error envelope for malformed JSON bodies', async () => {
    const app = createApp(testConfig());
    const res = await request(app)
      .post('/v1/airlines')
      .set('Content-Type', 'application/json')
      .send('{ this is not json');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: { code: 'BAD_REQUEST', message: expect.any(String) } });
  });

  it('returns 429 with Retry-After when the configured rate limit is exceeded', async () => {
    const app = createApp(testConfig(3));
    for (let i = 0; i < 3; i += 1) {
      await request(app).get('/v1/does-not-exist');
    }
    const res = await request(app).get('/v1/does-not-exist');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
  });

  it('uses the consistent error envelope for rate-limited responses', async () => {
    const app = createApp(testConfig(1));
    await request(app).get('/v1/does-not-exist');
    const res = await request(app).get('/v1/does-not-exist');
    expect(res.status).toBe(429);
    expect(res.headers['retry-after']).toBeDefined();
    expect(res.body).toEqual({ error: { code: 'RATE_LIMITED', message: expect.any(String) } });
  });

  it('does not rate-limit before the configured threshold', async () => {
    const app = createApp(testConfig(10));
    for (let i = 0; i < 5; i += 1) {
      const res = await request(app).get('/v1/does-not-exist');
      expect(res.status).toBe(404);
    }
  });
});