-- Promotion system
CREATE TYPE "PromoType" AS ENUM ('PORCENTAJE', 'MONTO_FIJO', 'MESES_GRATIS', 'PRECIO_FIJO');
CREATE TYPE "PromoScope" AS ENUM ('PLAN', 'CLIENTE');

CREATE TABLE "promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "tipo" "PromoType" NOT NULL,
    "valor" DECIMAL(10,2) NOT NULL,
    "scope" "PromoScope" NOT NULL,
    "fecha_inicio" DATE NOT NULL,
    "fecha_fin" DATE NOT NULL,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "descripcion" TEXT,
    "plan_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "promotions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "client_promotions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "promotion_id" UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "assigned_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "client_promotions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "promotions_plan_id_idx" ON "promotions"("plan_id");
CREATE INDEX "promotions_fecha_inicio_fecha_fin_idx" ON "promotions"("fecha_inicio", "fecha_fin");
CREATE INDEX "client_promotions_subscription_id_idx" ON "client_promotions"("subscription_id");
CREATE UNIQUE INDEX "client_promotions_promotion_id_subscription_id_key" ON "client_promotions"("promotion_id", "subscription_id");

ALTER TABLE "promotions" ADD CONSTRAINT "promotions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "service_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "client_promotions" ADD CONSTRAINT "client_promotions_promotion_id_fkey"
    FOREIGN KEY ("promotion_id") REFERENCES "promotions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "client_promotions" ADD CONSTRAINT "client_promotions_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
