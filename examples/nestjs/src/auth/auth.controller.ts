import { Body, Controller, Get, Post, UnauthorizedException } from "@nestjs/common";
import { LoginId, StpUtil, TokenValue, XltCheckLogin, XltIgnore } from "@xlt-token/nestjs";
import { cacheUserOnLogin } from "../guards/business-login.guard";
import { DEMO_USERS } from "../stp/demo-stp-interface";

@Controller("auth")
export class AuthController {
  /** 公开：登录（@XltIgnore 放行） */
  @XltIgnore()
  @Post("login")
  async login(@Body() dto: { username: string; password: string; device?: string }) {
    const user =
      dto.username === "admin" || dto.username === DEMO_USERS.admin.loginId
        ? DEMO_USERS.admin
        : dto.username === "user" || dto.username === DEMO_USERS.user.loginId
          ? DEMO_USERS.user
          : null;

    if (!user || user.password !== dto.password) {
      throw new UnauthorizedException("用户名或密码错误");
    }

    const token = await StpUtil.login(user.loginId, { device: dto.device ?? "default" });
    cacheUserOnLogin(user.loginId, dto.username);

    return { token, loginId: user.loginId, device: dto.device ?? "default" };
  }

  /** 需登录：登出 */
  @Post("logout")
  async logout(@TokenValue() token: string) {
    await StpUtil.logout(token);
    return { ok: true };
  }

  /** 需登录：当前用户 */
  @Get("me")
  me(@LoginId() loginId: string, @TokenValue() token: string) {
    return { loginId, token };
  }

  /** 需登录：滑动续期 */
  @Post("renew")
  async renew(@TokenValue() token: string) {
    const ok = await StpUtil.renewTimeout(token, 7 * 24 * 60 * 60);
    if (!ok) throw new UnauthorizedException("token 无效");
    return { ok: true, timeout: 7 * 24 * 60 * 60 };
  }

  /**
   * 白名单模式演示：将环境变量 XLT_DEFAULT_CHECK=false 后，
   * 仅标注 @XltCheckLogin 的路由需要登录。
   */
  @XltCheckLogin()
  @Get("protected-by-check-login")
  protectedByCheckLogin(@LoginId() loginId: string) {
    return { loginId, mode: "whitelist" };
  }
}
