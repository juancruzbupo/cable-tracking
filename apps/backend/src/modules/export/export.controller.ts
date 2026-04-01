import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import dayjs from 'dayjs';
import { ExportService } from './export.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Export')
@Roles('ADMIN', 'OPERADOR')
@Controller('export')
export class ExportController {
  constructor(private readonly exportService: ExportService) {}

  /**
   * Descarga Excel con clientes para corte.
   */
  @Get('corte')
  async exportCorte(@Res() res: Response) {
    const buffer = await this.exportService.exportCorteToExcel();
    const filename = `corte_${dayjs().format('YYYY-MM-DD')}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  }

  /**
   * Descarga Excel con todos los clientes y su deuda.
   */
  @Get('clients')
  async exportClients(@Res() res: Response) {
    const buffer = await this.exportService.exportClientsToExcel();
    const filename = `clientes_${dayjs().format('YYYY-MM-DD')}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  }

  /**
   * Descarga Excel resumen (2 hojas: resumen + para corte).
   */
  @Get('resumen')
  async exportResumen(@Res() res: Response) {
    const buffer = await this.exportService.exportResumenToExcel();
    const filename = `resumen_${dayjs().format('YYYY-MM-DD')}.xlsx`;

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(Buffer.from(buffer));
  }
}
