-- Client: tipo de comprobante (FACTURA o RAMITO)
ALTER TABLE "clients" ADD COLUMN "tipo_comprobante" TEXT NOT NULL DEFAULT 'RAMITO';

-- EmpresaConfig: credenciales TusFacturas
ALTER TABLE "empresa_config" ADD COLUMN "tf_usertoken" TEXT;
ALTER TABLE "empresa_config" ADD COLUMN "tf_apikey" TEXT;
ALTER TABLE "empresa_config" ADD COLUMN "tf_apitoken" TEXT;
