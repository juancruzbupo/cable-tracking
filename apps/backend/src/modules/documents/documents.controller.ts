import { Controller, Get, Param, Query, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FindDocumentsDto } from './dto/find-documents.dto';

@ApiTags('Documents')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async findAll(@Query() filters: FindDocumentsDto) {
    const { tipo, clientId, page = 1, limit = 20 } = filters;

    const where: Prisma.DocumentWhereInput = {};
    if (tipo) where.tipo = tipo;
    if (clientId) where.clientId = clientId;

    const [data, total] = await Promise.all([
      this.prisma.document.findMany({
        where,
        include: {
          client: { select: { codCli: true, nombreNormalizado: true } },
          paymentPeriods: true,
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.document.count({ where }),
    ]);

    return {
      data,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const doc = await this.prisma.document.findUnique({
      where: { id },
      include: { client: true, paymentPeriods: true },
    });
    if (!doc) throw new NotFoundException(`Documento ${id} no encontrado`);
    return doc;
  }
}
