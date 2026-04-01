import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(
    userId: string,
    action: string,
    entityType: string,
    entityId: string,
    metadata?: object,
  ) {
    return this.prisma.auditLog.create({
      data: { userId, action, entityType, entityId, metadata: metadata || undefined },
    });
  }

  async getByEntity(entityId: string, limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { entityId },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getByMultipleEntities(entityIds: string[], limit = 50) {
    return this.prisma.auditLog.findMany({
      where: { entityId: { in: entityIds } },
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
