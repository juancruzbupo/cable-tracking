import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const planes = [
    { nombre: 'Cable TV', tipo: 'CABLE' as const, precio: 0 },
    { nombre: 'Internet 6MB', tipo: 'INTERNET' as const, precio: 0 },
    { nombre: 'Internet 50MB', tipo: 'INTERNET' as const, precio: 0 },
    { nombre: 'Internet 100MB', tipo: 'INTERNET' as const, precio: 0 },
  ];

  for (const p of planes) {
    const existing = await prisma.servicePlan.findFirst({ where: { nombre: p.nombre, tipo: p.tipo } });
    if (existing) { console.log(`Plan ya existe: ${p.nombre}`); continue; }
    await prisma.servicePlan.create({ data: p });
    console.log(`Plan creado: ${p.nombre} (${p.tipo})`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
