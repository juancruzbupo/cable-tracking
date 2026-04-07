import { Controller, Get, Post, Patch, Param, Query, Body, Request } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TicketType } from '@prisma/client';
import { TicketsService } from './tickets.service';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Tickets')
@Controller('tickets')
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  @Get()
  @Roles('ADMIN', 'OPERADOR')
  findAll(@Query('estado') estado?: string, @Query('tipo') tipo?: TicketType, @Query('clientId') clientId?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.ticketsService.findAll({ estado, tipo, clientId, page: Number(page) || 1, limit: Number(limit) || 20 });
  }

  @Get('stats')
  @Roles('ADMIN', 'OPERADOR')
  getStats() { return this.ticketsService.getStats(); }

  @Patch(':id/resolver')
  @Roles('ADMIN', 'OPERADOR')
  resolve(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body('notas') notas?: string) {
    return this.ticketsService.resolve(req.user.id, id, notas);
  }
}
