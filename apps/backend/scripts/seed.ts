/**
 * ============================================================================
 * Seed script - Datos de ejemplo para desarrollo
 * ============================================================================
 * Ejecutar: npx ts-node scripts/seed.ts
 *
 * Crea datos de prueba básicos. Para datos reales, usar la UI de importación.
 */

import { PrismaClient, ClientStatus, DocumentType } from '@prisma/client';
import dayjs from 'dayjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Limpiar
  await prisma.paymentPeriod.deleteMany();
  await prisma.document.deleteMany();
  await prisma.importLog.deleteMany();
  await prisma.client.deleteMany();

  // Crear clientes de ejemplo
  const clients = await Promise.all([
    prisma.client.create({
      data: {
        codigoOriginal: '100',
        nombreOriginal: 'PEREZ JUAN CARLOS',
        nombreNormalizado: 'PEREZ JUAN CARLOS',
        fechaAlta: dayjs('2024-01-01').toDate(),
        estado: ClientStatus.ACTIVO,
        calle: 'SAN MARTIN 123',
      },
    }),
    prisma.client.create({
      data: {
        codigoOriginal: '101',
        nombreOriginal: 'GONZALEZ MARIA LAURA',
        nombreNormalizado: 'GONZALEZ MARIA LAURA',
        fechaAlta: dayjs('2024-03-01').toDate(),
        estado: ClientStatus.ACTIVO,
        calle: 'MITRE 456',
      },
    }),
    prisma.client.create({
      data: {
        codigoOriginal: '102',
        nombreOriginal: 'RODRIGUEZ CARLOS DE BAJA',
        nombreNormalizado: 'RODRIGUEZ CARLOS',
        fechaAlta: dayjs('2024-01-01').toDate(),
        estado: ClientStatus.BAJA,
        calle: 'BROWN 789',
      },
    }),
    prisma.client.create({
      data: {
        codigoOriginal: '103',
        nombreOriginal: 'MARTINEZ ANA',
        nombreNormalizado: 'MARTINEZ ANA',
        fechaAlta: dayjs('2024-06-01').toDate(),
        estado: ClientStatus.ACTIVO,
        calle: 'RIVADAVIA 321',
      },
    }),
  ]);

  console.log(`  ✓ ${clients.length} clientes creados`);

  // Crear documentos y períodos para PEREZ (al día hasta dic 2025)
  const perez = clients[0];
  for (let m = 1; m <= 12; m++) {
    for (const year of [2024, 2025]) {
      if (year === 2025 && m > 12) continue;
      const doc = await prisma.document.create({
        data: {
          clientId: perez.id,
          tipo: DocumentType.FACTURA,
          fechaDocumento: dayjs(`${year}-${m}-15`).toDate(),
          numeroDocumento: `FC-0001-${String(m).padStart(4, '0')}`,
          descripcionOriginal: `TvCable ${getMonthName(m)}${String(year).slice(2)}`,
        },
      });
      await prisma.paymentPeriod.create({
        data: {
          clientId: perez.id,
          documentId: doc.id,
          periodo: dayjs(`${year}-${m}-01`).toDate(),
          year,
          month: m,
        },
      });
    }
  }
  console.log('  ✓ Períodos de PEREZ JUAN CARLOS (al día)');

  // GONZALEZ: solo tiene pagado hasta oct 2024 → deuda
  const gonzalez = clients[1];
  for (let m = 3; m <= 10; m++) {
    const doc = await prisma.document.create({
      data: {
        clientId: gonzalez.id,
        tipo: DocumentType.FACTURA,
        fechaDocumento: dayjs(`2024-${m}-10`).toDate(),
        descripcionOriginal: `TvCable ${getMonthName(m)}24`,
      },
    });
    await prisma.paymentPeriod.create({
      data: {
        clientId: gonzalez.id,
        documentId: doc.id,
        periodo: dayjs(`2024-${m}-01`).toDate(),
        year: 2024,
        month: m,
      },
    });
  }
  console.log('  ✓ Períodos de GONZALEZ MARIA LAURA (deuda desde nov 2024)');

  // MARTINEZ: pagado hasta sep 2025
  const martinez = clients[3];
  for (let m = 6; m <= 12; m++) {
    const doc = await prisma.document.create({
      data: {
        clientId: martinez.id,
        tipo: DocumentType.RAMITO,
        fechaDocumento: dayjs(`2024-${m}-05`).toDate(),
        descripcionOriginal: `6Megas ${getMonthName(m)}24`,
      },
    });
    await prisma.paymentPeriod.create({
      data: {
        clientId: martinez.id,
        documentId: doc.id,
        periodo: dayjs(`2024-${m}-01`).toDate(),
        year: 2024,
        month: m,
      },
    });
  }
  for (let m = 1; m <= 9; m++) {
    const doc = await prisma.document.create({
      data: {
        clientId: martinez.id,
        tipo: DocumentType.RAMITO,
        fechaDocumento: dayjs(`2025-${m}-05`).toDate(),
        descripcionOriginal: `6Megas ${getMonthName(m)}25`,
      },
    });
    await prisma.paymentPeriod.create({
      data: {
        clientId: martinez.id,
        documentId: doc.id,
        periodo: dayjs(`2025-${m}-01`).toDate(),
        year: 2025,
        month: m,
      },
    });
  }
  console.log('  ✓ Períodos de MARTINEZ ANA (deuda desde oct 2025)');

  console.log('\n🌱 Seed completado');
}

function getMonthName(m: number): string {
  const names = [
    '',
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
  ];
  return names[m];
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
