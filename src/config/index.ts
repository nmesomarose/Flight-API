import { existsSync } from 'node:fs';
import path from 'node:path';

export interface RateLimitConfig {
  windowMs: number;
  max: number;
}

export interface AppConfig {
  port: number;
  databaseUrl: string;
  rateLimit: RateLimitConfig;
}

const DEFAULT_PORT = 3000;
const DEFAULT_RATE_LIMIT_WINDOW_MS = 60000;
const DEFAULT_RATE_LIMIT_MAX = 100;

function loadEnvFileIfPresent(): void {
  const envPath = path.resolve(process.cwd(), '.env');
  if (existsSync(envPath)) {
    process.loadEnvFile(envPath);
  }
}

function parseIntOr(envValue: string | undefined, fallback: number): number {
  if (envValue === undefined || envValue.trim() === '') {
    return fallback;
  }
  const parsed = Number.parseInt(envValue, 10);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  loadEnvFileIfPresent();

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required. See .env.example.');
  }

  return {
    port: parseIntOr(env.PORT, DEFAULT_PORT),
    databaseUrl,
    rateLimit: {
      windowMs: parseIntOr(env.RATE_LIMIT_WINDOW_MS, DEFAULT_RATE_LIMIT_WINDOW_MS),
      max: parseIntOr(env.RATE_LIMIT_MAX, DEFAULT_RATE_LIMIT_MAX),
    },
  };
}