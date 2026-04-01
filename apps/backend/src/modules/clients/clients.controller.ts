import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { ClientsService } from './clients.service';
import { FindClientsDto } from './dto/find-clients.dto';
import { FindClientDetailDto } from './dto/find-client-detail.dto';

@ApiTags('Clients')
@Controller('clients')
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  findAll(@Query() filters: FindClientsDto) {
    return this.clientsService.findAll(filters);
  }

  @Get('stats')
  getStats() {
    return this.clientsService.getDebtStats();
  }

  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @Query() query: FindClientDetailDto,
  ) {
    const result = await this.clientsService.findOneWithDebt(
      id,
      query.docPage,
      query.docLimit,
    );
    if (!result) {
      throw new NotFoundException(`Cliente ${id} no encontrado`);
    }
    return result;
  }
}
