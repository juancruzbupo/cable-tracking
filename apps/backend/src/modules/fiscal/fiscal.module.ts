import { Module } from '@nestjs/common';
import { FiscalService } from './fiscal.service';
import { FiscalController } from './fiscal.controller';
import { MockFiscalProvider } from './providers/mock-fiscal.provider';

@Module({
  controllers: [FiscalController],
  providers: [FiscalService, MockFiscalProvider],
  exports: [FiscalService],
})
export class FiscalModule {}
