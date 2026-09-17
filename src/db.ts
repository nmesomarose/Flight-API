import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

// Prisma 7 generated-client entry point (see prisma/schema.prisma generator
// block: provider "prisma-client", output ../src/generated/prisma). The
// Rust-free client requires the @prisma/adapter-pg driver adapter for
// PostgreSQL and does not read DATABASE_URL on its own.

export function createPrismaClient(databaseUrl: string): PrismaClient {
  const adapter = new PrismaPg({ connectionString: databaseUrl });
  return new PrismaClient({ adapter });
}