/**
 * Migra datos existentes a modelo de suscripciones.
 * Ejecutar UNA SOLA VEZ: npx ts-node scripts/migrate-subscriptions.ts
 */
import { PrismaClient, ServiceType } from '@prisma/client';

const prisma = new PrismaClient();

function detectServiceType(description: string | null): ServiceType {
  if (!description) return ServiceType.CABLE;
  const d = description.toLowerCase();
  // Internet patterns (more specific first)
  if (/megas?|internet|mbps?\b|mb\b|fibra/i.test(d)) return ServiceType.INTERNET;
  // Cable patterns
  if (/tvcable|tv\s*cable|tv\s*\+\s*cable|cable/i.test(d)) return ServiceType.CABLE;
  return ServiceType.CABLE; // default
}

async function main() {
  const clients = await prisma.client.findMany({
    include: {
      documents: {
        include: { paymentPeriods: true },
      },
    },
  });

  let totalSubs = 0;
  let clientsWithoutDocs = 0;
  let ambiguous = 0;

  for (const client of clients) {
    const serviceTypes = new Set<ServiceType>();

    // Detect service types from documents
    const docServiceMap = new Map<string, ServiceType>();
    for (const doc of client.documents) {
      const st = detectServiceType(doc.descripcionOriginal);
      serviceTypes.add(st);
      docServiceMap.set(doc.id, st);
    }

    if (client.documents.length === 0) {
      serviceTypes.add(ServiceType.CABLE);
      clientsWithoutDocs++;
    }

    // Create subscriptions for each service type
    for (const tipo of serviceTypes) {
      const sub = await prisma.subscription.upsert({
        where: { clientId_tipo: { clientId: client.id, tipo } },
        update: {},
        create: {
          clientId: client.id,
          tipo,
          fechaAlta: client.fechaAlta || new Date(),
          estado: client.estado,
        },
      });
      totalSubs++;

      // Link documents of this type to subscription
      const docIds = client.documents
        .filter((d) => docServiceMap.get(d.id) === tipo)
        .map((d) => d.id);

      if (docIds.length > 0) {
        await prisma.document.updateMany({
          where: { id: { in: docIds } },
          data: { subscriptionId: sub.id },
        });

        // Link payment periods of those documents
        await prisma.paymentPeriod.updateMany({
          where: { documentId: { in: docIds } },
          data: { subscriptionId: sub.id },
        });
      }
    }
  }

  console.log('=== Migracion de suscripciones completa ===');
  console.log(`Clientes procesados: ${clients.length}`);
  console.log(`Suscripciones creadas: ${totalSubs}`);
  console.log(`Clientes sin documentos (cable por defecto): ${clientsWithoutDocs}`);
  console.log(`Documentos ambiguos: ${ambiguous}`);

  // Verify
  const unlinked = await prisma.document.count({ where: { subscriptionId: null } });
  const unlinkedPP = await prisma.paymentPeriod.count({ where: { subscriptionId: null } });
  console.log(`Documentos sin suscripcion: ${unlinked}`);
  console.log(`PaymentPeriods sin suscripcion: ${unlinkedPP}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
