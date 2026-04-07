import { Controller, Get, Post, Patch, Param, Query, Body, Request, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Response } from 'express';
import { FiscalService } from './fiscal.service';
import { Roles } from '../auth/roles.decorator';
import { UpdateEmpresaConfigDto } from './dto/update-empresa-config.dto';
import { FindComprobantesDto } from './dto/find-comprobantes.dto';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';

@ApiTags('Fiscal')
@Controller('fiscal')
export class FiscalController {
  constructor(private readonly fiscalService: FiscalService) {}

  @Get('config')
  @Roles('ADMIN')
  getConfig() { return this.fiscalService.getConfig(); }

  @Get('config/test')
  @Roles('ADMIN')
  testConnection() { return this.fiscalService.testConnection(); }

  @Patch('config')
  @Roles('ADMIN')
  updateConfig(@Request() req: AuthenticatedRequest, @Body() body: UpdateEmpresaConfigDto) { return this.fiscalService.updateConfig(req.user.id, body); }

  @Get('comprobantes')
  @Roles('ADMIN', 'OPERADOR')
  findAll(@Query() q: FindComprobantesDto) { return this.fiscalService.findAll(q); }

  @Get('comprobantes/:id')
  @Roles('ADMIN', 'OPERADOR')
  findOne(@Param('id') id: string) { return this.fiscalService.findOne(id); }

  @Get('comprobantes/:id/pdf')
  @Roles('ADMIN', 'OPERADOR')
  async getPdf(@Param('id') id: string, @Res() res: Response) {
    const buffer = await this.fiscalService.getPdf(id);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="comprobante_${id}.pdf"`);
    res.send(buffer);
  }

  @Post('comprobantes/pago/:paymentPeriodId')
  @Roles('ADMIN', 'OPERADOR')
  async emitirPorPago(@Request() req: AuthenticatedRequest, @Param('paymentPeriodId') ppId: string) {
    const pp = await this.fiscalService.getPaymentPeriod(ppId);
    return this.fiscalService.emitirComprobanteParaPago(pp.clientId, pp.subscriptionId || '', ppId, req.user.id);
  }

  @Post('comprobantes/batch')
  @Roles('ADMIN')
  emitirBatch(@Request() req: AuthenticatedRequest, @Body() body: { month: number; year: number }) {
    return this.fiscalService.emitirBatch(body.month, body.year, req.user.id);
  }

  @Patch('comprobantes/:id/anular')
  @Roles('ADMIN')
  anular(@Request() req: AuthenticatedRequest, @Param('id') id: string) { return this.fiscalService.anular(id, req.user.id); }
}
