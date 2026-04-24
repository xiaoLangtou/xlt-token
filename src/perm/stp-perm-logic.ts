import { Inject, Injectable } from '@nestjs/common';
import { StpInterface, XLT_STP_INTERFACE } from './stp-interface';
import { XLT_TOKEN_CONFIG, XLT_TOKEN_STORE, XltTokenConfig } from '../core/xlt-token-config';
import { XltTokenStore } from '../store/xlt-token-store.interface';
import { XltMode } from '../const';
import { matchPermission } from './perm-pattern-match';

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
    if (!permissionList.includes(permission)) return false;
    return permissionList.some((p) => matchPermission(p, permission));
  }


  async checkPermission(loginId: string, permissions: string[], mode: XltMode): Promise<boolean> {
    if (!loginId || !permissions) return false;

    if (mode === XltMode.AND) {

      const hasPermissions = await Promise.all(permissions.map(async (p) => await this.hasPermission(loginId, p)));
      const result = hasPermissions.every((p) => p);
      return result;
    } else {
      const hasPermissions = await Promise.all(permissions.map(async (p) => await this.hasPermission(loginId, p)));
      const result = hasPermissions.some((p) => p);
      return result;
    }

  }


  async hasRole(loginId: string, role: string): Promise<boolean> {
    if (!loginId || !role) return false;

    const roles = await this.stpInterface.getRoleList(loginId);
    if (!roles || roles.length <= 0) return false;
    return roles.includes(role);

  }


  async checkRole(loginId: string, role: string[], mode: XltMode): Promise<boolean> {
    if (!loginId || !role) return false;
    if (mode === XltMode.AND) {
      const hasRoles = await Promise.all(role.map(async (r) => await this.hasRole(loginId, r)));
      const result = hasRoles.every((r) => r);
      return result;
    } else {
      const hasRoles = await Promise.all(role.map(async (r) => await this.hasRole(loginId, r)));
      const result = hasRoles.some((r) => r);
      return result;
    }
  }
}
