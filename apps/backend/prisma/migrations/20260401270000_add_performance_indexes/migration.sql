-- CreateIndex: subscription estado (dashboard queries filter by ACTIVO frequently)
CREATE INDEX IF NOT EXISTS "subscriptions_estado_idx" ON "subscriptions"("estado");

-- CreateIndex: promotion activa (findActive filters by activa=true)
CREATE INDEX IF NOT EXISTS "promotions_activa_idx" ON "promotions"("activa");
