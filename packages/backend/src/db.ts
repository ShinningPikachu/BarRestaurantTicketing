import { PrismaClient } from '@prisma/client';

// Production always uses the fixed datasource in schema.prisma. Tests may opt
// into an isolated SQLite file without making the operational database path a
// generally configurable runtime surface.
const testDatabaseUrl = process.env.NODE_ENV === 'test'
  ? process.env.BAR_TICKETING_TEST_DATABASE_URL?.trim()
  : undefined;

const prisma = new PrismaClient(testDatabaseUrl ? {
  datasources: { db: { url: testDatabaseUrl } },
} : undefined);

export default prisma;
