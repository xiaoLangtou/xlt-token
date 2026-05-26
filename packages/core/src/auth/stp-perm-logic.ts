import type { StpInterface } from '../perm/stp-interface.js';
import type { XltTokenConfig } from '../config/xlt-token-config.js';
import type { XltTokenStore } from '../store/xlt-token-store.interface.js';
import { XltMode } from '../const/index.js';
import { matchPermission } from '../perm/perm-pattern-match.js';
import { NotPermissionException } from '../exceptions/not-permission.exception.js';
import { NotRoleException } from '../exceptions/not-role.exception.js';

export class StpPermLogic {
  constructor(
    private readonly stpInterface: StpInterface,
    private readonly tokenStore: XltTokenStore,
    private readonly tokenConfig: XltTokenConfig,
  ) {
  }

  async hasPermission(loginId: string, permission: string): Promise<boolean> {
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
      if (!result) {
        throw new NotPermissionException(permissions, mode);
      }
    } else {
      const hasPermissions = await Promise.all(permissions.map(async (p) => await this.hasPermission(loginId, p)));
      const result = hasPermissions.some((p) => p);
      if (!result) {
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
    if (!loginId || !role) throw new NotRoleException(role, mode);
    if (mode === XltMode.AND) {
      const hasRoles = await Promise.all(role.map(async (r) => await this.hasRole(loginId, r)));
      const result = hasRoles.every((r) => r);
      if (!result) {
        throw new NotRoleException(role, mode);
      }
    } else {
      const hasRoles = await Promise.all(role.map(async (r) => await this.hasRole(loginId, r)));
      const result = hasRoles.some((r) => r);
      if (!result) {
        throw new NotRoleException(role, mode);
      }
    }
  }
}
