import { Injectable } from '@nestjs/common';
import { BusinessLoginGuard } from './business-login.guard';

/**
 * 用于 @XltIgnore() 控制器：跳过全局 XltTokenGuard，但仍强制走登录校验。
 */
@Injectable()
export class ProfileLoginGuard extends BusinessLoginGuard {
  protected requiresLogin(): boolean {
    return true;
  }
}
