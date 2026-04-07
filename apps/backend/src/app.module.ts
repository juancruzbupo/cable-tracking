import { Module, Controller, Get } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { validate } from './config/env.validation';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuditModule } from './common/audit/audit.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ImportModule } from './modules/import/import.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExportModule } from './modules/export/export.module';
import { AuthModule } from './modules/auth/auth.module';
import { PlansModule } from './modules/plans/plans.module';
import { SchedulerModule } from './modules/scheduler/scheduler.module';
import { BillingModule } from './modules/billing/billing.module';
import { PromotionsModule } from './modules/promotions/promotions.module';
import { FiscalModule } from './modules/fiscal/fiscal.module';
import { EquipmentModule } from './modules/equipment/equipment.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { JwtAuthGuard } from './modules/auth/jwt-auth.guard';
import { RolesGuard } from './modules/auth/roles.guard';
import { Public } from './modules/auth/public.decorator';

@Controller()
class HealthController {
  @Public()
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate }),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    AuditModule,
    ClientsModule,
    DocumentsModule,
    ImportModule,
    DashboardModule,
    ExportModule,
    AuthModule,
    PlansModule,
    SchedulerModule,
    BillingModule,
    PromotionsModule,
    FiscalModule,
    EquipmentModule,
    TicketsModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
