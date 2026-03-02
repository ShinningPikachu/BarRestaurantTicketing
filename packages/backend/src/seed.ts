import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

function parseCSV(content: string): any[] {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj: any = {};
    
    headers.forEach((header, index) => {
      const value = values[index];
      
      // Convert based on header name
      if (header === 'priceCents') {
        obj[header] = parseInt(value);
      } else if (header === 'available') {
        obj[header] = value.toLowerCase() === 'true';
      } else {
        obj[header] = value;
      }
    });
    
    return obj;
  });
}

async function seed() {
  console.log('Starting database seed...');

  try {
    // Clear existing menu items
    console.log('Clearing existing menu items...');
    await prisma.menuItem.deleteMany();

    // Read CSV file
    const csvPath = path.join(__dirname, '../data/menu-items.csv');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    
    // Parse CSV
    const menuItems = parseCSV(csvContent);
    
    console.log(`Found ${menuItems.length} menu items to insert`);

    // Insert menu items
    for (const item of menuItems) {
      await prisma.menuItem.create({
        data: item,
      });
      console.log(`✓ Created: ${item.name}`);
    }

    console.log('✅ Seed completed successfully!');
  } catch (error) {
    console.error('❌ Error during seed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed();
