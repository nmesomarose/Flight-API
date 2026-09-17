import type { PrismaClient } from '../generated/prisma/client';
import { createPrismaClient } from '../db';

// Cached Prisma clients keyed by database URL so concurrent requests and
// repeated module loads reuse one connection per backing database.

const clientCache = new Map<string, PrismaClient>();

export function prismaClientFor(databaseUrl: string): PrismaClient {
  let client = clientCache.get(databaseUrl);
  if (!client) {
    client = createPrismaClient(databaseUrl);
    clientCache.set(databaseUrl, client);
  }
  return client;
}