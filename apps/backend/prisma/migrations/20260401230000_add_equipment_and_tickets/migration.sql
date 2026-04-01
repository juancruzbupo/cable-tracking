-- Equipment management
CREATE TYPE "EquipmentStatus" AS ENUM ('EN_DEPOSITO', 'ASIGNADO', 'EN_REPARACION', 'DE_BAJA');

CREATE TABLE "equipment" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "tipo" TEXT NOT NULL,
    "marca" TEXT,
    "modelo" TEXT,
    "numero_serie" TEXT,
    "estado" "EquipmentStatus" NOT NULL DEFAULT 'EN_DEPOSITO',
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "equipment_numero_serie_key" ON "equipment"("numero_serie");
CREATE INDEX "equipment_tipo_estado_idx" ON "equipment"("tipo", "estado");

CREATE TABLE "equipment_assignments" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "equipment_id" UUID NOT NULL,
    "client_id" UUID NOT NULL,
    "fecha_instalacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fecha_retiro" TIMESTAMP(3),
    "notas" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "equipment_assignments_client_id_idx" ON "equipment_assignments"("client_id");
CREATE INDEX "equipment_assignments_equipment_id_idx" ON "equipment_assignments"("equipment_id");

ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_equipment_id_fkey"
    FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Tickets
CREATE TYPE "TicketStatus" AS ENUM ('ABIERTO', 'RESUELTO');
CREATE TYPE "TicketType" AS ENUM ('SIN_SENIAL', 'LENTITUD_INTERNET', 'RECONEXION', 'INSTALACION', 'CAMBIO_EQUIPO', 'OTRO');

CREATE TABLE "tickets" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_id" UUID NOT NULL,
    "tipo" "TicketType" NOT NULL,
    "descripcion" TEXT,
    "estado" "TicketStatus" NOT NULL DEFAULT 'ABIERTO',
    "notas" TEXT,
    "creado_por" TEXT NOT NULL,
    "resuelto" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tickets_client_id_estado_idx" ON "tickets"("client_id", "estado");
CREATE INDEX "tickets_estado_created_at_idx" ON "tickets"("estado", "created_at");

ALTER TABLE "tickets" ADD CONSTRAINT "tickets_client_id_fkey"
    FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
