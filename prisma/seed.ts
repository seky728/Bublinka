import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding VAT rates...');

  // Check if rates already exist
  const existingRates = await prisma.vatRate.findMany();
  if (existingRates.length > 0) {
    console.log('VAT rates already exist, skipping seed.');
    return;
  }

  // Insert Czech VAT rates valid from 2024-01-01
  const rates = [
    {
      code: 'STANDARD',
      name: 'Základní sazba',
      percentage: 21.0,
      validFrom: new Date('2024-01-01T00:00:00Z'),
      validTo: null,
    },
    {
      code: 'REDUCED',
      name: 'Snížená sazba',
      percentage: 12.0,
      validFrom: new Date('2024-01-01T00:00:00Z'),
      validTo: null,
    },
    {
      code: 'ZERO',
      name: 'Nulová sazba',
      percentage: 0.0,
      validFrom: new Date('2024-01-01T00:00:00Z'),
      validTo: null,
    },
  ];

  for (const rate of rates) {
    await prisma.vatRate.create({
      data: rate,
    });
  }

  console.log('VAT rates seeded successfully!');
}

main()
  .catch((e) => {
    console.error('Error seeding VAT rates:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
