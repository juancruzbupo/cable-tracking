import { Module, Controller, Get } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { ClientsModule } from './modules/clients/clients.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { ImportModule } from './modules/import/import.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { ExportModule } from './modules/export/export.module';

@Controller()
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}

@Module({
  imports: [
    PrismaModule,
    ClientsModule,
    DocumentsModule,
    ImportModule,
    DashboardModule,
    ExportModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
