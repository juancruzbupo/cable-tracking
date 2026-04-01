import { Module } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { ClientsOperationsService } from './clients-operations.service';
import { ClientsController } from './clients.controller';
import { PromotionsModule } from '../promotions/promotions.module';
import { FiscalModule } from '../fiscal/fiscal.module';

@Module({
  imports: [PromotionsModule, FiscalModule],
  controllers: [ClientsController],
  providers: [ClientsService, ClientsOperationsService],
  exports: [ClientsService],
})
export class ClientsModule {}
