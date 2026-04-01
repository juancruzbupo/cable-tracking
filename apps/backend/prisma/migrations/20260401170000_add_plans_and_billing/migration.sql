-- ServicePlan table
CREATE TABLE "service_plans" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" TEXT NOT NULL,
    "tipo" "ServiceType" NOT NULL,
    "precio" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "service_plans_pkey" PRIMARY KEY ("id")
);

-- Add fields to subscriptions
ALTER TABLE "subscriptions" ADD COLUMN "plan_id" UUID;
ALTER TABLE "subscriptions" ADD COLUMN "deuda_calculada" INTEGER;
ALTER TABLE "subscriptions" ADD COLUMN "requiere_corte" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "subscriptions" ADD COLUMN "ultimo_calculo" TIMESTAMP(3);

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_id_fkey"
    FOREIGN KEY ("plan_id") REFERENCES "service_plans"("id") ON DELETE SET NULL ON UPDATE CASCADE;
