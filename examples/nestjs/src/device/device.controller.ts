import { Body, Controller, Get, Post } from '@nestjs/common';
import { LoginId, StpUtil, TokenValue } from '@xlt-token/nestjs';

@Controller('device')
export class DeviceController {
  /** 指定 device 登录（pc / app / h5） */
  @Post('login')
  async login(@Body() dto: { loginId: string; device: string }) {
    const token = await StpUtil.login(dto.loginId, { device: dto.device });
    return { token, loginId: dto.loginId, device: dto.device };
  }

  @Get('list')
  async list(@LoginId() loginId: string) {
    const devices = await StpUtil.getDeviceList(loginId);
    return { loginId, devices };
  }

  /** 仅踢指定设备 */
  @Post('kickout-by-device')
  async kickoutByDevice(@Body() dto: { loginId: string; device: string }) {
    const ok = await StpUtil.kickoutByDevice(dto.loginId, dto.device);
    return { ok };
  }

  /** 精确踢指定 token */
  @Post('kickout-by-token')
  async kickoutByToken(@Body() dto: { token: string }) {
    const ok = await StpUtil.kickoutByToken(dto.token);
    return { ok };
  }

  /** 全端登出 */
  @Post('force-logout')
  async forceLogout(@LoginId() loginId: string) {
    const ok = await StpUtil.forceLogout(loginId);
    return { ok };
  }

  @Get('me')
  me(@LoginId() loginId: string, @TokenValue() token: string) {
    return { loginId, token };
  }
}
