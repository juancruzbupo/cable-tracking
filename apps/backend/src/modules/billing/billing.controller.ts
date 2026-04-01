import { Controller, Get, Post, Param, Query, Res, Body } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import dayjs from 'dayjs';
import { BillingService } from './billing.service';
import { Roles } from '../auth/roles.decorator';

const MONTH_SHORT = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];

@ApiTags('Billing')
@Controller('billing')
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('invoice/:clientId')
  @Roles('ADMIN', 'OPERADOR')
  async getInvoice(
    @Param('clientId') clientId: string,
    @Query('month') month: number,
    @Query('year') year: number,
    @Res() res: Response,
  ) {
    const buffer = await this.billingService.generateInvoice(clientId, Number(month), Number(year));
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="factura_${MONTH_SHORT[month]}${year}.pdf"`);
    res.send(buffer);
  }

  @Post('invoices/batch')
  @Roles('ADMIN')
  async batchInvoices(@Body() body: { month: number; year: number }, @Res() res: Response) {
    const buffer = await this.billingService.generateBatchInvoices(body.month, body.year);
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="facturas_${MONTH_SHORT[body.month]}_${body.year}.zip"`);
    res.send(buffer);
  }

  @Get('report')
  @Roles('ADMIN', 'OPERADOR')
  getReport(@Query('month') month: number, @Query('year') year: number) {
    return this.billingService.getReport(Number(month), Number(year));
  }

  @Get('corte/print')
  @Roles('ADMIN', 'OPERADOR')
  async getCortePdf(@Res() res: Response) {
    const buffer = await this.billingService.generateCortePdf();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="corte_${dayjs().format('YYYY-MM-DD')}.pdf"`);
    res.send(buffer);
  }
}
