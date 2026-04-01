-- ARCA fields and configurable cutoff threshold

-- Client: location + zone
ALTER TABLE "clients" ADD COLUMN "codigo_postal" TEXT;
ALTER TABLE "clients" ADD COLUMN "localidad" TEXT;
ALTER TABLE "clients" ADD COLUMN "provincia" TEXT DEFAULT 'Entre Ríos';
ALTER TABLE "clients" ADD COLUMN "zona" TEXT;
CREATE INDEX "clients_zona_idx" ON "clients"("zona");

-- Document: forma de pago
ALTER TABLE "documents" ADD COLUMN "forma_pago" TEXT;

-- Comprobante: ARCA fields + FK fix
ALTER TABLE "comprobantes" ADD COLUMN "concepto" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "comprobantes" ADD COLUMN "fecha_serv_desde" DATE;
ALTER TABLE "comprobantes" ADD COLUMN "fecha_serv_hasta" DATE;
ALTER TABLE "comprobantes" ADD COLUMN "fecha_vto_pago" DATE;
ALTER TABLE "comprobantes" ADD COLUMN "forma_pago" TEXT DEFAULT 'CONTADO';

-- Fix paymentPeriodId to UUID type for FK
ALTER TABLE "comprobantes" ALTER COLUMN "payment_period_id" TYPE UUID USING payment_period_id::uuid;
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_payment_period_id_fkey"
    FOREIGN KEY ("payment_period_id") REFERENCES "payment_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- EmpresaConfig: new fields
ALTER TABLE "empresa_config" ADD COLUMN "iibb" TEXT;
ALTER TABLE "empresa_config" ADD COLUMN "actividad_codigo" TEXT DEFAULT '613000';
ALTER TABLE "empresa_config" ADD COLUMN "localidad" TEXT;
ALTER TABLE "empresa_config" ADD COLUMN "logo_url" TEXT;
ALTER TABLE "empresa_config" ADD COLUMN "umbral_corte" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "empresa_config" ADD COLUMN "zona_default" TEXT;
