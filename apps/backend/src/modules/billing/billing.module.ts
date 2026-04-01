import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { PdfGeneratorService } from './pdf-generator.service';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [ClientsModule],
  controllers: [BillingController],
  providers: [BillingService, PdfGeneratorService],
})
export class BillingModule {}
