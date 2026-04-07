import { Controller, Get, Post, Patch, Param, Query, Body, Request } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { EquipmentStatus } from '@prisma/client';
import { EquipmentService } from './equipment.service';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Equipment')
@Controller('equipment')
export class EquipmentController {
  constructor(private readonly equipmentService: EquipmentService) {}

  @Get()
  @Roles('ADMIN', 'OPERADOR')
  findAll(@Query('tipo') tipo?: string, @Query('estado') estado?: EquipmentStatus, @Query('search') search?: string, @Query('page') page?: number, @Query('limit') limit?: number) {
    return this.equipmentService.findAll({ tipo, estado, search, page: Number(page) || 1, limit: Number(limit) || 50 });
  }

  @Get('stats')
  @Roles('ADMIN', 'OPERADOR')
  getStats() { return this.equipmentService.getStats(); }

  @Get(':id')
  @Roles('ADMIN', 'OPERADOR')
  findOne(@Param('id') id: string) { return this.equipmentService.findOne(id); }

  @Post()
  @Roles('ADMIN')
  create(@Request() req: AuthenticatedRequest, @Body() body: any) { return this.equipmentService.create(req.user.id, body); }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Param('id') id: string, @Body() body: any) { return this.equipmentService.update(id, body); }
}
