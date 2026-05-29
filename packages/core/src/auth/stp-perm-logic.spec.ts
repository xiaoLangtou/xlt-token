import { describe, it, expect, beforeEach, vi } from 'vitest';
import { StpPermLogic } from './stp-perm-logic';
import { MemoryStore } from '../store/memory-store.js';
import { DEFAULT_XLT_TOKEN_CONFIG } from '../config/xlt-token-config.js';
import { XltMode } from '../const/index.js';
import { NotPermissionException } from '../exceptions/not-permission.exception.js';
import { NotRoleException } from '../exceptions/not-role.exception.js';
import type { StpInterface } from '../perm/stp-interface.js';

const mockStpInterface: StpInterface = {
  getPermissionList: vi.fn((loginId: string) => {
    const map: Record<string, string[]> = {
      admin: ['user:add', 'user:delete', 'user:edit', 'order:*', 'system:*'],
      viewer: ['user:view'],
      empty: [],
      wildcard: ['*'],
    };
    return map[loginId] ?? [];
  }),
  getRoleList: vi.fn((loginId: string) => {
    const map: Record<string, string[]> = {
      admin: ['admin', 'editor'],
      viewer: ['viewer'],
      empty: [],
    };
    return map[loginId] ?? [];
  }),
};

describe('StpPermLogic', () => {
  let logic: StpPermLogic;

  beforeEach(async () => {
    vi.mocked(mockStpInterface.getPermissionList).mockClear();
    vi.mocked(mockStpInterface.getRoleList).mockClear();
    logic = new StpPermLogic(mockStpInterface, new MemoryStore(), DEFAULT_XLT_TOKEN_CONFIG);
  });

  describe('hasPermission', () => {
    it('精确匹配返回 true', async () => {
      expect(await logic.hasPermission('admin', 'user:add')).toBe(true);
    });

    it('精确不匹配返回 false', async () => {
      expect(await logic.hasPermission('viewer', 'user:add')).toBe(false);
    });

    it('通配符 order:* 匹配 order:create', async () => {
      expect(await logic.hasPermission('admin', 'order:create')).toBe(true);
    });

    it('通配符 system:* 匹配 system:config:edit', async () => {
      expect(await logic.hasPermission('admin', 'system:config:edit')).toBe(true);
    });

    it('全通配 * 匹配任意权限', async () => {
      expect(await logic.hasPermission('wildcard', 'anything:here')).toBe(true);
    });

    it('空权限列表返回 false', async () => {
      expect(await logic.hasPermission('empty', 'user:add')).toBe(false);
    });

    it('loginId 为空返回 false', async () => {
      expect(await logic.hasPermission('', 'user:add')).toBe(false);
    });

    it('permission 为空返回 false', async () => {
      expect(await logic.hasPermission('admin', '')).toBe(false);
    });

    it('不存在的 loginId 返回 false', async () => {
      expect(await logic.hasPermission('unknown', 'user:add')).toBe(false);
    });
  });

  describe('checkPermission', () => {
    it('AND 模式：全部拥有则通过', async () => {
      await expect(
        logic.checkPermission('admin', ['user:add', 'user:delete'], XltMode.AND),
      ).resolves.toBeUndefined();
    });

    it('AND 模式：缺少一个则抛 NotPermissionException', async () => {
      await expect(
        logic.checkPermission('viewer', ['user:view', 'user:add'], XltMode.AND),
      ).rejects.toThrow(NotPermissionException);
    });

    it('OR 模式：拥有任一则通过', async () => {
      await expect(
        logic.checkPermission('viewer', ['user:view', 'user:add'], XltMode.OR),
      ).resolves.toBeUndefined();
    });

    it('OR 模式：全部没有则抛 NotPermissionException', async () => {
      await expect(
        logic.checkPermission('viewer', ['user:add', 'user:delete'], XltMode.OR),
      ).rejects.toThrow(NotPermissionException);
    });

    it('通配符在 AND 模式下生效', async () => {
      await expect(
        logic.checkPermission('admin', ['order:create', 'order:delete'], XltMode.AND),
      ).resolves.toBeUndefined();
    });

    it('空 loginId 抛异常', async () => {
      await expect(
        logic.checkPermission('', ['user:add'], XltMode.AND),
      ).rejects.toThrow(NotPermissionException);
    });
  });

  describe('hasRole', () => {
    it('拥有角色返回 true', async () => {
      expect(await logic.hasRole('admin', 'admin')).toBe(true);
    });

    it('不拥有角色返回 false', async () => {
      expect(await logic.hasRole('viewer', 'admin')).toBe(false);
    });

    it('空角色列表返回 false', async () => {
      expect(await logic.hasRole('empty', 'admin')).toBe(false);
    });

    it('loginId 为空返回 false', async () => {
      expect(await logic.hasRole('', 'admin')).toBe(false);
    });

    it('role 为空返回 false', async () => {
      expect(await logic.hasRole('admin', '')).toBe(false);
    });
  });

  describe('checkRole', () => {
    it('AND 模式：全部拥有则通过', async () => {
      await expect(
        logic.checkRole('admin', ['admin', 'editor'], XltMode.AND),
      ).resolves.toBeUndefined();
    });

    it('AND 模式：缺少一个则抛 NotRoleException', async () => {
      await expect(
        logic.checkRole('admin', ['admin', 'super'], XltMode.AND),
      ).rejects.toThrow(NotRoleException);
    });

    it('OR 模式：拥有任一则通过', async () => {
      await expect(
        logic.checkRole('admin', ['admin', 'super'], XltMode.OR),
      ).resolves.toBeUndefined();
    });

    it('OR 模式：全部没有则抛 NotRoleException', async () => {
      await expect(
        logic.checkRole('viewer', ['admin', 'super'], XltMode.OR),
      ).rejects.toThrow(NotRoleException);
    });

    it('空 loginId 抛异常', async () => {
      await expect(
        logic.checkRole('', ['admin'], XltMode.AND),
      ).rejects.toThrow(NotRoleException);
    });
  });

  describe('permCacheTimeout', () => {
    it('permCacheTimeout=0 时每次查询都调用 StpInterface', async () => {
      await logic.hasPermission('admin', 'user:add');
      await logic.hasPermission('admin', 'user:delete');
      expect(mockStpInterface.getPermissionList).toHaveBeenCalledTimes(2);
    });

    it('permCacheTimeout>0 时同 loginId 复用缓存', async () => {
      const cached = new StpPermLogic(mockStpInterface, new MemoryStore(), {
        ...DEFAULT_XLT_TOKEN_CONFIG,
        permCacheTimeout: 60,
      });
      await cached.hasPermission('admin', 'user:add');
      await cached.hasPermission('admin', 'user:delete');
      expect(mockStpInterface.getPermissionList).toHaveBeenCalledTimes(1);
    });

    it('permCacheTimeout>0 时角色列表同样缓存', async () => {
      const cached = new StpPermLogic(mockStpInterface, new MemoryStore(), {
        ...DEFAULT_XLT_TOKEN_CONFIG,
        permCacheTimeout: 60,
      });
      await cached.hasRole('admin', 'admin');
      await cached.hasRole('admin', 'editor');
      expect(mockStpInterface.getRoleList).toHaveBeenCalledTimes(1);
    });
  });
});
