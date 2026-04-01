import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SchedulerService } from './scheduler.service';
import { Roles } from '../auth/roles.decorator';

@ApiTags('Scheduler')
@Controller('scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get('status')
  @Roles('ADMIN')
  getStatus() {
    return this.schedulerService.getStatus();
  }
}
