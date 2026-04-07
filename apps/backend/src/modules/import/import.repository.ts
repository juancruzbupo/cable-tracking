import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ExcelParseError } from '../../common/utils/excel-parser.util';

@Injectable()
export class ImportRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get the PrismaService for transaction-based operations.
   * Import operations run inside executeInTransaction which provides a tx client,
   * so the service still needs direct access for that pattern.
   */
  get prismaClient() {
    return this.prisma;
  }

  /** Fetch import logs ordered by most recent. */
  async getImportLogs(limit = 20) {
    return this.prisma.importLog.findMany({
      orderBy: { executedAt: 'desc' },
      take: limit,
    });
  }

  /** Create an import log entry. */
  async createImportLog(data: {
    tipo: string;
    fileName: string;
    totalRows: number;
    validRows: number;
    invalidRows: number;
    newClients: number;
    updatedClients: number;
    errors: ExcelParseError[];
  }) {
    return this.prisma.importLog.create({
      data: {
        tipo: data.tipo,
        fileName: data.fileName,
        totalRows: data.totalRows,
        validRows: data.validRows,
        invalidRows: data.invalidRows,
        newClients: data.newClients,
        updatedClients: data.updatedClients,
        errors: data.errors.length > 0 ? (data.errors as unknown as Prisma.InputJsonValue) : undefined,
        status:
          data.validRows === 0 && data.invalidRows > 0
            ? 'FAILED'
            : data.invalidRows > 0
              ? 'PARTIAL'
              : 'SUCCESS',
      },
    });
  }
}
