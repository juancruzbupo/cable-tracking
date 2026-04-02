import {
  Controller, Get, Post, Patch, Delete, Param, Query, Body, Request,
  NotFoundException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { TipoEmision } from '@prisma/client';
import { ClientsService } from './clients.service';
import { ClientsOperationsService } from './clients-operations.service';
import { PromotionsService } from '../promotions/promotions.service';
import { FiscalService } from '../fiscal/fiscal.service';
import { EquipmentService } from '../equipment/equipment.service';
import { TicketsService } from '../tickets/tickets.service';
import { FindClientsDto } from './dto/find-clients.dto';
import { FindClientDetailDto } from './dto/find-client-detail.dto';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly ops: ClientsOperationsService,
    private readonly promoService: PromotionsService,
    private readonly fiscalService: FiscalService,
    private readonly equipmentService: EquipmentService,
    private readonly ticketsService: TicketsService,
  ) {}

  @Get()
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  findAll(@Query() filters: FindClientsDto) {
    return this.clientsService.findAll(filters);
  }

  @Get('stats')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  getStats() {
    return this.clientsService.getDebtStats();
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  async findOne(@Param('id') id: string, @Query() query: FindClientDetailDto) {
    const result = await this.clientsService.findOneWithDebt(id, query.docPage, query.docLimit);
    if (!result) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return result;
  }

  // ── Alta de cliente ──────────────────────────────────────
  @Post()
  @Roles('ADMIN', 'OPERADOR')
  createClient(@Request() req: any, @Body() body: any) {
    return this.ops.createClient(req.user.id, body);
  }

  // ── Baja / Reactivación ──────────────────────────────────
  @Patch(':id/deactivate')
  @Roles('ADMIN', 'OPERADOR')
  deactivateClient(@Request() req: any, @Param('id') id: string) {
    return this.ops.deactivateClient(req.user.id, id);
  }

  @Patch(':id/reactivate')
  @Roles('ADMIN')
  reactivateClient(@Request() req: any, @Param('id') id: string) {
    return this.ops.reactivateClient(req.user.id, id);
  }

  // ── Suscripciones ────────────────────────────────────────
  @Patch(':id/subscriptions/:subId/plan')
  @Roles('ADMIN', 'OPERADOR')
  updateSubPlan(@Request() req: any, @Param('id') id: string, @Param('subId') subId: string, @Body('planId') planId: string) {
    return this.ops.updateSubscriptionPlan(req.user.id, id, subId, planId);
  }

  @Patch(':id/subscriptions/:subId/deactivate')
  @Roles('ADMIN', 'OPERADOR')
  deactivateSub(@Request() req: any, @Param('id') id: string, @Param('subId') subId: string) {
    return this.ops.deactivateSubscription(req.user.id, id, subId);
  }

  @Patch(':id/subscriptions/:subId/reactivate')
  @Roles('ADMIN')
  reactivateSub(@Request() req: any, @Param('id') id: string, @Param('subId') subId: string) {
    return this.ops.reactivateSubscription(req.user.id, id, subId);
  }

  @Patch(':id/subscriptions/:subId')
  @Roles('ADMIN')
  updateSubFechaAlta(@Request() req: any, @Param('id') id: string, @Param('subId') subId: string, @Body('fechaAlta') fechaAlta: string) {
    return this.ops.updateSubscriptionFechaAlta(req.user.id, id, subId, fechaAlta);
  }

  // ── Pagos manuales ───────────────────────────────────────
  @Post(':id/subscriptions/:subId/payments')
  @Roles('ADMIN', 'OPERADOR')
  createPayment(@Request() req: any, @Param('id') id: string, @Param('subId') subId: string, @Body() body: { year: number; month: number }) {
    return this.ops.createManualPayment(req.user.id, id, subId, body.year, body.month);
  }

  @Delete(':id/subscriptions/:subId/payments/:periodId')
  @Roles('ADMIN')
  deletePayment(@Request() req: any, @Param('id') id: string, @Param('subId') subId: string, @Param('periodId') periodId: string) {
    return this.ops.deleteManualPayment(req.user.id, id, subId, periodId);
  }

  // ── Notas ────────────────────────────────────────────────
  @Get(':id/notes')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  getNotes(@Param('id') id: string) {
    return this.ops.getNotes(id);
  }

  @Post(':id/notes')
  @Roles('ADMIN', 'OPERADOR')
  createNote(@Request() req: any, @Param('id') id: string, @Body('content') content: string) {
    return this.ops.createNote(req.user.id, id, content);
  }

  @Delete(':id/notes/:noteId')
  @Roles('ADMIN')
  deleteNote(@Request() req: any, @Param('id') id: string, @Param('noteId') noteId: string) {
    return this.ops.deleteNote(req.user.id, id, noteId);
  }

  // ── Historial ────────────────────────────────────────────
  @Get(':id/history')
  @Roles('ADMIN', 'OPERADOR')
  getHistory(@Param('id') id: string) {
    return this.ops.getHistory(id);
  }

  // ── Datos fiscales ──────────────────────────────────────
  @Patch(':id/fiscal')
  @Roles('ADMIN', 'OPERADOR')
  updateFiscal(@Request() req: any, @Param('id') id: string, @Body() body: any) {
    return this.fiscalService.updateClientFiscal(req.user.id, id, body);
  }

  @Patch(':id/comprobante-config')
  @Roles('ADMIN', 'OPERADOR')
  updateComprobanteConfig(@Request() req: any, @Param('id') id: string, @Body('tipoComprobante') tipoComprobante: TipoEmision) {
    return this.fiscalService.updateComprobanteConfig(req.user.id, id, tipoComprobante);
  }

  // ── Promociones ────────────────────────────────────────
  @Get(':id/promotions')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  getClientPromotions(@Param('id') id: string) {
    return this.promoService.getClientPromotions(id);
  }

  @Post(':id/subscriptions/:subId/promotions')
  @Roles('ADMIN', 'OPERADOR')
  assignPromo(@Request() req: any, @Param('id') id: string, @Param('subId') subId: string, @Body('promotionId') promotionId: string) {
    return this.promoService.assignToSubscription(req.user.id, id, subId, promotionId);
  }

  @Delete(':id/subscriptions/:subId/promotions/:promoId')
  @Roles('ADMIN')
  removePromo(@Request() req: any, @Param('id') id: string, @Param('subId') subId: string, @Param('promoId') promoId: string) {
    return this.promoService.removeFromSubscription(req.user.id, id, subId, promoId);
  }

  // ── Equipos ──────────────────────────────────────────────
  @Get(':id/equipment')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  getClientEquipment(@Param('id') id: string) {
    return this.equipmentService.getClientEquipment(id);
  }

  @Post(':id/equipment')
  @Roles('ADMIN', 'OPERADOR')
  assignEquipment(@Request() req: any, @Param('id') id: string, @Body() body: { equipmentId: string; notas?: string }) {
    return this.equipmentService.assignToClient(req.user.id, id, body.equipmentId, body.notas);
  }

  @Patch(':id/equipment/:assignmentId/retirar')
  @Roles('ADMIN', 'OPERADOR')
  retireEquipment(@Request() req: any, @Param('id') id: string, @Param('assignmentId') aId: string, @Body('notas') notas?: string) {
    return this.equipmentService.retire(req.user.id, id, aId, notas);
  }

  // ── Tickets ──────────────────────────────────────────────
  @Get(':id/tickets')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  getClientTickets(@Param('id') id: string) {
    return this.ticketsService.getClientTickets(id);
  }

  @Post(':id/tickets')
  @Roles('ADMIN', 'OPERADOR')
  createTicket(@Request() req: any, @Param('id') id: string, @Body() body: { tipo: string; descripcion?: string }) {
    return this.ticketsService.create(req.user.id, id, body.tipo as any, body.descripcion);
  }

  // ── WhatsApp ────────────────────────────────────────────
  @Get(':id/whatsapp-last')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  getLastWhatsApp(@Param('id') id: string) {
    return this.ops.getLastWhatsApp(id);
  }

  @Post(':id/whatsapp-log')
  @Roles('ADMIN', 'OPERADOR')
  logWhatsApp(@Request() req: any, @Param('id') id: string) {
    return this.ops.logWhatsApp(req.user.id, id);
  }
}
