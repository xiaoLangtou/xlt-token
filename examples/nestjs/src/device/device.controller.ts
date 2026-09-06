import { Body, Controller, Get, Post } from "@nestjs/common";
import { LoginId, StpUtil, TokenValue, XltCheckRole, XltMode } from "@xlt-token/nestjs";

@Controller("device")
export class DeviceController {
  /** 指定 device 登录（pc / app / h5） */
  @Post("login")
  async login(@LoginId() loginId: string, @Body() dto: { device: string }) {
    const token = await StpUtil.login(loginId, { device: dto.device });
    return { token, loginId, device: dto.device };
  }

  @Get("list")
  async list(@LoginId() loginId: string) {
    const devices = await StpUtil.getDeviceList(loginId);
    return { loginId, devices };
  }

  /** 仅踢指定设备 */
  @XltCheckRole("admin", { mode: XltMode.AND })
  @Post("kickout-by-device")
  async kickoutByDevice(@Body() dto: { loginId: string; device: string }) {
    const ok = await StpUtil.kickoutByDevice(dto.loginId, dto.device);
    return { ok };
  }

  /** 精确踢指定 token */
  @XltCheckRole("admin", { mode: XltMode.AND })
  @Post("kickout-by-token")
  async kickoutByToken(@Body() dto: { token: string }) {
    const ok = await StpUtil.kickoutByToken(dto.token);
    return { ok };
  }

  /** 全端登出 */
  @XltCheckRole("admin", { mode: XltMode.AND })
  @Post("force-logout")
  async forceLogout(@Body() dto: { loginId: string }) {
    const ok = await StpUtil.forceLogout(dto.loginId);
    return { ok };
  }

  @Get("me")
  me(@LoginId() loginId: string, @TokenValue() token: string) {
    return { loginId, token };
  }
}
