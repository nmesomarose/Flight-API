import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pgBinDir } from '../helpers/testDb';

const PG_BIN = pgBinDir();
const DATA_DIR = join(tmpdir(), 'flight-api-test-pgdata');

export default async function globalTeardown(): Promise<void> {
  try {
    execFileSync(resolve(PG_BIN, 'pg_ctl.exe'), ['-D', DATA_DIR, 'stop', '-m', 'fast'], {
      stdio: 'ignore',
    });
  } catch {
    // Server may already be stopped — ignore.
  }
}