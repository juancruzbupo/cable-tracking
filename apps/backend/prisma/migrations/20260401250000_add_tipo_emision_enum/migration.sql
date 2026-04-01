-- CreateEnum
CREATE TYPE "TipoEmision" AS ENUM ('RAMITO', 'FACTURA');

-- AlterTable: convert String to enum
ALTER TABLE "clients" ALTER COLUMN "tipo_comprobante" DROP DEFAULT;
ALTER TABLE "clients" ALTER COLUMN "tipo_comprobante" TYPE "TipoEmision" USING "tipo_comprobante"::"TipoEmision";
ALTER TABLE "clients" ALTER COLUMN "tipo_comprobante" SET DEFAULT 'RAMITO';
