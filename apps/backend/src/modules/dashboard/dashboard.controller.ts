import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';

@ApiTags('Dashboard')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getMetrics() {
    return this.dashboardService.getDashboardMetrics();
  }

  @Get('corte')
  getClientesParaCorte() {
    return this.dashboardService.getClientesParaCorte();
  }
}
