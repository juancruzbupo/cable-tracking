import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsOperationsService } from './clients-operations.service';
import { DebtService } from './debt.service';
import { ClientsController } from './clients.controller';
import { PromotionsModule } from '../promotions/promotions.module';
import { FiscalModule } from '../fiscal/fiscal.module';
import { EquipmentModule } from '../equipment/equipment.module';
import { TicketsModule } from '../tickets/tickets.module';

@Module({
  imports: [PromotionsModule, FiscalModule, EquipmentModule, TicketsModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsOperationsService, DebtService],
  exports: [ClientsService, DebtService],
})
export class ClientsModule {}
