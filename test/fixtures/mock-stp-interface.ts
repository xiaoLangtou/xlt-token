import type { StpInterface } from '../../src';

export class MockStpInterface implements StpInterface {
  private readonly perms = new Map<string, string[]>([
    ['1001', ['user:read', 'user:write', 'user:delete', 'order:*']],
    ['1002', ['user:read']],
  ]);
  private readonly roles = new Map<string, string[]>([
    ['1001', ['admin', 'super']],
    ['1002', ['user']],
  ]);

  async getPermissionList(loginId: string) {
    return this.perms.get(String(loginId)) ?? [];
  }

  async getRoleList(loginId: string) {
    return this.roles.get(String(loginId)) ?? [];
  }
}
