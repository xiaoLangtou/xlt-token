import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { XltIgnore } from '@xlt-token/nestjs';
import { ProfileLoginGuard } from '../guards/profile-login.guard';

/**
 * XltAbstractLoginGuard 演示：
 * - 类级别 @XltIgnore 跳过全局 XltTokenGuard
 * - ProfileLoginGuard 仍强制登录，onAuthSuccess 填充 request.user
 */
@XltIgnore()
@UseGuards(ProfileLoginGuard)
@Controller('profile')
export class ProfileController {
  @Get('me')
  me(@Req() req: any) {
    return {
      stpLoginId: req.stpLoginId,
      user: req.user,
    };
  }
}
