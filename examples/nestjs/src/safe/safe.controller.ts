import { Body, Controller, Post } from "@nestjs/common";
import { LoginId, StpUtil, TokenValue, XltCheckSafe } from "@xlt-token/nestjs";

@Controller("safe")
export class SafeController {
  /** Step 1：验证通过后打开二级认证窗口（演示直接 openSafe，生产环境应先校验短信/密码） */
  @Post("open")
  async open(@TokenValue() token: string, @Body() dto: { business?: string; timeout?: number }) {
    const business = dto.business ?? "pay";
    const timeout = dto.timeout ?? 300;
    await StpUtil.openSafe(token, business, timeout);
    return { ok: true, business, timeout };
  }

  @Post("close")
  async close(@TokenValue() token: string, @Body() dto: { business?: string }) {
    const business = dto.business ?? "pay";
    await StpUtil.closeSafe(token, business);
    return { ok: true, business };
  }

  /** Step 2：敏感操作，Guard 自动 checkSafe */
  @XltCheckSafe("pay")
  @Post("transfer")
  transfer(@LoginId() loginId: string, @Body() dto: { amount: number; to: string }) {
    return { ok: true, loginId, ...dto };
  }

  @XltCheckSafe("deleteAccount")
  @Post("delete-account")
  deleteAccount(@LoginId() loginId: string) {
    return { ok: true, loginId, deleted: true };
  }
}
