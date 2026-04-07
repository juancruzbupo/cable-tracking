import { Controller, Get, Post, Patch, Delete, Param, Query, Body, Request } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { PromoScope, PromoType } from '@prisma/client';
import { PromotionsService } from './promotions.service';
import { CreatePromotionDto } from './dto/create-promotion.dto';
import { UpdatePromotionDto } from './dto/update-promotion.dto';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Promotions')
@Controller('promotions')
export class PromotionsController {
  constructor(private readonly promoService: PromotionsService) {}

  @Get()
  @Roles('ADMIN', 'OPERADOR')
  findAll(@Query('scope') scope?: PromoScope, @Query('tipo') tipo?: PromoType, @Query('activa') activa?: string, @Query('planId') planId?: string) {
    return this.promoService.findAll({
      scope, tipo,
      activa: activa === 'true' ? true : activa === 'false' ? false : undefined,
      planId,
    });
  }

  @Get('active')
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  findActive() {
    return this.promoService.findActive();
  }

  @Get(':id')
  @Roles('ADMIN', 'OPERADOR')
  findOne(@Param('id') id: string) {
    return this.promoService.findOne(id);
  }

  @Post()
  @Roles('ADMIN')
  create(@Request() req: AuthenticatedRequest, @Body() body: CreatePromotionDto) {
    return this.promoService.create(req.user.id, body);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdatePromotionDto) {
    return this.promoService.update(req.user.id, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.promoService.remove(req.user.id, id);
  }
}
