import { Module } from '@nestjs/common';
import { ImportService } from './import.service';
import { ImportRepository } from './import.repository';
import { ImportController } from './import.controller';

@Module({
  controllers: [ImportController],
  providers: [ImportService, ImportRepository],
})
export class ImportModule {}
