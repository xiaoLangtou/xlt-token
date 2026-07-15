import type { StpInterface } from "../perm/stp-interface.js";
import type { XltTokenConfig } from "../config/xlt-token-config.js";
import { XltTokenKeys } from "../config/xlt-token-keys.js";
import type { XltTokenStore } from "../store/xlt-token-store.interface.js";
import { XltMode } from "../const/index.js";
import { matchPermission } from "../perm/perm-pattern-match.js";
import { NotPermissionException } from "../exceptions/not-permission.exception.js";
import { NotRoleException } from "../exceptions/not-role.exception.js";
import { getStoreValue, setStoreValue } from "../store/store-helpers.js";

export class StpPermLogic {
  private readonly keys: XltTokenKeys;

  constructor(
    private readonly stpInterface: StpInterface,
    private readonly tokenStore: XltTokenStore,
    private readonly tokenConfig: XltTokenConfig,
  ) {
    this.keys = new XltTokenKeys(this.tokenConfig.tokenName);
  }

  private permCacheTimeoutSec(): number {
    return this.tokenConfig.permCacheTimeout ?? 0;
  }

  private async getPermissionList(loginId: string): Promise<string[]> {
    const timeout = this.permCacheTimeoutSec();
    if (timeout === 0) {
      return this.stpInterface.getPermissionList(loginId);
    }
    const key = this.keys.permCacheKey(loginId);
    const cached = await getStoreValue(this.tokenStore, key);
    if (cached !== null) {
      return JSON.parse(cached) as string[];
    }
    const list = await this.stpInterface.getPermissionList(loginId);
    await setStoreValue(this.tokenStore, key, JSON.stringify(list), timeout);
    return list;
  }

  private async getRoleList(loginId: string): Promise<string[]> {
    const timeout = this.permCacheTimeoutSec();
    if (timeout === 0) {
      return this.stpInterface.getRoleList(loginId);
    }
    const key = this.keys.roleCacheKey(loginId);
    const cached = await getStoreValue(this.tokenStore, key);
    if (cached !== null) {
      return JSON.parse(cached) as string[];
    }
    const list = await this.stpInterface.getRoleList(loginId);
    await setStoreValue(this.tokenStore, key, JSON.stringify(list), timeout);
    return list;
  }

  async hasPermission(loginId: string, permission: string): Promise<boolean> {
    if (!loginId || !permission) return false;
    const permissionList = await this.getPermissionList(loginId);
    if (!permissionList || permissionList.length <= 0) return false;
    return permissionList.some((p) => matchPermission(p, permission));
  }

  async checkPermission(loginId: string, permissions: string[], mode: XltMode): Promise<void> {
    if (!loginId || !permissions) throw new NotPermissionException(permissions, mode);
    const results = await Promise.all(permissions.map((p) => this.hasPermission(loginId, p)));
    const passed = mode === XltMode.AND ? results.every(Boolean) : results.some(Boolean);
    if (!passed) throw new NotPermissionException(permissions, mode);
  }

  async hasRole(loginId: string, role: string): Promise<boolean> {
    if (!loginId || !role) return false;

    const roles = await this.getRoleList(loginId);
    if (!roles || roles.length <= 0) return false;
    return roles.includes(role);
  }

  async checkRole(loginId: string, role: string[], mode: XltMode): Promise<void> {
    if (!loginId || !role) throw new NotRoleException(role, mode);
    const results = await Promise.all(role.map((r) => this.hasRole(loginId, r)));
    const passed = mode === XltMode.AND ? results.every(Boolean) : results.some(Boolean);
    if (!passed) throw new NotRoleException(role, mode);
  }
}
