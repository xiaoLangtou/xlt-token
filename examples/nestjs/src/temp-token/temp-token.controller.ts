import { BadRequestException, Body, Controller, Post } from '@nestjs/common';
import { StpUtil, XltIgnore } from '@xlt-token/nestjs';

@Controller('temp-token')
export class TempTokenController {
  /** 创建临时 token（如邮件重置密码链接） */
  @XltIgnore()
  @Post('create')
  async create(@Body() dto: { userId: string; timeout?: number }) {
    const value = `resetPwd:${dto.userId}`;
    const tempToken = await StpUtil.createTempToken(value, dto.timeout ?? 1800);
    return {
      tempToken,
      link: `http://localhost:${process.env.PORT ?? 3000}/temp-token/consume?t=${tempToken}`,
    };
  }

  /** 消费临时 token（一次性） */
  @XltIgnore()
  @Post('consume')
  async consume(@Body() dto: { tempToken: string; newPassword?: string }) {
    const value = await StpUtil.parseTempToken(dto.tempToken);
    if (!value) throw new BadRequestException('链接无效或已过期');

    const [action, userId] = value.split(':');
    if (action !== 'resetPwd' || !userId) {
      throw new BadRequestException('无效的临时 token 载荷');
    }

    await StpUtil.deleteTempToken(dto.tempToken);

    return {
      ok: true,
      userId,
      newPassword: dto.newPassword ?? '(demo: password reset simulated)',
    };
  }
}
