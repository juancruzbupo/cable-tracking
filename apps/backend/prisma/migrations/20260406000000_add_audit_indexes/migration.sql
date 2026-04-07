-- CreateIndex: Client.nombreOriginal for search queries
CREATE INDEX IF NOT EXISTS "clients_nombre_original_idx" ON "clients"("nombre_original");

-- CreateIndex: Subscription.deudaCalculada for debt filtering
CREATE INDEX IF NOT EXISTS "subscriptions_deuda_calculada_idx" ON "subscriptions"("deuda_calculada");

-- CreateIndex: Subscription(estado, requiereCorte) for corte queries
CREATE INDEX IF NOT EXISTS "subscriptions_estado_requiere_corte_idx" ON "subscriptions"("estado", "requiere_corte");

-- CreateIndex: Comprobante(clientId, estado, fecha) composite for filtered queries
CREATE INDEX IF NOT EXISTS "comprobantes_client_estado_fecha_idx" ON "comprobantes"("client_id", "estado", "fecha");
