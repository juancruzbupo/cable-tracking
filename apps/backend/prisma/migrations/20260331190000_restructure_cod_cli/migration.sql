-- Restructure: replace codigo_original with cod_cli as unique key
-- Match documents/payment_periods by cod_cli instead of nombreNormalizado

-- Step 1: Rename codigo_original to cod_cli on clients
ALTER TABLE "clients" RENAME COLUMN "codigo_original" TO "cod_cli";

-- Step 2: Make cod_cli NOT NULL (all values already trimmed and non-null)
ALTER TABLE "clients" ALTER COLUMN "cod_cli" SET NOT NULL;

-- Step 3: Add unique constraint on cod_cli
CREATE UNIQUE INDEX "clients_cod_cli_key" ON "clients"("cod_cli");

-- Step 4: Remove unique constraint from nombre_normalizado
DROP INDEX "clients_nombre_normalizado_key";

-- Step 5: Add cod_cli column to documents
ALTER TABLE "documents" ADD COLUMN "cod_cli" TEXT NOT NULL DEFAULT '';

-- Step 6: Add cod_cli column to payment_periods
ALTER TABLE "payment_periods" ADD COLUMN "cod_cli" TEXT NOT NULL DEFAULT '';

-- Step 7: Create index on documents.cod_cli
CREATE INDEX "documents_cod_cli_idx" ON "documents"("cod_cli");

-- Step 8: Remove defaults (they were only for migration)
ALTER TABLE "documents" ALTER COLUMN "cod_cli" DROP DEFAULT;
ALTER TABLE "payment_periods" ALTER COLUMN "cod_cli" DROP DEFAULT;
