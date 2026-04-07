import { Controller, Get, Post, Patch, Delete, Param, Body, Query, Request } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ServiceType } from '@prisma/client';
import { PlansService } from './plans.service';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { AuthenticatedRequest } from '../../common/types/authenticated-request';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Plans')
@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  @Roles('ADMIN', 'OPERADOR', 'VISOR')
  findActive(@Query('tipo') tipo?: ServiceType) {
    return this.plansService.findActive(tipo);
  }

  @Get('all')
  @Roles('ADMIN')
  findAll() {
    return this.plansService.findAll();
  }

  @Post()
  @Roles('ADMIN')
  create(@Request() req: AuthenticatedRequest, @Body() body: { nombre: string; tipo: ServiceType; precio: number; descripcion?: string }) {
    return this.plansService.create(req.user.id, body);
  }

  @Patch(':id')
  @Roles('ADMIN')
  update(@Request() req: AuthenticatedRequest, @Param('id') id: string, @Body() body: UpdatePlanDto) {
    return this.plansService.update(req.user.id, id, body);
  }

  @Delete(':id')
  @Roles('ADMIN')
  remove(@Request() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.plansService.remove(req.user.id, id);
  }
}
