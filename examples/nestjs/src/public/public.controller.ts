import { Controller, Get, Param, Req } from '@nestjs/common';
import { StpUtil, XltIgnore } from '@xlt-token/nestjs';
import type { Request } from 'express';

@Controller('public')
export class PublicController {
  /** @XltIgnore：黑名单模式下公开访问 */
  @XltIgnore()
  @Get('health')
  health() {
    return { ok: true, service: 'xlt-token-example' };
  }

  /**
   * 匿名 + 登录均可访问：不走 Guard 校验，软检测 token。
   * 对应 docs/09-recipes §8。
   */
  @XltIgnore()
  @Get('product/:id')
  async productDetail(@Param('id') id: string, @Req() req: Request) {
    const loginId = await StpUtil.getLoginId(req);
    return {
      id,
      title: `Product ${id}`,
      myRating: loginId ? await this.mockUserRating(loginId, id) : null,
      viewer: loginId ?? 'anonymous',
    };
  }

  private async mockUserRating(loginId: string, productId: string) {
    return { loginId, productId, score: 5 };
  }
}
