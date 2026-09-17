import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import type { AppConfig } from '../../src/config';
import { prismaClientFor } from '../../src/shared/prismaClient';

// ── Environment resolution ─────────────────────────────────────────────
// TEST_DATABASE_URL is set by global-setup.ts when spinning up the
// isolated test cluster. When absent, fall back to deriving from .env
// (useful when running against a real dev database for ad-hoc checks).

export function devDatabaseUrlFromEnv(): string {
  const envPath = path.resolve(process.cwd(), '.env');
  const content = existsSync(envPath) ? readFileSync(envPath, 'utf-8') : '';
  const line = content.split(/\r?\n/).find((l) => l.startsWith('DATABASE_URL='));
  if (!line) {
    throw new Error('DATABASE_URL not found in .env');
  }
  return line.slice('DATABASE_URL='.length).trim();
}

export function testDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  return testDatabaseUrlFor(devDatabaseUrlFromEnv());
}

export function testDatabaseUrlFor(devUrl: string): string {
  const match = devUrl.match(/^(postgres(?:ql)?:\/\/[^/]+)\/(.+)$/);
  if (!match) throw new Error(`Cannot derive test URL from: ${devUrl}`);
  return `${match[1]}/${match[2]}_test`;
}

export function testAppConfig(): AppConfig {
  return {
    port: 0,
    databaseUrl: testDatabaseUrl(),
    rateLimit: { windowMs: 60000, max: 10000 },
  };
}

// ── Database reset (runs between tests) ────────────────────────────────
// Deletes all rows across the four tables in a dependency-safe order.
export async function resetDatabase(databaseUrl: string): Promise<void> {
  const client = prismaClientFor(databaseUrl);
  await client.$executeRawUnsafe(
    'TRUNCATE TABLE "Booking", "Flight", "Customer", "Airline" RESTART IDENTITY CASCADE'
  );
}

// ── Shared constants for global-setup / global-teardown ─────────────────
export const TEST_CLUSTER_PORT = 55432;
export const TEST_DB_NAME = 'flight_booking_api_test';

export function pgBinDir(): string {
  const candidates = [
    'C:\\Program Files\\PostgreSQL\\18\\bin',
    'C:\\Program Files\\PostgreSQL\\17\\bin',
  ];
  for (const d of candidates) {
    if (existsSync(path.join(d, 'initdb.exe'))) return d;
  }
  throw new Error(
    'No PostgreSQL binaries found in standard locations (C:\\Program Files\\PostgreSQL\\{18,17}\\bin).'
  );
}