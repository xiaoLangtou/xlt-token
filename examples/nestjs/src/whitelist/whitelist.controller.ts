import { Controller, Get } from '@nestjs/common';
import { LoginId, XltCheckLogin, XltIgnore } from '@xlt-token/nestjs';

/**
 * 白名单模式（defaultCheck: false）专用控制器。
 *
 * 启动方式：XLT_DEFAULT_CHECK=false pnpm start
 *
 * - 未标注的路由默认公开
 * - @XltCheckLogin 的路由需要登录
 */
@Controller('whitelist')
export class WhitelistController {
  @XltIgnore()
  @Get('public')
  publicRoute() {
    return { mode: 'whitelist', access: 'public' };
  }

  @XltCheckLogin()
  @Get('private')
  privateRoute(@LoginId() loginId: string) {
    return { mode: 'whitelist', access: 'private', loginId };
  }
}
