import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { Client } from 'pg';
import {
  TEST_DB_NAME,
  TEST_CLUSTER_PORT,
  pgBinDir,
} from '../helpers/testDb';

const PG_BIN = pgBinDir();
const DATA_DIR = join(tmpdir(), 'flight-api-test-pgdata');
const LOG_FILE = join(DATA_DIR, 'postgres-test.log');

const CLUSTER_URL = `postgresql://postgres@127.0.0.1:${TEST_CLUSTER_PORT}/postgres`;
const TEST_URL = `postgresql://postgres@127.0.0.1:${TEST_CLUSTER_PORT}/${TEST_DB_NAME}`;

async function waitForReady(attempts: number, intervalMs: number): Promise<void> {
  for (let i = 0; i < attempts; i += 1) {
    try {
      const client = new Client({ connectionString: CLUSTER_URL });
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch {
      await new Promise((r) => setTimeout(r, intervalMs));
    }
  }
  throw new Error(`PostgreSQL did not become ready after ${attempts * intervalMs}ms`);
}

export default async function globalSetup(): Promise<void> {
  // Initialise the data directory if this is the first run.
  if (!existsSync(join(DATA_DIR, 'postgresql.conf'))) {
    execFileSync(
      resolve(PG_BIN, 'initdb.exe'),
      ['-D', DATA_DIR, '-U', 'postgres', '--auth=trust', '--encoding=UTF8'],
      { stdio: 'inherit' },
    );
  }

  // Start the server if it isn't already running.
  try {
    const probe = new Client({ connectionString: CLUSTER_URL });
    await probe.connect();
    await probe.end();
    // Already running — skip start.
  } catch {
    execFileSync(
      resolve(PG_BIN, 'pg_ctl.exe'),
      ['-D', DATA_DIR, '-l', LOG_FILE, '-o', `-p ${TEST_CLUSTER_PORT}`, 'start'],
      { stdio: 'inherit' },
    );
    await waitForReady(60, 500);
  }

  // Create / recreate the dedicated test database.
  const admin = new Client({ connectionString: CLUSTER_URL });
  await admin.connect();
  try {
    await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}" WITH (FORCE)`);
  } catch {
    // WITH (FORCE) may not be supported on older PG — ignore and retry.
    try {
      await admin.query(`DROP DATABASE IF EXISTS "${TEST_DB_NAME}"`);
    } catch {
      // best-effort only
    }
  }
  await admin.query(`CREATE DATABASE "${TEST_DB_NAME}"`);
  await admin.end();

  // Push the Prisma schema into the fresh test database.
  const prismaCli = resolve(process.cwd(), 'node_modules/prisma/build/index.js');
  execFileSync(process.execPath, [prismaCli, 'db', 'push'], {
    env: { ...process.env, DATABASE_URL: TEST_URL },
    stdio: 'inherit',
  });

  // Expose the URL to test workers via process.env.
  process.env.TEST_DATABASE_URL = TEST_URL;
}