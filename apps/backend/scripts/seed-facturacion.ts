/**
 * Seed de datos para probar el flujo completo de facturación.
 *
 * Crea:
 *  - EmpresaConfig en modo mock (listo para emitir RECIBO_X)
 *  - 4 planes con precios reales
 *  - 6 clientes con distintos escenarios fiscales y de deuda
 *  - Suscripciones con pagos históricos
 *  - 1 promoción de meses gratis activa
 *  - 1 ticket abierto y 1 equipo asignado
 *
 * Ejecutar:
 *   cd apps/backend
 *   npx ts-node scripts/seed-facturacion.ts
 *
 * Para limpiar y volver a correr:
 *   npx ts-node scripts/seed-facturacion.ts --clean
 */

import { PrismaClient, TipoEmision, TipoDocumento, CondicionFiscal } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const CLEAN = process.argv.includes('--clean');

// ── Helpers ────────────────────────────────────────────────────────────────

function periodo(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}

function mesesAtras(n: number): Date {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  d.setDate(1);
  return d;
}

function docNum(prefix: string, n: number) {
  return `${prefix}${String(n).padStart(8, '0')}`;
}

// ── Limpieza ───────────────────────────────────────────────────────────────

async function clean() {
  console.log('🧹 Limpiando datos de prueba...');
  await prisma.comprobante.deleteMany({});
  await prisma.clientPromotion.deleteMany({});
  await prisma.paymentPeriod.deleteMany({});
  await prisma.document.deleteMany({});
  await prisma.subscription.deleteMany({});
  await prisma.clientNote.deleteMany({});
  await prisma.auditLog.deleteMany({});
  await prisma.ticket.deleteMany({});
  await prisma.equipmentAssignment.deleteMany({});
  await prisma.equipment.deleteMany({});
  await prisma.promotion.deleteMany({});
  await prisma.client.deleteMany({});
  await prisma.servicePlan.deleteMany({});
  await prisma.empresaConfig.deleteMany({});
  await prisma.user.deleteMany({ where: { email: { not: 'admin@cable.local' } } });
  console.log('✅ Limpieza completa\n');
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main() {
  if (CLEAN) await clean();

  console.log('🌱 Iniciando seed de facturación...\n');

  // ── 1. Usuario admin ──────────────────────────────────────────────────────
  let admin = await prisma.user.findUnique({ where: { email: 'admin@cable.local' } });
  if (!admin) {
    admin = await prisma.user.create({
      data: {
        name: 'Administrador',
        email: 'admin@cable.local',
        password: await bcrypt.hash('Admin1234!', 10),
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log('👤 Usuario admin creado: admin@cable.local / Admin1234!');
  } else {
    console.log('👤 Usuario admin ya existe — OK');
  }

  // ── 2. EmpresaConfig en modo mock ─────────────────────────────────────────
  const configExistente = await prisma.empresaConfig.findFirst();
  if (!configExistente) {
    await prisma.empresaConfig.create({
      data: {
        cuit: '20331302954',
        razonSocial: 'JUAN CRUZ RODRIGUEZ BUPO',
        condicionFiscal: 'Monotributista',
        domicilioFiscal: 'RANCILLAC 323, PARANA (CP: 3100), ENTRE RIOS',
        ingresosBrutos: '20331302954',
        actividadCodigo: '613000',
        localidad: 'Paraná',
        puntoVenta: 1,
        providerName: 'mock',
        umbralCorte: 2,
        zonaDefault: 'Centro',
      },
    });
    console.log('🏢 EmpresaConfig creada en modo MOCK');
  } else {
    if (configExistente.providerName !== 'mock') {
      await prisma.empresaConfig.update({
        where: { id: configExistente.id },
        data: { providerName: 'mock' },
      });
      console.log('🏢 EmpresaConfig actualizada a modo MOCK');
    } else {
      console.log('🏢 EmpresaConfig ya existe en modo mock — OK');
    }
  }

  // ── 3. Planes con precios ─────────────────────────────────────────────────
  const today = new Date();
  const year = today.getFullYear();

  const planesData = [
    { nombre: 'Cable Básico',   tipo: 'CABLE'    as const, precio: 8500  },
    { nombre: 'Cable Premium',  tipo: 'CABLE'    as const, precio: 12000 },
    { nombre: 'Internet 50MB',  tipo: 'INTERNET' as const, precio: 9000  },
    { nombre: 'Internet 100MB', tipo: 'INTERNET' as const, precio: 13500 },
  ];

  const planes: Record<string, any> = {};
  for (const p of planesData) {
    const existing = await prisma.servicePlan.findFirst({
      where: { nombre: p.nombre, tipo: p.tipo },
    });
    if (existing) {
      planes[p.nombre] = existing;
      if (Number(existing.precio) === 0) {
        await prisma.servicePlan.update({
          where: { id: existing.id },
          data: { precio: p.precio },
        });
      }
      console.log(`📦 Plan ya existe: ${p.nombre}`);
    } else {
      planes[p.nombre] = await prisma.servicePlan.create({ data: p });
      console.log(`📦 Plan creado: ${p.nombre} ($${p.precio})`);
    }
  }

  // ── 4. Clientes de prueba ─────────────────────────────────────────────────
  console.log('\n👥 Creando clientes de prueba...\n');

  const clientesData = [
    {
      codCli:           'TEST001',
      nombreOriginal:   'GOMEZ ROBERTO',
      nombreNormalizado:'Gomez Roberto',
      calle:            'Av. Rivadavia 1234',
      zona:             'Norte',
      fechaAlta:        new Date(year - 1, 0, 1),
      tipoComprobante:  TipoEmision.RAMITO,
      tipoDocumento:    null,
      numeroDocFiscal:  null,
      condicionFiscal:  CondicionFiscal.CONSUMIDOR_FINAL,
      telefono:         '3434001001',
      servicios: [
        { tipo: 'CABLE' as const, plan: 'Cable Básico', mesesPagados: 12 },
      ],
      label: '→ RAMITO / Al día / No emite comprobante',
    },
    {
      codCli:           'TEST002',
      nombreOriginal:   'FERNANDEZ MARIA',
      nombreNormalizado:'Fernandez Maria',
      calle:            'San Martín 567',
      zona:             'Centro',
      fechaAlta:        new Date(year - 1, 2, 1),
      tipoComprobante:  TipoEmision.FACTURA,
      tipoDocumento:    TipoDocumento.DNI,
      numeroDocFiscal:  '28456789',
      condicionFiscal:  CondicionFiscal.CONSUMIDOR_FINAL,
      telefono:         '3434002002',
      email:            'maria.fernandez@test.com',
      servicios: [
        { tipo: 'CABLE'    as const, plan: 'Cable Básico',  mesesPagados: 10 },
        { tipo: 'INTERNET' as const, plan: 'Internet 50MB', mesesPagados: 10 },
      ],
      label: '→ FACTURA C (Mono→CF) / Al día / Cable + Internet',
    },
    {
      codCli:           'TEST003',
      nombreOriginal:   'RODRIGUEZ CARLOS',
      nombreNormalizado:'Rodriguez Carlos',
      calle:            'Urquiza 890',
      zona:             'Sur',
      fechaAlta:        new Date(year - 1, 0, 1),
      tipoComprobante:  TipoEmision.FACTURA,
      tipoDocumento:    TipoDocumento.DNI,
      numeroDocFiscal:  '31789012',
      condicionFiscal:  CondicionFiscal.CONSUMIDOR_FINAL,
      telefono:         '3434003003',
      servicios: [
        { tipo: 'CABLE' as const, plan: 'Cable Premium', mesesPagados: 10 },
      ],
      label: '→ FACTURA C (Mono→CF) / 2 meses deuda / En corte + ticket',
    },
    {
      codCli:           'TEST004',
      nombreOriginal:   'MARTINEZ CONSTRUCTORA SA',
      nombreNormalizado:'Martinez Constructora Sa',
      calle:            'Corrientes 2100',
      zona:             'Centro',
      fechaAlta:        new Date(year - 1, 3, 1),
      tipoComprobante:  TipoEmision.FACTURA,
      tipoDocumento:    TipoDocumento.CUIT,
      numeroDocFiscal:  '30712345678',
      condicionFiscal:  CondicionFiscal.RESPONSABLE_INSCRIPTO,
      razonSocial:      'Martínez Constructora S.A.',
      telefono:         '3434004004',
      email:            'admin@martinezconstructora.com',
      servicios: [
        { tipo: 'INTERNET' as const, plan: 'Internet 100MB', mesesPagados: 9 },
      ],
      label: '→ FACTURA C (Mono→RI) / Al día / CUIT empresa',
    },
    {
      codCli:           'TEST005',
      nombreOriginal:   'LOPEZ ANA',
      nombreNormalizado:'Lopez Ana',
      calle:            'Belgrano 445',
      zona:             'Este',
      fechaAlta:        new Date(year - 1, 5, 1),
      tipoComprobante:  TipoEmision.FACTURA,
      tipoDocumento:    TipoDocumento.CUIT,
      numeroDocFiscal:  '27654321098',
      condicionFiscal:  CondicionFiscal.MONOTRIBUTISTA,
      razonSocial:      'Lopez Ana - Servicios Contables',
      telefono:         '3434005005',
      servicios: [
        { tipo: 'CABLE' as const, plan: 'Cable Básico', mesesPagados: 6 },
      ],
      label: '→ FACTURA C (Mono→Mono) / 1 mes deuda',
    },
    {
      codCli:           'TEST006',
      nombreOriginal:   'PEREZ JUAN',
      nombreNormalizado:'Perez Juan',
      calle:            'Entre Ríos 3300',
      zona:             'Norte',
      fechaAlta:        new Date(year - 1, 0, 1),
      tipoComprobante:  TipoEmision.FACTURA,
      tipoDocumento:    TipoDocumento.DNI,
      numeroDocFiscal:  '25123456',
      condicionFiscal:  CondicionFiscal.CONSUMIDOR_FINAL,
      telefono:         '3434006006',
      servicios: [
        { tipo: 'CABLE'    as const, plan: 'Cable Básico',  mesesPagados: 12 },
        { tipo: 'INTERNET' as const, plan: 'Internet 50MB', mesesPagados: 12 },
      ],
      tienePromo: true,
      label: '→ FACTURA C / Con promo 3 meses gratis / Al día',
    },
  ];

  const clientesCreados: Record<string, any> = {};
  let docCounter = 1;

  for (const c of clientesData) {
    const existing = await prisma.client.findUnique({ where: { codCli: c.codCli } });
    if (existing) {
      console.log(`  ⏭️  Ya existe: ${c.nombreNormalizado}`);
      clientesCreados[c.codCli] = existing;
      continue;
    }

    const client = await prisma.client.create({
      data: {
        codCli:           c.codCli,
        nombreOriginal:   c.nombreOriginal,
        nombreNormalizado:c.nombreNormalizado,
        calle:            c.calle,
        zona:             c.zona,
        fechaAlta:        c.fechaAlta,
        tipoComprobante:  c.tipoComprobante,
        tipoDocumento:    c.tipoDocumento as any,
        numeroDocFiscal:  c.numeroDocFiscal,
        condicionFiscal:  c.condicionFiscal,
        razonSocial:      (c as any).razonSocial,
        telefono:         c.telefono,
        email:            (c as any).email,
        localidad:        'Paraná',
        provincia:        'Entre Ríos',
        codigoPostal:     '3100',
      },
    });

    clientesCreados[c.codCli] = client;

    // Crear suscripciones y pagos históricos
    for (const srv of c.servicios) {
      const plan = planes[srv.plan];

      const sub = await prisma.subscription.create({
        data: {
          clientId:  client.id,
          tipo:      srv.tipo,
          fechaAlta: c.fechaAlta,
          estado:    'ACTIVO',
          planId:    plan?.id ?? null,
        },
      });

      for (let i = srv.mesesPagados; i >= 1; i--) {
        const fechaPago = mesesAtras(i);
        const mesYear  = fechaPago.getFullYear();
        const mesMonth = fechaPago.getMonth() + 1;

        const doc = await prisma.document.create({
          data: {
            clientId:            client.id,
            codCli:              c.codCli,
            subscriptionId:      sub.id,
            tipo:                'RAMITO',
            fechaDocumento:      fechaPago,
            numeroDocumento:     docNum('R', docCounter++),
            descripcionOriginal: `${srv.tipo} ${mesMonth}/${mesYear}`,
            formaPago:           'EFECTIVO',
          },
        });

        await prisma.paymentPeriod.create({
          data: {
            clientId:       client.id,
            codCli:         c.codCli,
            documentId:     doc.id,
            subscriptionId: sub.id,
            periodo:        periodo(mesYear, mesMonth),
            year:           mesYear,
            month:          mesMonth,
          },
        });
      }

      // Calcular y actualizar deuda
      const hoy = new Date();
      const mesesTotales =
        (hoy.getFullYear() - c.fechaAlta.getFullYear()) * 12 +
        (hoy.getMonth() - c.fechaAlta.getMonth()) +
        (hoy.getDate() >= 15 ? 1 : 0);
      const deuda = Math.max(0, mesesTotales - srv.mesesPagados);

      await prisma.subscription.update({
        where: { id: sub.id },
        data: {
          deudaCalculada: deuda,
          requiereCorte:  deuda > 2,
          ultimoCalculo:  new Date(),
        },
      });
    }

    console.log(`  ✅ ${client.nombreNormalizado} ${c.label}`);
  }

  // ── 5. Promoción meses gratis para TEST006 ────────────────────────────────
  const hoy = new Date();
  const promoExistente = await prisma.promotion.findFirst({
    where: { nombre: 'Promo Test — 3 Meses Gratis' },
  });

  if (!promoExistente) {
    const promo = await prisma.promotion.create({
      data: {
        nombre:      'Promo Test — 3 Meses Gratis',
        tipo:        'MESES_GRATIS',
        valor:       3,
        scope:       'CLIENTE',
        fechaInicio: mesesAtras(3),
        fechaFin:    new Date(hoy.getFullYear(), hoy.getMonth() + 3, 0),
        activa:      true,
        descripcion: 'Promo de prueba — 3 meses gratis para TEST006',
      },
    });

    const cliente6 = clientesCreados['TEST006'];
    if (cliente6) {
      const sub6 = await prisma.subscription.findFirst({
        where: { clientId: cliente6.id, tipo: 'CABLE' },
      });
      if (sub6) {
        await prisma.clientPromotion.create({
          data: {
            promotionId:    promo.id,
            subscriptionId: sub6.id,
            assignedBy:     admin.id,
          },
        });
        console.log('\n🎁 Promo "3 Meses Gratis" asignada a Perez Juan (Cable)');
      }
    }
  } else {
    console.log('\n🎁 Promoción de prueba ya existe — OK');
  }

  // ── 6. Equipo asignado a TEST003 ──────────────────────────────────────────
  const equipoExistente = await prisma.equipment.findFirst({
    where: { numeroSerie: 'TEST-MODEM-001' },
  });

  if (!equipoExistente) {
    const equipo = await prisma.equipment.create({
      data: {
        tipo:        'MODEM',
        marca:       'TP-Link',
        modelo:      'Archer VR600',
        numeroSerie: 'TEST-MODEM-001',
        estado:      'ASIGNADO',
        notas:       'Equipo de prueba',
      },
    });

    const cliente3 = clientesCreados['TEST003'];
    if (cliente3) {
      await prisma.equipmentAssignment.create({
        data: {
          equipmentId:      equipo.id,
          clientId:         cliente3.id,
          fechaInstalacion: mesesAtras(6),
          notas:            'Instalación inicial',
        },
      });
      console.log('🔧 Equipo TP-Link asignado a Rodriguez Carlos');
    }
  } else {
    console.log('🔧 Equipo de prueba ya existe — OK');
  }

  // ── 7. Ticket abierto en TEST003 ──────────────────────────────────────────
  const ticketExistente = await prisma.ticket.findFirst({
    where: { creadoPor: admin.id, tipo: 'LENTITUD_INTERNET' },
  });

  if (!ticketExistente) {
    const cliente3 = clientesCreados['TEST003'];
    if (cliente3) {
      await prisma.ticket.create({
        data: {
          clientId:   cliente3.id,
          tipo:       'LENTITUD_INTERNET',
          descripcion:'Velocidad real: 3MB de 50MB contratados.',
          estado:     'ABIERTO',
          creadoPor:  admin.id,
        },
      });
      console.log('🎫 Ticket abierto en Rodriguez Carlos');
    }
  } else {
    console.log('🎫 Ticket de prueba ya existe — OK');
  }

  // ── 8. Nota en TEST002 ────────────────────────────────────────────────────
  const cliente2 = clientesCreados['TEST002'];
  if (cliente2) {
    const notaExistente = await prisma.clientNote.findFirst({
      where: { clientId: cliente2.id },
    });
    if (!notaExistente) {
      await prisma.clientNote.create({
        data: {
          clientId: cliente2.id,
          userId:   admin.id,
          content:  'Cliente solicita factura a fin de mes. Confirmado por teléfono.',
        },
      });
      console.log('📝 Nota agregada en Fernandez Maria');
    }
  }

  // ── Resumen ───────────────────────────────────────────────────────────────
  console.log('\n' + '─'.repeat(60));
  console.log('✅ Seed completado\n');
  console.log('ACCESO:');
  console.log('  URL:      http://localhost:5174');
  console.log('  Email:    admin@cable.local');
  console.log('  Password: Admin1234!\n');
  console.log('CLIENTES DE PRUEBA:');
  console.log('  TEST001  Gomez Roberto          → RAMITO (no emite comprobante)');
  console.log('  TEST002  Fernandez Maria         → FACTURA C / Cable + Internet');
  console.log('  TEST003  Rodriguez Carlos        → FACTURA C / 2 meses deuda + ticket');
  console.log('  TEST004  Martinez Constructora   → FACTURA C / CUIT empresa');
  console.log('  TEST005  Lopez Ana               → FACTURA C / 1 mes deuda');
  console.log('  TEST006  Perez Juan              → FACTURA C / promo 3 meses gratis');
  console.log('');
  console.log('FLUJO DE PRUEBA:');
  console.log('  1. Clientes → buscar TEST002 (Fernandez Maria)');
  console.log('  2. Registrar pago manual del mes actual');
  console.log('  3. Ir a Comprobantes → debe aparecer RECIBO_X con PDF');
  console.log('  4. Buscar TEST001 → registrar pago → NO genera comprobante');
  console.log('─'.repeat(60) + '\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());