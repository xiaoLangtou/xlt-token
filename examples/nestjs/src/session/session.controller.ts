import { Body, Controller, Get, Post } from '@nestjs/common';
import { LoginId, StpUtil, TokenValue } from '@xlt-token/nestjs';

@Controller('session')
export class SessionController {
  /**
   * 顶号演示：isConcurrent=false 时同账号二次登录会使旧 token 收到 BE_REPLACED。
   * 可在 AppConfigService 中临时改 isConcurrent: false 体验。
   */
  @Post('login-replace')
  async loginReplace(@Body() dto: { loginId: string }) {
    const token = await StpUtil.login(dto.loginId);
    return { token, loginId: dto.loginId };
  }

  /** 共享登录态：isShare=true 时同账号返回相同 token */
  @Post('login-share')
  async loginShare(@Body() dto: { loginId: string; device?: string }) {
    const token = await StpUtil.login(dto.loginId, { device: dto.device ?? 'default' });
    return { token, hint: '需 config.isShare=true 才返回相同 token' };
  }

  /** 管理员踢人 → 下次请求 KICK_OUT */
  @Post('kickout')
  async kickout(@Body() dto: { loginId: string; device?: string }) {
    const ok = await StpUtil.kickout(dto.loginId, dto.device);
    return { ok };
  }

  @Post('logout-by-login-id')
  async logoutByLoginId(@Body() dto: { loginId: string }) {
    const ok = await StpUtil.logoutByLoginId(dto.loginId);
    return { ok };
  }

  @Get('online-count')
  async onlineCount() {
    const count = await StpUtil.getOnlineCount();
    return { count };
  }

  @Get('online-ids')
  async onlineIds() {
    const loginIds = await StpUtil.getOnlineLoginIds({ page: 0, pageSize: 50 });
    return { loginIds };
  }

  @Get('check')
  async check(@TokenValue() token: string, @LoginId() loginId: string) {
    return { loginId, token, isLogin: true };
  }
}
