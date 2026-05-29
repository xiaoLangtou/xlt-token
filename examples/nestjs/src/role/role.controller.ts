import { Controller, Get } from '@nestjs/common';
import { XltCheckRole, XltMode } from '@xlt-token/nestjs';

@Controller('role')
export class RoleController {
  @XltCheckRole('admin')
  @Get('admin-only')
  adminOnly() {
    return { action: 'admin-only', ok: true };
  }

  @XltCheckRole(['admin', 'super'], { mode: XltMode.OR })
  @Get('admin-or-super')
  adminOrSuper() {
    return { action: 'admin-or-super', ok: true };
  }
}
