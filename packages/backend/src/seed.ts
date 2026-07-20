import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { parseMenuImportCsv } from './services/menu-import.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function seed() {
  console.log('Starting database seed...');

  try {
    if (process.env.BAR_TICKETING_ALLOW_INITIAL_SEED !== '1') {
      throw new Error(
        'Initial menu seeding is disabled. Use the guarded database preparation command for a brand-new database.'
      );
    }

    // Read CSV file
    const csvPath = path.join(__dirname, '../data/menu-items.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const menuItems = parseMenuImportCsv(csvContent);
    
    console.log(`Found ${menuItems.length} menu items to insert`);

    await prisma.$transaction(async (tx) => {
      const [menuItemsCount, tablesCount, ordersCount, paidTicketsCount, preOrderSessionsCount] = await Promise.all([
        tx.menuItem.count(),
        tx.table.count(),
        tx.order.count(),
        tx.paidTicket.count(),
        tx.preOrderSession.count(),
      ]);
      if (menuItemsCount || tablesCount || ordersCount || paidTicketsCount || preOrderSessionsCount) {
        throw new Error('Refusing to seed a database that already contains application data.');
      }

      for (const item of menuItems) {
        await tx.menuItem.create({
          data: {
            ...item,
            primaryName: item.primaryName ?? null,
            secondaryName: item.secondaryName ?? null,
            costCents: item.costCents ?? null,
            sku: item.sku ?? null,
            description: item.description ?? null,
            imageDataUrl: item.imageDataUrl ?? null,
            available: item.available ?? true,
          },
        });
        console.log(`✓ Created: ${item.name}`);
      }
    }, { timeout: 30_000 });

    console.log('✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
