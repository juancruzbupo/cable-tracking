-- CreateEnum
CREATE TYPE "ClientStatus" AS ENUM ('ACTIVO', 'BAJA');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('RAMITO', 'FACTURA');

-- CreateTable
CREATE TABLE "clients" (
    "id" UUID NOT NULL,
    "codigo_original" TEXT,
    "nombre_original" TEXT NOT NULL,
    "nombre_normalizado" TEXT NOT NULL,
    "fecha_alta" DATE,
    "estado" "ClientStatus" NOT NULL DEFAULT 'ACTIVO',
    "calle" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "documents" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "tipo" "DocumentType" NOT NULL,
    "fecha_documento" DATE,
    "numero_documento" TEXT,
    "descripcion_original" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_periods" (
    "id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "periodo" DATE NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "import_logs" (
    "id" UUID NOT NULL,
    "tipo" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "total_rows" INTEGER NOT NULL,
    "valid_rows" INTEGER NOT NULL,
    "invalid_rows" INTEGER NOT NULL,
    "new_clients" INTEGER NOT NULL DEFAULT 0,
    "updated_clients" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "status" TEXT NOT NULL DEFAULT 'SUCCESS',
    "executed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "clients_nombre_normalizado_key" ON "clients"("nombre_normalizado");

-- CreateIndex
CREATE INDEX "clients_estado_idx" ON "clients"("estado");

-- CreateIndex
CREATE INDEX "clients_nombre_normalizado_idx" ON "clients"("nombre_normalizado");

-- CreateIndex
CREATE INDEX "documents_tipo_idx" ON "documents"("tipo");

-- CreateIndex
CREATE INDEX "documents_client_id_idx" ON "documents"("client_id");

-- CreateIndex
CREATE INDEX "documents_client_id_tipo_idx" ON "documents"("client_id", "tipo");

-- CreateIndex
CREATE INDEX "payment_periods_client_id_periodo_idx" ON "payment_periods"("client_id", "periodo");

-- CreateIndex
CREATE INDEX "payment_periods_client_id_year_month_idx" ON "payment_periods"("client_id", "year", "month");

-- CreateIndex
CREATE INDEX "payment_periods_document_id_idx" ON "payment_periods"("document_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_periods_client_id_periodo_document_id_key" ON "payment_periods"("client_id", "periodo", "document_id");

-- CreateIndex
CREATE INDEX "import_logs_tipo_idx" ON "import_logs"("tipo");

-- CreateIndex
CREATE INDEX "import_logs_executed_at_idx" ON "import_logs"("executed_at");

-- AddForeignKey
ALTER TABLE "documents" ADD CONSTRAINT "documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_periods" ADD CONSTRAINT "payment_periods_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_periods" ADD CONSTRAINT "payment_periods_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
