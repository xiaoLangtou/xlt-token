import { BadRequestException, Body, Controller, Post } from "@nestjs/common";
import { LoginId, StpUtil, XltIgnore } from "@xlt-token/nestjs";

@Controller("temp-token")
export class TempTokenController {
  /** 创建临时 token（如邮件重置密码链接） */
  @Post("create")
  async create(@LoginId() userId: string, @Body() dto: { timeout?: number }) {
    const value = `resetPwd:${userId}`;
    const tempToken = await StpUtil.createTempToken(value, dto.timeout ?? 1800);
    return {
      tempToken,
      link: `http://localhost:${process.env.PORT ?? 3000}/temp-token/consume?t=${tempToken}`,
    };
  }

  /** 消费临时 token（一次性，原子消费：读取即销毁） */
  @XltIgnore()
  @Post("consume")
  async consume(@Body() dto: { tempToken: string; newPassword?: string }) {
    // consumeTempToken 原子完成"读取 + 销毁"：并发重复提交时恰好一次拿到业务值
    const value = await StpUtil.consumeTempToken(dto.tempToken);
    if (!value) throw new BadRequestException("链接无效、已过期或已被使用");

    const [action, userId] = value.split(":");
    if (action !== "resetPwd" || !userId) {
      throw new BadRequestException("无效的临时 token 载荷");
    }

    return {
      ok: true,
      userId,
      newPassword: dto.newPassword ?? "(demo: password reset simulated)",
    };
  }
}
