/**
 * Crea el usuario admin por defecto.
 * Ejecutar: npx ts-node scripts/seed-admin.ts
 */
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const email = 'admin@cable.local';
  const password = 'Admin1234!';
  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`Usuario admin ya existe: ${email}`);
    return;
  }

  const hashed = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      name: 'Administrador',
      email,
      password: hashed,
      role: 'ADMIN',
      isActive: true,
    },
  });

  console.log('Usuario admin creado:');
  console.log(`  Email: ${user.email}`);
  console.log(`  Password: ${password}`);
  console.log(`  Rol: ${user.role}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
