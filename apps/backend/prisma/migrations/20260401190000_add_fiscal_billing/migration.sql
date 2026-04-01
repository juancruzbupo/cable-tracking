-- Fiscal billing system
CREATE TYPE "TipoDocumento" AS ENUM ('CUIT', 'CUIL', 'DNI', 'CONSUMIDOR_FINAL');
CREATE TYPE "CondicionFiscal" AS ENUM ('RESPONSABLE_INSCRIPTO', 'MONOTRIBUTISTA', 'CONSUMIDOR_FINAL', 'EXENTO');
CREATE TYPE "TipoComprobante" AS ENUM ('FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'RECIBO_X');
CREATE TYPE "EstadoComprobante" AS ENUM ('PENDIENTE', 'EMITIDO', 'ANULADO', 'ERROR');

-- Fiscal fields on clients
ALTER TABLE "clients" ADD COLUMN "tipo_documento" "TipoDocumento";
ALTER TABLE "clients" ADD COLUMN "numero_doc_fiscal" TEXT;
ALTER TABLE "clients" ADD COLUMN "condicion_fiscal" "CondicionFiscal" NOT NULL DEFAULT 'CONSUMIDOR_FINAL';
ALTER TABLE "clients" ADD COLUMN "razon_social" TEXT;
ALTER TABLE "clients" ADD COLUMN "telefono" TEXT;
ALTER TABLE "clients" ADD COLUMN "email" TEXT;

-- Comprobantes table
CREATE TABLE "comprobantes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "subscription_id" UUID,
    "payment_period_id" TEXT,
    "tipo" "TipoComprobante" NOT NULL,
    "numero" INTEGER NOT NULL,
    "punto_venta" INTEGER NOT NULL DEFAULT 1,
    "fecha" DATE NOT NULL,
    "emisor_cuit" TEXT NOT NULL,
    "emisor_razon_social" TEXT NOT NULL,
    "emisor_condicion" TEXT NOT NULL,
    "receptor_doc" TEXT NOT NULL,
    "receptor_nombre" TEXT NOT NULL,
    "receptor_condicion" TEXT NOT NULL,
    "subtotal" DECIMAL(10,2) NOT NULL,
    "descuento" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "iva" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(10,2) NOT NULL,
    "detalle" JSONB NOT NULL,
    "estado" "EstadoComprobante" NOT NULL DEFAULT 'PENDIENTE',
    "cae" TEXT,
    "cae_fecha_vto" TIMESTAMP(3),
    "provider_response" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "comprobantes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "comprobantes_client_id_idx" ON "comprobantes"("client_id");
CREATE INDEX "comprobantes_estado_idx" ON "comprobantes"("estado");
CREATE INDEX "comprobantes_fecha_idx" ON "comprobantes"("fecha");

ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Empresa config
CREATE TABLE "empresa_config" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "cuit" TEXT NOT NULL,
    "razon_social" TEXT NOT NULL,
    "condicion_fiscal" TEXT NOT NULL,
    "domicilio_fiscal" TEXT,
    "ingresos_brutos" TEXT,
    "fecha_inicio_act" TEXT,
    "punto_venta" INTEGER NOT NULL DEFAULT 1,
    "provider_name" TEXT NOT NULL DEFAULT 'mock',
    "provider_api_key" TEXT,
    "provider_config" JSONB,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,
    CONSTRAINT "empresa_config_pkey" PRIMARY KEY ("id")
);

-- Seed empresa config
INSERT INTO "empresa_config" ("id", "cuit", "razon_social", "condicion_fiscal", "punto_venta", "provider_name", "updated_at")
VALUES (gen_random_uuid(), '00-00000000-0', 'Empresa de Cable S.R.L.', 'Responsable Inscripto', 1, 'mock', NOW());
