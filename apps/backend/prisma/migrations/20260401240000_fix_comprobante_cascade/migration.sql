-- DropForeignKey
ALTER TABLE "comprobantes" DROP CONSTRAINT IF EXISTS "comprobantes_client_id_fkey";

-- AddForeignKey (with CASCADE)
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "comprobantes" DROP CONSTRAINT IF EXISTS "comprobantes_subscription_id_fkey";

-- AddForeignKey (with SET NULL)
ALTER TABLE "comprobantes" ADD CONSTRAINT "comprobantes_subscription_id_fkey" FOREIGN KEY ("subscription_id") REFERENCES "subscriptions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
