import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardRepository } from './dashboard.repository';
import { ClientsModule } from '../clients/clients.module';

@Module({
  imports: [ClientsModule],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardRepository],
  exports: [DashboardService],
})
export class DashboardModule {}
