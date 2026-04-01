import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Dashboard')
@Roles('ADMIN', 'OPERADOR', 'VISOR')
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  getMetrics() { return this.dashboardService.getDashboardMetrics(); }

  @Get('corte')
  getClientesParaCorte() { return this.dashboardService.getClientesParaCorte(); }

  @Get('tendencia')
  getTendencia() { return this.dashboardService.getTendencia(); }

  @Get('mrr')
  getMrr() { return this.dashboardService.getMrr(); }

  @Get('riesgo')
  getRiesgo() { return this.dashboardService.getRiesgo(); }

  @Get('crecimiento')
  getCrecimiento() { return this.dashboardService.getCrecimiento(); }

  @Get('zonas')
  getZonas() { return this.dashboardService.getZonas(); }
}
