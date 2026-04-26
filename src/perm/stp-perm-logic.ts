import { Inject, Injectable } from '@nestjs/common';
import { type StpInterface, XLT_STP_INTERFACE } from './stp-interface';
import { XLT_TOKEN_CONFIG, XLT_TOKEN_STORE, type XltTokenConfig } from '../core/xlt-token-config';
import type { XltTokenStore } from '../store/xlt-token-store.interface';
import { XltMode } from '../const';
import { matchPermission } from './perm-pattern-match';
import { NotPermissionException } from '../exceptions/not-permission.exception';
import { NotRoleException } from '../exceptions/not-role.exception';

@Injectable()
export class StpPermLogic {
  constructor(
    @Inject(XLT_STP_INTERFACE) private readonly stpInterface: StpInterface,
    @Inject(XLT_TOKEN_STORE) private readonly tokenStore: XltTokenStore,
    @Inject(XLT_TOKEN_CONFIG) private readonly tokenConfig: XltTokenConfig,
  ) {
  }

  async hasPermission(loginId: string, permission: string): Promise<boolean> {
    // todo 实现权限校验
    if (!loginId || !permission) return false;
    const permissionList = await this.stpInterface.getPermissionList(loginId);
    if (!permissionList || permissionList.length <= 0) return false;
    return permissionList.some((p) => matchPermission(p, permission));
  }


  async checkPermission(loginId: string, permissions: string[], mode: XltMode): Promise<void> {
    if (!loginId || !permissions) throw new NotPermissionException(permissions, mode);
    if (mode === XltMode.AND) {
      const hasPermissions = await Promise.all(permissions.map(async (p) => await this.hasPermission(loginId, p)));
      const result = hasPermissions.every((p) => p);
      if (!result){
        throw new NotPermissionException(permissions, mode);
      }

    } else {
      const hasPermissions = await Promise.all(permissions.map(async (p) => await this.hasPermission(loginId, p)));
      const result = hasPermissions.some((p) => p);
      if (!result){
        throw new NotPermissionException(permissions, mode);
      }

    }

  }


  async hasRole(loginId: string, role: string): Promise<boolean> {
    if (!loginId || !role) return false;

    const roles = await this.stpInterface.getRoleList(loginId);
    if (!roles || roles.length <= 0) return false;
    return roles.includes(role);

  }


  async checkRole(loginId: string, role: string[], mode: XltMode): Promise<void> {
    if (!loginId || !role) throw new NotRoleException(role, mode)   ;
    if (mode === XltMode.AND) {
      const hasRoles = await Promise.all(role.map(async (r) => await this.hasRole(loginId, r)));
      const result = hasRoles.every((r) => r);
      if (!result){
        throw new NotRoleException(role, mode);
      }
    } else {
      const hasRoles = await Promise.all(role.map(async (r) => await this.hasRole(loginId, r)));
      const result = hasRoles.some((r) => r);
      if (!result){
        throw new NotRoleException(role, mode);
      }
    }
  }
}
