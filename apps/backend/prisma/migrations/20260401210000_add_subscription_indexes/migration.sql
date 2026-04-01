-- Performance indexes for subscription queries
CREATE INDEX IF NOT EXISTS "subscriptions_plan_id_idx" ON "subscriptions"("plan_id");
CREATE INDEX IF NOT EXISTS "subscriptions_client_id_estado_idx" ON "subscriptions"("client_id", "estado");
