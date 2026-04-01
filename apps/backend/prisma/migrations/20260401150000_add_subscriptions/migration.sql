-- Add ServiceType enum and Subscription model
CREATE TYPE "ServiceType" AS ENUM ('CABLE', 'INTERNET');

CREATE TABLE "subscriptions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "tipo" "ServiceType" NOT NULL,
    "fecha_alta" DATE NOT NULL,
    "estado" "ClientStatus" NOT NULL DEFAULT 'ACTIVO',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscriptions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "subscriptions_client_id_idx" ON "subscriptions"("client_id");
CREATE UNIQUE INDEX "subscriptions_client_id_tipo_key" ON "subscriptions"("client_id", "tipo");

ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add subscription_id to documents (nullable for migration)
ALTER TABLE "documents" ADD COLUMN "subscription_id" UUID;
CREATE INDEX "documents_subscription_id_idx" ON "documents"("subscription_id");
ALTER TABLE "documents" ADD CONSTRAINT "documents_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Add subscription_id to payment_periods (nullable for migration)
ALTER TABLE "payment_periods" ADD COLUMN "subscription_id" UUID;
CREATE INDEX "payment_periods_subscription_id_idx" ON "payment_periods"("subscription_id");
ALTER TABLE "payment_periods" ADD CONSTRAINT "payment_periods_subscription_id_fkey"
    FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
