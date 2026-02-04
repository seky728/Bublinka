import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load test environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });

let prismaInstance: PrismaClient | null = null;

/**
 * Initialize and return a PrismaClient instance for testing
 */
export function getPrismaClient(): PrismaClient {
  if (prismaInstance) {
    return prismaInstance;
  }

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in test environment');
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  prismaInstance = new PrismaClient({ adapter });

  return prismaInstance;
}

/**
 * Reset the database by truncating all tables (except _prisma_migrations)
 * Uses TRUNCATE TABLE with RESTART IDENTITY CASCADE for a clean slate
 */
export async function resetDatabase(): Promise<void> {
  const prisma = getPrismaClient();

  // Query all table names from the public schema, excluding _prisma_migrations
  const tables = await prisma.$queryRaw<Array<{ tablename: string }>>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename != '_prisma_migrations'
    ORDER BY tablename;
  `;

  if (tables.length === 0) {
    return; // No tables to truncate
  }

  // Build TRUNCATE command with all table names
  const tableNames = tables.map((t) => `"${t.tablename}"`).join(', ');
  const truncateQuery = `TRUNCATE TABLE ${tableNames} RESTART IDENTITY CASCADE;`;

  // Execute the truncate command
  await prisma.$executeRawUnsafe(truncateQuery);
}
