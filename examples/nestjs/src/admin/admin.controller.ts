import { Controller, Get } from '@nestjs/common';
import { XltCheckRole } from '@xlt-token/nestjs';
import { getRecentHookEvents } from '../config/audit.hooks';

@Controller('admin')
export class AdminController {
  @XltCheckRole('admin')
  @Get('hooks')
  hooks() {
    return { events: getRecentHookEvents() };
  }

  @XltCheckRole('admin')
  @Get('dashboard')
  dashboard() {
    return {
      message: '管理员面板',
      tips: ['GET /session/online-count', 'GET /admin/hooks', 'POST /session/kickout'],
    };
  }
}
