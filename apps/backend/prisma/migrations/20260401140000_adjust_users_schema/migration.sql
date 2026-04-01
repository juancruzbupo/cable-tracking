-- Adjust Users table: rename enum and fields to match spec
ALTER TYPE "UserRole" RENAME TO "Role";
ALTER TABLE "users" RENAME COLUMN "nombre" TO "name";
ALTER TABLE "users" RENAME COLUMN "activo" TO "is_active";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'OPERADOR';
