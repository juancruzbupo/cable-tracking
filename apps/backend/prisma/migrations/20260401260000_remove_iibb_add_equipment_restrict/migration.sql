-- AlterTable: remove duplicate iibb column (ingresos_brutos already exists)
ALTER TABLE "empresa_config" DROP COLUMN IF EXISTS "iibb";

-- DropForeignKey
ALTER TABLE "equipment_assignments" DROP CONSTRAINT IF EXISTS "equipment_assignments_equipment_id_fkey";

-- AddForeignKey (with RESTRICT)
ALTER TABLE "equipment_assignments" ADD CONSTRAINT "equipment_assignments_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
