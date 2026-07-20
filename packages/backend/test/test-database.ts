import { spawn } from 'node:child_process';
import { cpSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const testDirectory = dirname(fileURLToPath(import.meta.url));
const prismaBinary = resolve(testDirectory, '../../../node_modules/.bin/prisma');

function deployMigrations(schemaPath: string): Promise<void> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(prismaBinary, ['migrate', 'deploy', '--schema', schemaPath], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    child.stdout.setEncoding('utf8');
    child.stderr.setEncoding('utf8');
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { output += chunk; });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) resolvePromise();
      else reject(new Error(output || `Test database migration exited with ${code ?? 'unknown'}`));
    });
  });
}

export async function createTestDatabase(): Promise<{
  client: PrismaClient;
  cleanup: () => Promise<void>;
}> {
  const directory = mkdtempSync(join(tmpdir(), 'bar-ticketing-backend-'));
  const prismaDirectory = join(directory, 'prisma');
  const databasePath = join(prismaDirectory, 'dev.db');
  const databaseUrl = `file:${databasePath}`;
  cpSync(resolve(testDirectory, '../prisma'), prismaDirectory, {
    recursive: true,
    filter: (source) => !/(?:^|[\\/])(?:dev\.db(?:$|[-.])|backups(?:[\\/]|$))/.test(source),
  });
  writeFileSync(databasePath, '');
  await deployMigrations(join(prismaDirectory, 'schema.prisma'));

  const client = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  await client.$connect();

  return {
    client,
    cleanup: async () => {
      await client.$disconnect();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}
